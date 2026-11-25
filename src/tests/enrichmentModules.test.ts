import fs from 'fs';
import os from 'os';
import path from 'path';
import { csvRowsToEntries, Feed, loadFeed, normalizeDomain, normalizeName } from '../enrichment/feed';
import { mergeUniversity } from '../enrichment/merge';
import { createClassificationModule, createFeedModule, createHtmlScrapeModule } from '../enrichment/modules';
import { UniversityScraper } from '../scraper/UniversityScraper';
import { Continent, UniversitySize } from '../types/University';

let folder: string;
beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'universities-feed-'));
});
afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe('normalizeName / normalizeDomain', () => {
  it('ignores case, accents, punctuation, "&" and a leading "the"', () => {
    expect(normalizeName('The Université de Montréal')).toBe('universite de montreal');
    expect(normalizeName('Texas A&M University')).toBe('texas a and m university');
    expect(normalizeName("King's  College, London")).toBe('king s college london');
  });

  it('reduces URLs and bare domains to a host without www', () => {
    expect(normalizeDomain('https://www.Example.EDU/path?q=1')).toBe('example.edu');
    expect(normalizeDomain('example.edu')).toBe('example.edu');
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain(undefined)).toBe('');
    expect(normalizeDomain('http://')).toBe('');
  });
});

describe('csvRowsToEntries', () => {
  it('builds ranking and accreditation entries and skips unusable rows', () => {
    const entries = csvRowsToEntries([
      { source: 'QS', rank: '5', year: '2026', category: 'World', rankingUrl: 'https://qs.example', domain: 'mit.edu' },
      { source: 'QS', rank: 'ten', year: '2026', domain: 'bad.edu' },
      { source: 'QS', rank: '0', year: '2026', domain: 'zero.edu' },
      { source: 'QS', rank: '3', year: '1800', domain: 'old.edu' },
      { source: '', rank: '3', year: '2026', domain: 'nosource.edu' },
      { countryCode: 'GB', name: 'Oxford', accreditation: 'AMBA; EQUIS ;' },
      { domain: 'empty.edu' },
    ]);
    expect(entries).toEqual([
      {
        countryCode: undefined,
        name: undefined,
        domain: 'mit.edu',
        rankings: [{ source: 'QS', rank: 5, year: 2026, category: 'World', url: 'https://qs.example' }],
      },
      { countryCode: 'GB', name: 'Oxford', domain: undefined, accreditation: ['AMBA', 'EQUIS'] },
    ]);
  });
});

describe('Feed and loadFeed', () => {
  it('prefers a domain match over a name match and returns nothing for unknown universities', () => {
    const feed = new Feed(
      [
        { domain: 'mit.edu', accreditation: ['A'] },
        { countryCode: 'US', name: 'Massachusetts Institute of Technology', accreditation: ['B'] },
        { countryCode: 'gb', name: 'The University of Oxford', accreditation: ['C'] },
      ],
      'test'
    );
    expect(feed.size).toBe(3);
    expect(
      feed.lookup({ url: 'https://www.mit.edu/', name: 'Massachusetts Institute of Technology', countryCode: 'US' })
    ).toEqual([{ domain: 'mit.edu', accreditation: ['A'] }]);
    expect(feed.lookup({ name: 'University of Oxford', countryCode: 'GB' })).toHaveLength(1);
    expect(feed.lookup({ name: 'University of Oxford', countryCode: 'US' })).toEqual([]);
    expect(feed.lookup({ name: 'University of Oxford' })).toEqual([]);
    expect(feed.lookup({})).toEqual([]);
  });

  it('loads CSV (with a byte order mark) and JSON files and rejects other files', async () => {
    const csvFile = path.join(folder, 'rankings.csv');
    fs.writeFileSync(csvFile, '﻿source,rank,year,domain\nQS,1,2026,mit.edu\n');
    const csvFeed = await loadFeed(csvFile);
    expect(csvFeed.lookup({ url: 'https://mit.edu' })[0].rankings).toEqual([
      { source: 'QS', rank: 1, year: 2026, category: undefined, url: undefined },
    ]);

    const jsonFile = path.join(folder, 'feed.json');
    fs.writeFileSync(jsonFile, JSON.stringify([{ domain: 'ox.ac.uk', accreditation: ['EQUIS'] }]));
    expect((await loadFeed(jsonFile)).lookup({ url: 'https://ox.ac.uk' })[0].accreditation).toEqual(['EQUIS']);

    fs.writeFileSync(path.join(folder, 'object.json'), '{}');
    await expect(loadFeed(path.join(folder, 'object.json'))).rejects.toThrow('expected a JSON array');
    await expect(loadFeed(path.join(folder, 'feed.txt'))).rejects.toThrow('.csv or .json');
    await expect(loadFeed(path.join(folder, 'missing.csv'))).rejects.toThrow();
  });
});

