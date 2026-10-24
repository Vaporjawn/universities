import { DegreeLevel, UniversityType } from '../types/University';
import { DEFAULT_SCRAPING_CONFIG, UniversityScraper } from '../scraper/UniversityScraper';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

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

const base = { name: 'Fixture University', url: 'https://fixture.edu', country: 'United States', countryCode: 'US' };

/** Serve `html` for the next request and scrape the fixture university. */
async function scrape(scraper: UniversityScraper, html: string, overrides: Partial<typeof base> = {}) {
  mockedAxios.get.mockResolvedValueOnce({ data: html, status: 200, statusText: 'OK', headers: {}, config: {} });
  return scraper.scrapeUniversity({ ...base, ...overrides });
}

/** Replace the real 1-2 second retry delay with an instant one, and return the spy. */
function stubDelay(scraper: UniversityScraper) {
  // eslint-disable-next-line no-unused-vars
  type WithDelay = { delay: (ms: number) => Promise<void> };
  return jest.spyOn(scraper as unknown as WithDelay, 'delay').mockResolvedValue(undefined);
}

const page = (body: string, head = '') => `<html><head>${head}</head><body>${body}</body></html>`;

describe('UniversityScraper extraction', () => {
  let scraper: UniversityScraper;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockReset();
    scraper = new UniversityScraper();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('requests and retries', () => {
    it('requires a url', async () => {
      await expect(scraper.scrapeUniversity({ name: 'No Url' })).rejects.toThrow(
        'University URL is required for scraping'
      );
    });

    it('retries after a failure with a growing delay and then succeeds', async () => {
      const delay = stubDelay(scraper);
      mockedAxios.get
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          data: page('<p>Founded in 1901</p>'),
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });

      const result = await scraper.scrapeUniversity(base);

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      expect(delay.mock.calls.map(call => call[0])).toEqual([1000, 2000]);
      expect(result.foundedYear).toBe(1901);
      expect(result.sources).toEqual(['https://fixture.edu']);
    });

    it('gives up after the configured number of attempts and returns a low-quality record', async () => {
      stubDelay(scraper);
      mockedAxios.get.mockRejectedValue(new Error('connection refused'));

      const result = await scraper.scrapeUniversity(base);

      expect(mockedAxios.get).toHaveBeenCalledTimes(DEFAULT_SCRAPING_CONFIG.retries);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('connection refused'));
      expect(result.sources).toEqual([]);
      expect(result.dataQuality).toEqual({ completeness: 0.2, accuracy: 0.5, freshness: 1, reliability: 0.3 });
      expect(result.id).toBe('us-fixture-university-fixture-edu');
    });

    it('sends the configured user agent and timeout', async () => {
      const custom = new UniversityScraper({ ...DEFAULT_SCRAPING_CONFIG, userAgent: 'TestBot/1.0', timeout: 1234 });
      await scrape(custom, page(''));
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://fixture.edu',
        expect.objectContaining({ timeout: 1234, headers: expect.objectContaining({ 'User-Agent': 'TestBot/1.0' }) })
      );
    });
  });

  describe('description', () => {
    const long = 'A university that teaches many subjects to many students across several campuses.';

    it('prefers the meta description when it is long enough', async () => {
      const result = await scrape(scraper, page('', `<meta name="description" content="  ${long}  ">`));
      expect(result.description).toBe(long);
    });

    it('falls back to the Open Graph description', async () => {
      const result = await scrape(
        scraper,
        page('', `<meta name="description" content="short"><meta property="og:description" content="${long}">`)
      );
      expect(result.description).toBe(long);
    });

    it('falls back to the first paragraph of an about section', async () => {
      const paragraph = 'x'.repeat(150);
      const result = await scrape(scraper, page(`<div class="about"><p>${paragraph}</p></div>`));
      expect(result.description).toBe(paragraph);
    });

    it('ignores about text that is too short or too long, and finds nothing on an empty page', async () => {
      expect((await scrape(scraper, page('<div class="about"><p>too short</p></div>'))).description).toBeUndefined();
      expect(
        (await scrape(scraper, page(`<div class="about"><p>${'y'.repeat(1200)}</p></div>`))).description
      ).toBeUndefined();
      expect((await scrape(scraper, page(''))).description).toBeUndefined();
    });
  });

  describe('contact information', () => {
    it('reads a phone number from a tel link and from a phone element', async () => {
      expect((await scrape(scraper, page('<a href="tel:+1-555-123-4567">Call</a>'))).contact?.phone).toContain('555');
      expect((await scrape(scraper, page('<span class="phone">(555) 123-4567</span>'))).contact?.phone).toBe(
        '(555) 123-4567'
      );
    });

    it('ignores numbers that are too short', async () => {
      expect((await scrape(scraper, page('<span class="phone">12345</span>'))).contact?.phone).toBeUndefined();
    });

    it('reads an email from a mailto link and from an email element', async () => {
      expect((await scrape(scraper, page('<a href="mailto:admissions@fixture.edu ">Mail</a>'))).contact?.email).toBe(
        'admissions@fixture.edu'
      );
      expect(
        (await scrape(scraper, page('<span class="email">Write to info@fixture.edu today</span>'))).contact?.email
      ).toBe('info@fixture.edu');
    });

    it('has no contact when nothing is found', async () => {
      expect((await scrape(scraper, page('<p>Hello</p>'))).contact).toBeUndefined();
    });
  });

  describe('location', () => {
    it('reads the address, city and state from an address element', async () => {
      const result = await scrape(scraper, page('<div class="address">100 Main Street Boston, MA 02115</div>'));
      expect(result.address).toBe('100 Main Street Boston, MA 02115');
      expect(result.state).toBe('MA');
      expect(result.city).toContain('Main Street Boston');
    });

    it('keeps the address when no city and state can be parsed', async () => {
      const result = await scrape(scraper, page('<div class="location">Somewhere on campus</div>'));
      expect(result.address).toBe('Somewhere on campus');
      expect(result.city).toBeUndefined();
    });

    it('ignores very short address text', async () => {
      expect((await scrape(scraper, page('<div class="address">Here</div>'))).address).toBeUndefined();
    });
  });

  describe('founding year', () => {
    it.each([
      ['Founded in 1636', 1636],
      ['Established 1885 by the state', 1885],
      ['Serving students since 1950', 1950],
      ['In 1872 the college was founded', 1872],
      ['1901 established as a normal school', 1901],
    ])('reads %p', async (text, year) => {
      expect((await scrape(scraper, page(`<p>${text}</p>`))).foundedYear).toBe(year);
    });

    it('rejects years before 1000 and in the future', async () => {
      expect((await scrape(scraper, page('<p>Founded in 0999</p>'))).foundedYear).toBeUndefined();
      expect((await scrape(scraper, page('<p>Founded in 9999</p>'))).foundedYear).toBeUndefined();
    });
  });

  describe('type classification', () => {
    it.each([
      ['Fixture Community College', '', UniversityType.COMMUNITY_COLLEGE],
      ['Fixture University', '<p>We are a community college</p>', UniversityType.COMMUNITY_COLLEGE],
      ['Fixture Technical University', '', UniversityType.TECHNICAL],
      ['Fixture Institute of Technology', '', UniversityType.TECHNICAL],
      ['Fixture Naval Academy', '', UniversityType.MILITARY],
      ['Fixture University', '<p>A liberal arts experience</p>', UniversityType.LIBERAL_ARTS],
      ['Fixture University', '<p>A research university</p>', UniversityType.RESEARCH],
      ['Fixture University', '<p>A private school</p>', UniversityType.PRIVATE],
      ['Fixture University', '<p>A state university</p>', UniversityType.PUBLIC],
      ['Fixture University', '<p>Nothing helpful</p>', undefined],
    ])('classifies %p with %p as %p', async (name, body, expected) => {
      expect((await scrape(scraper, page(body), { name })).type).toBe(expected);
    });

    it('treats a page mentioning both private and public as public', async () => {
      expect((await scrape(scraper, page('<p>private and public funding</p>'))).type).toBe(UniversityType.PUBLIC);
    });
  });

  describe('programs and faculties', () => {
    it('reads programs and guesses the degree level from keywords', async () => {
      const result = await scrape(
        scraper,
        page(`
          <div class="program">PhD in Physics</div>
          <div class="course">Master of Science in Biology</div>
          <div class="degree">Certificate in Welding</div>
          <div class="program">Biology Major</div>
          <div class="program">Art</div>
        `)
      );
      expect(result.programs).toEqual([
        { name: 'PhD in Physics', degreeLevel: DegreeLevel.DOCTORAL },
        { name: 'Master of Science in Biology', degreeLevel: DegreeLevel.MASTER },
        { name: 'Certificate in Welding', degreeLevel: DegreeLevel.CERTIFICATE },
        { name: 'Biology Major', degreeLevel: DegreeLevel.BACHELOR },
      ]);
    });

    it('caps programs at 50 and faculties at 20', async () => {
      const programs = Array.from({ length: 60 }, (_, i) => `<div class="program">Program number ${i}</div>`).join('');
      const faculties = Array.from({ length: 30 }, (_, i) => `<div class="faculty">Faculty of Subject ${i}</div>`).join(
        ''
      );
      const result = await scrape(scraper, page(programs + faculties));
      expect(result.programs).toHaveLength(50);
      expect(result.faculties).toHaveLength(20);
    });

    it('only keeps faculty elements that name a faculty, school or college', async () => {
      const result = await scrape(
        scraper,
        page(
          '<div class="school">School of Engineering</div><div class="college">Lounge area</div><div class="faculty">Fac</div>'
        )
      );
      expect(result.faculties).toEqual([{ name: 'School of Engineering' }]);
    });

    it('has neither when the page lists none', async () => {
      const result = await scrape(scraper, page('<p>Hi</p>'));
      expect(result.programs).toBeUndefined();
      expect(result.faculties).toBeUndefined();
    });
  });

  describe('social media', () => {
    const links = `
      <a href="https://www.facebook.com/fixtureu">f</a>
      <a href="https://twitter.com/fixtureu">t</a>
      <a href="https://www.instagram.com/fixtureu">i</a>
      <a href="https://www.linkedin.com/school/fixtureu">l</a>
      <a href="https://www.youtube.com/fixtureu">y</a>
    `;

    it('collects the first link for each network', async () => {
      const result = await scrape(scraper, page(`<a href="mailto:a@fixture.edu">mail</a>${links}`));
      expect(result.contact?.socialMedia).toEqual({
        facebook: 'https://www.facebook.com/fixtureu',
        twitter: 'https://twitter.com/fixtureu',
        instagram: 'https://www.instagram.com/fixtureu',
        linkedin: 'https://www.linkedin.com/school/fixtureu',
        youtube: 'https://www.youtube.com/fixtureu',
      });
    });

    it('recognises x.com links', async () => {
      const result = await scrape(
        scraper,
        page('<a href="mailto:a@fixture.edu">m</a><a href="https://x.com/fixtureu">x</a>')
      );
      expect(result.contact?.socialMedia?.twitter).toBe('https://x.com/fixtureu');
    });

    it('keeps social links even when the page has no phone or email', async () => {
      const result = await scrape(scraper, page(links));
      expect(result.contact?.socialMedia?.facebook).toBe('https://www.facebook.com/fixtureu');
    });

    it('ignores bare network homepages without a profile path', async () => {
      const result = await scrape(
        scraper,
        page('<a href="mailto:a@fixture.edu">m</a><a href="https://facebook.com">fb</a>')
      );
      expect(result.contact?.socialMedia).toBeUndefined();
    });
  });

  describe('motto, domain and ids', () => {
    it('reads a motto and ignores one that is too short or too long', async () => {
      expect((await scrape(scraper, page('<p class="motto">Veritas et Lux</p>'))).motto).toBe('Veritas et Lux');
      expect((await scrape(scraper, page('<p class="motto">Hi</p>'))).motto).toBeUndefined();
      expect((await scrape(scraper, page(`<p class="tagline">${'z'.repeat(250)}</p>`))).motto).toBeUndefined();
    });

    it('derives the domain from the url', async () => {
      expect((await scrape(scraper, page(''), { url: 'https://www.cs.fixture.edu/path?x=1' })).domain).toBe(
        'www.cs.fixture.edu'
      );
    });

    it('still builds an id from a url that does not parse', () => {
      expect(scraper.generateUniversityId({ name: 'Odd', countryCode: 'US', url: 'not a url/path' })).toBe(
        'us-odd-not-a-url'
      );
    });
  });

  describe('data quality', () => {
    it('scores a rich page higher than a sparse one', async () => {
      const rich = await scrape(
        scraper,
        page(
          `<p>Founded in 1900</p><a href="mailto:a@fixture.edu">m</a><div class="address">1 Main Street Boston, MA</div>
           <div class="program">PhD in Physics</div><div class="school">School of Arts</div><p class="motto">Lux et Veritas</p>
           <p>A state university</p>`,
          '<meta name="description" content="A long enough description of the university for the quality scorer to count it.">'
        )
      );
      const sparse = await scrape(scraper, page('<p>Hello</p>'));
      expect(rich.dataQuality.completeness).toBeGreaterThan(0.8);
      expect(rich.dataQuality.reliability).toBeCloseTo(rich.dataQuality.completeness * 0.9);
      expect(sparse.dataQuality.completeness).toBeLessThan(0.2);
    });
  });
});
