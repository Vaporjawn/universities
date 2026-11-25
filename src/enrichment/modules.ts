import { estimateSize, inferGeography } from '../data/regions';
import { UniversityScraper } from '../scraper/UniversityScraper';
import { University } from '../types/University';
import { Feed } from './feed';
import { EnrichmentModule } from './types';

/**
 * Module that fetches a university's homepage and extracts descriptive, contact, academic and enrolment data. It
 * honours robots.txt through the scraper's settings and reports `blocked` when the page is disallowed.
 *
 * @param scraper - The scraper to use. Its rate limits and robots settings apply.
 */
export const createHtmlScrapeModule = (scraper: UniversityScraper): EnrichmentModule => ({
  name: 'html-scrape',
  version: '1',
  describe: () => ({
    userAgent: scraper.settings.userAgent,
    respectRobots: scraper.settings.respectRobots,
    interval: scraper.settings.interval,
    hostInterval: scraper.settings.hostInterval,
    concurrency: scraper.settings.concurrency,
    timeout: scraper.settings.timeout,
    retries: scraper.settings.retries,
    maxCrawlDelay: scraper.settings.maxCrawlDelay,
  }),
  async enrich(university) {
    const result = await scraper.scrapeUniversityDetailed(university);
    if (result.status === 'blocked-by-robots') return { status: 'blocked', reason: result.reason };
    if (result.status === 'failed') return { status: 'failed', reason: result.reason };
    // The scraper returns the whole record; id, lastUpdated and dataQuality are assembled by the pipeline.
    const { id, lastUpdated, dataQuality, sources, ...fields } = result.university;
    void id;
    return { data: { ...fields, dataQuality, lastUpdated }, sources };
  },
});

/**
 * Module that fills `continent`, `subregion` and `size` from what is already known. It never overwrites a value
 * another module or the source data provided, and skips the record when there is nothing to add.
 */
export const createClassificationModule = (): EnrichmentModule => ({
  name: 'classification',
  version: '1',
  async enrich(university) {
    const data: Partial<University> = {};
    const geography = inferGeography(university.countryCode);
    if (geography) {
      if (!university.continent) data.continent = geography.continent;
      if (!university.subregion) data.subregion = geography.subregion;
    }
    if (!university.size) {
      const size = estimateSize(university.studentCount);
      if (size) data.size = size;
    }
    return Object.keys(data).length > 0 ? { data } : { status: 'skipped', reason: 'nothing to infer' };
  },
});

/**
 * Module that adds rankings and accreditation from a loaded {@link Feed}.
 *
 * @param feed - Rankings or accreditation feed.
 * @param name - Module name, unique within a run. Defaults to `feed:<file>`.
 */
export const createFeedModule = (feed: Feed, name = `feed:${feed.label}`): EnrichmentModule => ({
  name,
  version: '1',
  describe: () => ({ file: feed.label, entries: feed.size }),
  async enrich(university) {
    const entries = feed.lookup(university);
    if (entries.length === 0) return { status: 'skipped', reason: 'no feed entry for this university' };
    const rankings = entries.flatMap(e => e.rankings ?? []);
    const accreditation = entries.flatMap(e => e.accreditation ?? []);
    return {
      data: {
        ...(rankings.length ? { rankings } : {}),
        ...(accreditation.length ? { accreditation } : {}),
      },
      sources: [feed.label],
    };
  },
});