describe('mergeUniversity', () => {
  it('replaces defined fields, ignores undefined ones, and never mutates its inputs', () => {
    const base = { name: 'A', city: 'X', description: 'old' };
    const merged = mergeUniversity(base, { city: undefined, description: 'new', state: 'S' });
    expect(merged).toEqual({ name: 'A', city: 'X', description: 'new', state: 'S' });
    expect(base).toEqual({ name: 'A', city: 'X', description: 'old' });
  });

  it('combines rankings by source, year and category, accreditation and sources without duplicates', () => {
    const merged = mergeUniversity(
      { rankings: [{ source: 'QS', rank: 9, year: 2026 }], accreditation: ['A'], sources: ['u1'] },
      {
        rankings: [
          { source: 'QS', rank: 8, year: 2026 },
          { source: 'QS', rank: 3, year: 2025 },
        ],
        accreditation: ['A', 'B'],
        sources: ['u1', 'u2'],
      }
    );
    expect(merged.rankings).toEqual([
      { source: 'QS', rank: 8, year: 2026 },
      { source: 'QS', rank: 3, year: 2025 },
    ]);
    expect(merged.accreditation).toEqual(['A', 'B']);
    expect(merged.sources).toEqual(['u1', 'u2']);
  });

  it('keeps existing lists when the patch has empty or missing ones', () => {
    expect(mergeUniversity({ accreditation: ['A'] }, { accreditation: [], rankings: [], sources: [] })).toEqual({
      accreditation: ['A'],
    });
  });
});

describe('classification module', () => {
  const module = createClassificationModule();

  it('adds continent, sub-region and size without overwriting what is known', async () => {
    expect((await module.enrich({ countryCode: 'FR', studentCount: 40000 })).data).toEqual({
      continent: Continent.EUROPE,
      subregion: 'Western Europe',
      size: UniversitySize.VERY_LARGE,
    });
    expect(
      (
        await module.enrich({
          countryCode: 'FR',
          studentCount: 40000,
          continent: Continent.ASIA,
          subregion: 'x',
          size: UniversitySize.SMALL,
        })
      ).status
    ).toBe('skipped');
  });

  it('skips records it cannot classify', async () => {
    expect(await module.enrich({ countryCode: 'ZZ' })).toEqual({ status: 'skipped', reason: 'nothing to infer' });
  });
});

describe('feed module', () => {
  const feed = new Feed(
    [
      { domain: 'mit.edu', rankings: [{ source: 'QS', rank: 1, year: 2026 }] },
      { domain: 'mit.edu', accreditation: ['NECHE'] },
    ],
    'rankings.csv'
  );

  it('adds rankings and accreditation from every matching entry and records the feed as a source', async () => {
    const module = createFeedModule(feed);
    expect(module.name).toBe('feed:rankings.csv');
    expect(module.describe?.()).toEqual({ file: 'rankings.csv', entries: 2 });
    expect(await module.enrich({ url: 'https://mit.edu' })).toEqual({
      data: { rankings: [{ source: 'QS', rank: 1, year: 2026 }], accreditation: ['NECHE'] },
      sources: ['rankings.csv'],
    });
  });

  it('skips universities without an entry, and honours a custom name', async () => {
    const module = createFeedModule(feed, 'qs');
    expect(module.name).toBe('qs');
    expect((await module.enrich({ url: 'https://other.edu' })).status).toBe('skipped');
  });
});

describe('html-scrape module', () => {
  const university = { name: 'U', countryCode: 'US', country: 'United States', url: 'https://u.edu' };
  const fakeScraper = (result: object) =>
    ({
      settings: {
        userAgent: 'Bot',
        respectRobots: true,
        interval: 1,
        hostInterval: 2,
        concurrency: 3,
        timeout: 4,
        retries: 5,
        maxCrawlDelay: 6,
      },
      scrapeUniversityDetailed: async () => result,
    }) as unknown as UniversityScraper;

  it('maps blocked and failed scrapes to module statuses', async () => {
    expect(
      await createHtmlScrapeModule(fakeScraper({ status: 'blocked-by-robots', reason: 'no' })).enrich(university)
    ).toEqual({ status: 'blocked', reason: 'no' });
    expect(await createHtmlScrapeModule(fakeScraper({ status: 'failed', reason: 'boom' })).enrich(university)).toEqual({
      status: 'failed',
      reason: 'boom',
    });
  });

  it('returns the scraped fields without the identity fields the pipeline assigns', async () => {
    const lastUpdated = new Date();
    const dataQuality = { completeness: 1, accuracy: 1, freshness: 1, reliability: 1 };
    const module = createHtmlScrapeModule(
      fakeScraper({
        status: 'enriched',
        university: { ...university, id: 'x', description: 'D', lastUpdated, dataQuality, sources: ['https://u.edu'] },
      })
    );
    const result = await module.enrich(university);
    expect(result.data).toMatchObject({ description: 'D', name: 'U', dataQuality, lastUpdated });
    expect(result.data).not.toHaveProperty('id');
    expect(result.sources).toEqual(['https://u.edu']);
    expect(module.describe?.()).toMatchObject({ userAgent: 'Bot', respectRobots: true, retries: 5, maxCrawlDelay: 6 });
  });
});
