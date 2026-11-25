import { DEFAULT_SCRAPING_CONFIG, UniversityScraper } from '../scraper/UniversityScraper';

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('p-queue', () =>
  jest.fn().mockImplementation(() => ({
    add: jest.fn(fn => Promise.resolve(fn())),
    pending: 0,
    size: 0,
    isPaused: false,
    pause: jest.fn(),
    start: jest.fn(),
    clear: jest.fn(),
  }))
);

import axios from 'axios';

const mockedGet = axios.get as jest.Mock;
const HOME = '<html><body><p>Founded in 1900. About 25,000 students study here.</p></body></html>';
const base = { name: 'Fixture University', countryCode: 'US', country: 'United States', url: 'https://fixture.edu/' };

/** Route axios.get by URL: robots.txt gets `robots`, anything else gets `page`. */
const serve = (robots: { status: number; data?: string } | Error, page: string | Error = HOME) => {
  mockedGet.mockImplementation(async (url: string) => {
    const answer = url.endsWith('/robots.txt') ? robots : page;
    if (answer instanceof Error) throw answer;
    if (typeof answer === 'string') return { status: 200, data: answer };
    return { status: answer.status, data: answer.data ?? '' };
  });
};

const pageRequests = () => mockedGet.mock.calls.filter(([url]) => !String(url).endsWith('/robots.txt'));

describe('UniversityScraper with robots.txt', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    mockedGet.mockReset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  const scraper = (config: object = {}) => new UniversityScraper({ hostInterval: 0, ...config });

  it('reads robots.txt first and enriches the page when it is allowed', async () => {
    serve({ status: 200, data: 'User-agent: *\nDisallow: /private' });
    const result = await scraper().scrapeUniversityDetailed(base);
    expect(result.status).toBe('enriched');
    expect(result.university.foundedYear).toBe(1900);
    expect(result.university.studentCount).toBe(25000);
    expect(mockedGet.mock.calls[0][0]).toBe('https://fixture.edu/robots.txt');
    expect(mockedGet.mock.calls[0][1]).toMatchObject({
      headers: { 'User-Agent': DEFAULT_SCRAPING_CONFIG.userAgent },
      validateStatus: expect.any(Function),
    });
  });

  it('does not fetch the page when robots.txt disallows it, and says why', async () => {
    serve({ status: 200, data: 'User-agent: *\nDisallow: /' });
    const s = scraper();
    const result = await s.scrapeUniversityDetailed(base);
    expect(result.status).toBe('blocked-by-robots');
    expect(result.reason).toContain('disallowed by https://fixture.edu/robots.txt');
    expect(pageRequests()).toHaveLength(0);
    expect(result.university.sources).toEqual([]);
    expect(result.university.dataQuality.completeness).toBe(0.2);
    expect(s.stats).toMatchObject({ blockedByRobots: 1, enriched: 0, pageRequests: 0 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipped https://fixture.edu/'));
  });

  it('uses the group that names this crawler', async () => {
    serve({ status: 200, data: 'User-agent: *\nDisallow: /\n\nUser-agent: WorldUniversitiesBot\nAllow: /' });
    expect((await scraper().scrapeUniversityDetailed(base)).status).toBe('enriched');
  });

  it('skips a site whose robots.txt cannot be read (5xx) and one with an excessive Crawl-delay', async () => {
    serve({ status: 500 });
    expect((await scraper().scrapeUniversityDetailed(base)).status).toBe('blocked-by-robots');
    serve({ status: 200, data: 'User-agent: *\nCrawl-delay: 600' });
    const slow = await scraper().scrapeUniversityDetailed(base);
    expect(slow.status).toBe('blocked-by-robots');
    expect(slow.reason).toContain('Crawl-delay');
    // A larger limit accepts the same site.
    serve({ status: 200, data: 'User-agent: *\nCrawl-delay: 0.001' });
    expect((await scraper({ maxCrawlDelay: 5000 }).scrapeUniversityDetailed(base)).status).toBe('enriched');
  });

  it('never requests robots.txt when respectRobots is false', async () => {
    serve({ status: 200, data: 'User-agent: *\nDisallow: /' });
    const result = await scraper({ respectRobots: false }).scrapeUniversityDetailed(base);
    expect(result.status).toBe('enriched');
    expect(mockedGet.mock.calls.map(([url]) => url)).toEqual(['https://fixture.edu/']);
  });

  it('reports a failed page fetch as failed, counts retries, and still returns the base record', async () => {
    serve({ status: 404 }, new Error('connection refused'));
    const s = scraper({ retries: 2 });
    jest.spyOn(s as unknown as { delay(): Promise<void> }, 'delay').mockResolvedValue(undefined);
    const result = await s.scrapeUniversityDetailed(base);
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('connection refused');
    expect(result.university.name).toBe('Fixture University');
    expect(s.stats).toMatchObject({ failed: 1, retries: 1, pageRequests: 2 });
  });

  it('keeps scrapeUniversity returning a university for blocked pages', async () => {
    serve({ status: 200, data: 'User-agent: *\nDisallow: /' });
    const university = await scraper().scrapeUniversity(base);
    expect(university.id).toBe('us-fixture-university-fixture-edu');
  });

  it('merges a partial config over the defaults and exposes the effective settings', () => {
    const s = new UniversityScraper({ concurrency: 2 });
    expect(s.settings).toMatchObject({
      concurrency: 2,
      interval: 1000,
      respectRobots: true,
      hostInterval: 1000,
      maxCrawlDelay: 30000,
    });
  });

  it('spaces requests to the same host by the larger of hostInterval and the Crawl-delay', async () => {
    serve({ status: 200, data: 'User-agent: *\nCrawl-delay: 0.05' });
    const s = scraper({ hostInterval: 10 });
    const started = Date.now();
    await s.scrapeUniversityDetailed(base);
    await s.scrapeUniversityDetailed(base);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });

  it('rejects a record without a URL', async () => {
    await expect(scraper().scrapeUniversityDetailed({ name: 'No URL' })).rejects.toThrow('URL is required');
  });
});

describe('student count extraction', () => {
  beforeEach(() => mockedGet.mockReset());
  const countFor = async (html: string) => {
    serve({ status: 404 }, `<html><body>${html}</body></html>`);
    return (await new UniversityScraper({ hostInterval: 0 }).scrapeUniversity({ ...base, url: 'https://x.edu/' }))
      .studentCount;
  };

  it.each([
    ['45,000 students', 45000],
    ['12 500 undergraduates', 12500],
    ['9000 enrolled students', 9000],
    ['Enrollment of 18,200 this year', 18200],
    ['student body: 3,100', 3100],
  ])('reads "%s"', async (text, expected) => {
    expect(await countFor(`<p>${text}</p>`)).toBe(expected);
  });

  it.each(['3 students per lab', '5,000,000 students', 'no numbers here'])('ignores "%s"', async text => {
    expect(await countFor(`<p>${text}</p>`)).toBeUndefined();
  });
});
