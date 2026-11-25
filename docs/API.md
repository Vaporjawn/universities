# Universities API Guide

The package has one entry point, `universities`, for both `import` and `require`. It exposes the dataset loader, an in-memory repository, a homepage scraper that obeys `robots.txt`, an enrichment pipeline, and helpers for CSV files. The generated [API reference](api.html) lists every export with its signature; this guide explains how the pieces fit together. Run `npm run docs` in a checkout to build both.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [UniversityScraper](#universityscraper)
- [robots.txt](#robotstxt)
- [Enrichment pipeline](#enrichment-pipeline)
- [Modules and feeds](#modules-and-feeds)
- [History store](#history-store)
- [Geography and size helpers](#geography-and-size-helpers)
- [Data processing](#data-processing)
- [Errors](#errors)
- [Best practices](#best-practices)

## Installation

```bash
npm install universities
```

Node 20.19 or newer is required. The `--store` history feature needs Node 22.13 or newer.

## Quick Start

```typescript
import { UniversityScraper } from 'universities';

const scraper = new UniversityScraper();
const result = await scraper.scrapeUniversityDetailed({
  name: 'Massachusetts Institute of Technology',
  countryCode: 'US',
  country: 'United States',
  url: 'https://www.mit.edu/',
});

console.log(result.status); // 'enriched' | 'failed' | 'blocked-by-robots'
console.log(result.university.foundedYear, result.university.studentCount);
```

## UniversityScraper

```text
new UniversityScraper(config?: Partial<ScrapingConfig>)
```

Any option you leave out takes its default from `DEFAULT_SCRAPING_CONFIG`.

| Option          | Default                                           | Meaning                                                                   |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `concurrency`   | `5`                                               | Pages fetched at once.                                                    |
| `interval`      | `1000`                                            | Minimum milliseconds between any two requests (one request per interval). |
| `hostInterval`  | `1000`                                            | Minimum milliseconds between requests to the same host.                   |
| `timeout`       | `10000`                                           | Request timeout in milliseconds.                                          |
| `retries`       | `3`                                               | Attempts per page, with a growing delay between them.                     |
| `userAgent`     | `WorldUniversitiesBot/1.0 (Educational Research)` | Sent as `User-Agent`; its product token selects the robots.txt group.     |
| `respectRobots` | `true`                                            | Read robots.txt and skip disallowed pages.                                |
| `maxCrawlDelay` | `30000`                                           | A robots.txt `Crawl-delay` above this many milliseconds skips the site.   |
| `robotsTtl`     | `3600000`                                         | How long a fetched robots.txt is reused, in milliseconds.                 |

### Methods

`scrapeUniversity(base: Partial<University>): Promise<University>` fetches `base.url`, extracts what it can and returns the base record merged with the findings. It does not throw for a page that fails or is disallowed: the base record comes back with a low `dataQuality` and no `sources`. It throws only when `base.url` is missing.

`scrapeUniversityDetailed(base): Promise<ScrapeResult>` does the same and also tells you what happened:

```typescript
interface ScrapeResult {
  university: University;
  status: 'enriched' | 'failed' | 'blocked-by-robots';
  reason?: string; // why it was not enriched
}
```

`stats` returns running totals (`enriched`, `failed`, `blockedByRobots`, `pageRequests`, `retries`), `settings` the effective configuration, `getQueueStatus()` the queue depth, and `pause()`, `resume()` and `clear()` control the queue.

What is extracted: description, contact (email, phone, social links), address, city and state, founding year, enrolment (`studentCount`, from phrases such as "45,000 students"), type, programs, faculties and motto.

## robots.txt

With `respectRobots` on (the default) the scraper fetches `<origin>/robots.txt` before the first page of a site and applies RFC 9309:

- The group naming your user agent's product token wins; otherwise the `*` group. `Allow` and `Disallow` use the longest matching pattern (`*` and `$` supported), and `Allow` wins a tie.
- 4xx (including 404): no restrictions. 5xx or a network error: the site counts as fully disallowed until the cached entry expires.
- `Crawl-delay` becomes the minimum gap between requests to that host. A delay above `maxCrawlDelay` skips the site.

The pieces are exported if you need them alone:

```typescript
import { parseRobots, selectRules, isPathAllowed, RobotsChecker } from 'universities';

const rules = selectRules(parseRobots('User-agent: *\nDisallow: /private'), 'MyBot/1.0');
isPathAllowed(rules, '/private/x'); // false
isPathAllowed(rules, '/admissions'); // true

const checker = new RobotsChecker({
  userAgent: 'MyBot/1.0',
  fetchText: async url => {
    const response = await fetch(url);
    return { status: response.status, body: await response.text() };
  },
});
const decision = await checker.check('https://example.edu/admissions');
// { allowed: true, crawlDelayMs?: number } or { allowed: false, reason: '...' }
```

Only the first page of a visit is checked; a redirect to another host is followed without a second check.

## Enrichment pipeline

`runEnrichment` selects rows from the base CSV, runs a list of modules over each, caches the results and writes the dataset, telemetry and a provenance manifest.

```typescript
import { runEnrichment, UniversityScraper, createHtmlScrapeModule, createClassificationModule } from 'universities';

const scraper = new UniversityScraper({ interval: 2000 });
const result = await runEnrichment({
  csv: 'world-universities.csv',
  outDir: 'data',
  countryCode: ['GB', 'IE'], // applied before start and limit
  start: 0,
  limit: 50,
  concurrency: 3,
  resume: true, // reuse outDir/cache; failed and robots-blocked ones are retried
  snapshot: true, // copy the outputs to outDir/snapshots/<runId>/ with SHA256SUMS
  modules: [createHtmlScrapeModule(scraper), createClassificationModule()],
  onProgress: t => console.log(`${t.completed}/${t.total}, ETA ${t.etaSeconds ?? '?'}s`),
});
```

Everything is written under `outDir`: `cache/<id>.json`, `enriched-universities.json`, `telemetry.json`, `manifest.json` and, with `snapshot` or `publishDir`, `snapshots/`. A failure for one university never throws: it is counted in `result.telemetry` (`failed`, `blockedByRobots`, `failures`, `robotsBlockedHosts`, per-module `modules`). Abort with an `AbortSignal` (`signal`) to stop after the universities in progress; the result then has `telemetry.state === 'interrupted'`, no snapshot is written, and `resume: true` continues later.

`manifest.json` records the run id, tool and Node versions, the git commit (when the CSV is in a git checkout), SHA-256 hashes of the input and output, the filters, each module's name, version and configuration, and the outcome counts. Ids are assigned across the whole CSV before any filter, so `start` and `countryCode` never change an id; two rows that would share an id get their CSV row number appended.

The same code runs from the command line: `universities enrich-all --help`, or `npm run enrich -- --help` in a checkout.

## Modules and feeds

A module is an object with a `name`, a `version` and an `enrich(university)` method that returns `{ data?, status?, reason?, sources? }`. Modules run in order and each sees the record built so far. Throwing marks the module failed for that university; the run continues.

```typescript
import type { EnrichmentModule } from 'universities';

const logo: EnrichmentModule = {
  name: 'logo-guesser',
  version: '1',
  async enrich(university) {
    if (!university.domain) return { status: 'skipped', reason: 'no domain' };
    return { data: { logo: `https://${university.domain}/favicon.ico` } };
  },
};
```

Built-in modules: `createHtmlScrapeModule(scraper)`, `createClassificationModule()` (continent, sub-region and size, never overwriting existing values) and `createFeedModule(feed)`. Feeds add rankings and accreditation from a file:

```typescript
import { loadFeed, createFeedModule } from 'universities';

const feed = await loadFeed('qs-2026.csv'); // columns: source,rank,year,domain[,category,rankingUrl,accreditation]
const module = createFeedModule(feed);
```

A university is matched by `domain` first, then by country code plus a normalised name (case, accents, punctuation and a leading "the" are ignored). A JSON feed is an array of `{ domain?, countryCode?, name?, rankings?, accreditation? }`. `mergeUniversity(base, patch)` is the merge the pipeline uses: it combines `rankings` (by source, year and category), `accreditation` and `sources` without duplicates and lets other defined fields replace the old value.

## History store

```typescript
import { SqliteStore } from 'universities';

const store = new SqliteStore('history.db'); // throws on Node older than 22.13
await runEnrichment({ /* ... */ store });
store.history('gb-university-of-leeds-leeds-ac-uk'); // [{ runId, changedAt, changeType, changes: { field: { from, to } } }]
store.close();
```

Each run upserts every record. A record that did not change adds nothing; `lastUpdated` alone never counts as a change. `SqliteStore.isSupported()` tells you whether this Node can open one.

## Geography and size helpers

```typescript
import { inferGeography, estimateSize } from 'universities';

inferGeography('gb'); // { continent: 'Europe', subregion: 'Northern Europe' }
inferGeography('ZZ'); // undefined
estimateSize(20000); // 'large'
```

`inferGeography` uses the UN geoscheme and knows every country code in the dataset. `estimateSize` uses the thresholds documented on `UniversitySize`: under 1,000, 1,000 to 5,000, 5,000 to 15,000, 15,000 to 30,000 and over 30,000 students.

## Data processing

```typescript
import {
  loadBaseUniversities,
  loadUniversitiesFromCSV,
  saveUniversitiesToCSV,
  filterUniversities,
  searchUniversities,
  validateUniversityData,
} from 'universities';

const rows = await loadBaseUniversities('world-universities.csv'); // headerless: countryCode,name,url

await saveUniversitiesToCSV(universities, 'export.csv'); // adds continent and subregion columns
const loaded = await loadUniversitiesFromCSV('export.csv');

filterUniversities(loaded, { country: 'France', type: 'public', foundedYearRange: { min: 1800 } });
searchUniversities(loaded, 'technology');
validateUniversityData({ name: 'X', country: 'France', countryCode: 'FR', url: 'https://x.fr' }); // throws on bad input
```

`UniversityRepository` adds searching, sorting, pagination and statistics over an array of `University` objects (`search`, `stats`, `getAll`, `setData`).

## Errors

`ScrapingError`, `ValidationError` and `NetworkError` are exported for your own code. The scraper reports page failures through `ScrapeResult.status` and `reason` rather than throwing them. `loadUniversitiesFromCSV` and `saveUniversitiesToCSV` throw an `Error` whose `cause` is the original error.

## Best practices

- Leave `respectRobots` on. Use `--ignore-robots` or `respectRobots: false` only for sites you own or have permission to scrape.
- Identify yourself: set `userAgent` to something with a contact URL, for example `MyResearchBot/1.0 (+https://example.org/bot)`.
- Start small (`limit: 25`), look at `telemetry.json`, then widen. Keep `concurrency` low; the per-host spacing protects each site, not the network.
- Use `resume` for long runs and `--snapshot` when you want a dataset you can verify later with `shasum -a 256 -c SHA256SUMS`.
- Record `manifest.json` next to any dataset you publish.

## Support

Open an issue at https://github.com/Vaporjawn/universities/issues.

## License

MIT. See `LICENSE`.
