import { UniversityScraper } from '../scraper/UniversityScraper';
import { UniversityType } from '../types/University';

// Mock axios completely
jest.mock('axios', () => ({
  get: jest.fn(),
}));

// Mock p-queue
jest.mock('p-queue', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn(fn => Promise.resolve(fn())),
    pending: 0,
    size: 0,
    isPaused: false,
    pause: jest.fn(),
    start: jest.fn(),
    clear: jest.fn(),
  }));
});

import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UniversityScraper - Simple Tests', () => {
  let scraper: UniversityScraper;

  beforeEach(() => {
    scraper = new UniversityScraper();
    jest.clearAllMocks();
  });

  describe('scrapeUniversity', () => {
    it('should handle successful scraping', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="description" content="A great university with excellent programs">
        </head>
        <body>
          <h1>Test University</h1>
          <p>Founded in 1950, Test University is a leading institution.</p>
          <a href="mailto:info@test.edu">Contact us</a>
          <div class="contact">Phone: (555) 123-4567</div>
        </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const baseUniversity = {
        name: 'Test University',
        url: 'https://test.edu',
        country: 'United States',
        countryCode: 'US',
      };

      const result = await scraper.scrapeUniversity(baseUniversity);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://test.edu',
        expect.objectContaining({
          timeout: 10000,
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('WorldUniversitiesBot'),
          }),
        })
      );

      expect(result).toBeDefined();
      expect(result.url).toBe('https://test.edu');
      expect(result.foundedYear).toBe(1950);
      expect(result.dataQuality?.completeness).toBeGreaterThan(0.3);
      expect(result.domain).toBe('test.edu');
      expect(result.id).toContain('us-test-university');
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const baseUniversity = {
        name: 'Test University',
        url: 'https://test.edu',
        country: 'United States',
        countryCode: 'US',
      };

      const result = await scraper.scrapeUniversity(baseUniversity);

      expect(result).toBeDefined();
      expect(result.url).toBe('https://test.edu');
      expect(result.dataQuality?.completeness).toBeLessThan(0.5);
    });

    it('should extract founding years correctly', async () => {
      const mockHtml = `
        <html><body>
          <p>Established in 1885</p>
        </body></html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const baseUniversity = {
        name: 'Old University',
        url: 'https://old.edu',
        country: 'United States',
        countryCode: 'US',
      };

      const result = await scraper.scrapeUniversity(baseUniversity);

      expect(result.foundedYear).toBe(1885);
    });

    it('should classify university types', async () => {
      const mockHtml = `
        <html><body>
          <p>This is a public university</p>
          <p>State university system</p>
        </body></html>
      `;

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const baseUniversity = {
        name: 'State University',
        url: 'https://state.edu',
        country: 'United States',
        countryCode: 'US',
      };

      const result = await scraper.scrapeUniversity(baseUniversity);

      expect(result.type).toBe(UniversityType.PUBLIC);
    });
  });

  describe('queue management', () => {
    it('should provide queue status', () => {
      const status = scraper.getQueueStatus();
      expect(status).toHaveProperty('size');
      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('isPaused');
    });

    it('should allow pausing and resuming', () => {
      const mockQueue = (scraper as any).queue; // eslint-disable-line @typescript-eslint/no-explicit-any

      scraper.pause();
      expect(mockQueue.pause).toHaveBeenCalled();

      scraper.resume();
      expect(mockQueue.start).toHaveBeenCalled();
    });

    it('should allow clearing the queue', () => {
      const mockQueue = (scraper as any).queue; // eslint-disable-line @typescript-eslint/no-explicit-any

      scraper.clear();
      expect(mockQueue.clear).toHaveBeenCalled();
    });
  });
});
