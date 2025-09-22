"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const UniversityScraper_1 = require("../scraper/UniversityScraper");
const University_1 = require("../types/University");
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
const axios_1 = __importDefault(require("axios"));
const mockedAxios = axios_1.default;
describe('UniversityScraper - Simple Tests', () => {
    let scraper;
    beforeEach(() => {
        scraper = new UniversityScraper_1.UniversityScraper();
        jest.clearAllMocks();
    });
    describe('scrapeUniversity', () => {
        it('should handle successful scraping', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
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
            const result = yield scraper.scrapeUniversity(baseUniversity);
            expect(mockedAxios.get).toHaveBeenCalledWith('https://test.edu', expect.objectContaining({
                timeout: 10000,
                headers: expect.objectContaining({
                    'User-Agent': expect.stringContaining('WorldUniversitiesBot'),
                }),
            }));
            expect(result).toBeDefined();
            expect(result.url).toBe('https://test.edu');
            expect(result.foundedYear).toBe(1950);
            expect((_a = result.dataQuality) === null || _a === void 0 ? void 0 : _a.completeness).toBeGreaterThan(0.3);
            expect(result.domain).toBe('test.edu');
            expect(result.id).toContain('us-test-university');
        }));
        it('should handle network errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
            const baseUniversity = {
                name: 'Test University',
                url: 'https://test.edu',
                country: 'United States',
                countryCode: 'US',
            };
            const result = yield scraper.scrapeUniversity(baseUniversity);
            expect(result).toBeDefined();
            expect(result.url).toBe('https://test.edu');
            expect((_b = result.dataQuality) === null || _b === void 0 ? void 0 : _b.completeness).toBeLessThan(0.5);
        }));
        it('should extract founding years correctly', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const result = yield scraper.scrapeUniversity(baseUniversity);
            expect(result.foundedYear).toBe(1885);
        }));
        it('should classify university types', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const result = yield scraper.scrapeUniversity(baseUniversity);
            expect(result.type).toBe(University_1.UniversityType.PUBLIC);
        }));
    });
    describe('queue management', () => {
        it('should provide queue status', () => {
            const status = scraper.getQueueStatus();
            expect(status).toHaveProperty('size');
            expect(status).toHaveProperty('pending');
            expect(status).toHaveProperty('isPaused');
        });
        it('should allow pausing and resuming', () => {
            const mockQueue = scraper.queue; // eslint-disable-line @typescript-eslint/no-explicit-any
            scraper.pause();
            expect(mockQueue.pause).toHaveBeenCalled();
            scraper.resume();
            expect(mockQueue.start).toHaveBeenCalled();
        });
        it('should allow clearing the queue', () => {
            const mockQueue = scraper.queue; // eslint-disable-line @typescript-eslint/no-explicit-any
            scraper.clear();
            expect(mockQueue.clear).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=scraper.test.js.map