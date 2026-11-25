<div align="center">
<h1>
Universities
</h1>
<p><strong>Worldwide universities dataset & enrichment toolkit</strong> – instant access to a global list of institutions plus an optional, rate‑limited scraper that augments each with descriptive, academic, and classification metadata via a TypeScript API & CLI.</p>

[![GitHub repo forks](https://img.shields.io/github/forks/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Forks)](https://github.com/Vaporjawn/universities/network)&#160;[![GitHub repo stars](https://img.shields.io/github/stars/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Stars)](https://github.com/Vaporjawn/universities/stargazers)&#160;[![GitHub repo contributors](https://img.shields.io/github/contributors-anon/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Contributors)](https://github.com/Vaporjawn/universities/graphs/contributors)[![GitHub org sponsors](https://img.shields.io/github/sponsors/Vaporjawn?style=flat&logo=github&logoColor=whitesmoke&label=Sponsors)](https://github.com/sponsors/Vaporjawn)&#160;[![GitHub repo watchers](https://img.shields.io/github/watchers/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Watchers)](https://github.com/Vaporjawn/universities/watchers)&#160;[![GitHub repo size](https://img.shields.io/github/repo-size/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Repo%20Size)](https://github.com/Vaporjawn/universities/archive/refs/heads/main.zip)

[![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/typescript/main?style=flat&logo=typescript&logoColor=whitesmoke&label=TypeScript)](https://www.typescriptlang.org/)&#160;![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/prettier/main?style=flat&logo=prettier&logoColor=whitesmoke&label=Prettier)&#160;![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/eslint/main?style=flat&logo=eslint&logoColor=whitesmoke&label=ESLint)&#160;![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/jest/main?style=flat&logo=jest&logoColor=whitesmoke&label=Jest)&#160;

</div>

## Overview

`universities` is an evolving TypeScript/Node.js library and CLI that provides a structured, extensible dataset of the world's universities along with an enrichment pipeline that (optionally) visits institutional homepages to extract additional metadata.

Core goals:

1. Provide immediate, zero‑network access to a clean base list of universities (name, domains, country info, web site) sourced from the public world universities dataset, with the United States rebuilt from the federal NCES IPEDS registry (see [Data Sources & Coverage](#data-sources--coverage)).
2. Offer an enrichment layer (opt‑in) that scrapes each university homepage respectfully (rate‑limited + retries) to infer or collect:
   - Descriptions / taglines / motto
   - Contact and location hints
   - Founding year
   - Academic programs & faculties (heuristic extraction)
   - Social media links
   - Institutional classification (public/private, research, technical, community, etc. — heuristic)
   - Degree levels (undergraduate / graduate / doctoral)
   - Data quality scoring for traceability
3. Expose ergonomic programmatic APIs for search, filtering, and statistics.
4. Provide a CLI for quick querying, enrichment, and aggregated stats generation.
5. Remain transparent, reproducible, and respectful of target sites (configurable concurrency, caching, resumability, optional full‑dataset execution).

> NOTE: Full automatic enrichment of every university (≈11k) can take considerable time and should be run thoughtfully to avoid undue load on remote servers. The base dataset works instantly without enrichment.

## Data Sources & Coverage

`world-universities.csv` holds 11,252 institutions in 204 country and territory codes (`countryCode,name,url`, no header).

- **United States: 3,968 institutions, from NCES IPEDS 2024.** The US block lists every institution that IPEDS reports as currently active and degree-granting in the 50 states and DC, with the name and website the institution reports. It leaves out non-degree schools (for example cosmetology and truck-driving schools), closed institutions, US territories (which keep their own codes, such as `PR` and `GU`), and one institution with no website (Northwestern College, IL).
- **Everything else** comes from the public world universities dataset and has not been audited against a national registry.
- **Refreshing the US block:** download the latest `HDYYYY.zip` from [NCES IPEDS](https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx), unzip it, and run `npm run sync:us -- --ipeds=/path/to/HDYYYY.csv` (add `--write` to apply, `--check` to test whether the file is current).
- **Checking the data:** `npm run validate:data` fails on malformed rows, unknown country codes, stray whitespace, invalid URLs and unreviewed duplicate rows. It also runs inside `npm test`.

## Key Features

- Base dataset loader (CSV → strongly typed objects)
- In‑memory repository with searching, filtering, sorting and basic statistics
- Extensible domain model (`University`, `Program`, `Faculty`, ranking + classification enums)
- Heuristic scraper with retries, a rate‑limited queue, per‑host spacing and **robots.txt enforcement**
- Batch enrichment pipeline: per‑university caching, `--resume`, queue telemetry, a provenance manifest and optional snapshots
- Pluggable enrichment modules (homepage scrape, continent/sub‑region/size classification, rankings and accreditation feeds, or your own)
- Optional SQLite history store that records what changed for each university between runs
- CLI with subcommands: `list`, `enrich`, `enrich-all`, `stats`
- Dual ESM + CommonJS package with TypeScript declarations
- Generated documentation site (API reference, guide, dataset and enrichment metrics)

## Installation

Install locally (library usage inside another project):

```bash
npm install universities
```

Or for global CLI usage (optional):

```bash
npm install -g universities
```

After a global install you can invoke the CLI via the `universities` command (see CLI section below). When using as a dependency, import from the package entry points.

## Quick Start (CLI)

List the first 5 US universities:

```bash
universities list --country-code US --limit 5
```

Search by name fragment:

```bash
universities list --name polytechnic --limit 10
```

Output JSON instead of a table:

```bash
universities list --country-code CA --json --limit 3
```

Enrich a single university (fetch + parse homepage; robots.txt is read first):

```bash
universities enrich https://www.mit.edu/ --name "Massachusetts Institute of Technology" --country-code US
```

Enrich many universities with caching, telemetry and a provenance manifest (see [Enrichment Workflow](#enrichment-workflow)):

```bash
universities enrich-all --country-code GB --limit 25 --resume
```

View aggregated stats (counts by type, size, etc.— improves once enriched data exists):

```bash
universities stats
```

## Programmatic Usage

The package has one entry point and works from both module systems. Deep imports such as `universities/dist/...` are not part of the public API.

```ts
// ESM
import { loadBaseUniversities, toPartialUniversity, UniversityRepository } from 'universities';
// CommonJS
// const { loadBaseUniversities, toPartialUniversity, UniversityRepository } = require('universities');
```

Search the dataset (the CSV ships in the package):

```ts
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadBaseUniversities, toPartialUniversity, UniversityRepository, inferGeography } from 'universities';
import type { University } from 'universities';

const packageRoot = path.dirname(createRequire(import.meta.url).resolve('universities/package.json'));
const rows = await loadBaseUniversities(path.join(packageRoot, 'world-universities.csv'));
const repo = new UniversityRepository(
  rows.map(
    (row, i): University =>
      ({
        ...toPartialUniversity(row),
        id: `row-${i}`,
        lastUpdated: new Date(),
        dataQuality: { completeness: 0.1, accuracy: 0.5, freshness: 1, reliability: 0.4 },
        sources: [row.url],
      }) as University
  )
);
console.log(repo.search({ countryCode: 'US', name: 'state', limit: 3 }));
console.log(inferGeography('GB')); // { continent: 'Europe', subregion: 'Northern Europe' }
```

Enrich programmatically:

```ts
import { UniversityScraper, runEnrichment, createHtmlScrapeModule, createClassificationModule } from 'universities';

const scraper = new UniversityScraper({ interval: 2000 }); // robots.txt is honoured unless respectRobots is false
const result = await runEnrichment({
  csv: 'world-universities.csv',
  outDir: 'data',
  countryCode: ['GB'],
  limit: 10,
  modules: [createHtmlScrapeModule(scraper), createClassificationModule()],
  resume: true,
});
console.log(result.telemetry.enriched, result.manifestFile);
```

## Data Model (Simplified)

```ts
interface University {
  id: string; // `<country>-<name>-<domain>`, lower-case; the CSV row number is appended when two rows collide
  name: string;
  country: string;
  countryCode: string;
  url: string;
  domain?: string;
  continent?: Continent; // inferred from the country code
  subregion?: string; // UN geoscheme sub-region, e.g. "Western Europe"
  city?: string;
  state?: string;
  address?: string;
  // Enriched fields (optional until scraping):
  description?: string;
  motto?: string;
  foundedYear?: number;
  type?: UniversityType;
  size?: UniversitySize; // estimated from studentCount
  studentCount?: number;
  contact?: { email?: string; phone?: string; socialMedia?: SocialMediaLinks };
  programs?: { name: string; degreeLevel?: DegreeLevel }[];
  faculties?: { name: string }[];
  rankings?: { source: string; rank: number; year: number; category?: string; url?: string }[];
  accreditation?: string[];
  lastUpdated: Date;
  dataQuality: { completeness: number; accuracy: number; freshness: number; reliability: number };
  sources: string[]; // pages and feed files the data came from
}
```

See the full definitions in `src/types/University.ts` for exhaustive enum types, search options, stats structure, and classification helpers.

## Architecture Overview

Layered design:

1. Source Layer (`world-universities.csv`) – raw dataset.
2. Loader (`loadBaseUniversities`) – parses CSV into partial `University` objects.
3. Domain Types (`types/University.ts`) – strongly typed schema + enums + search contracts.
4. Repository (`UniversityRepository`) – in‑memory indexing, filtering, sorting, basic statistics.
5. Scraper (`UniversityScraper`) – fetch + parse homepage, extraction heuristics, data quality scoring. Rate limited by a queue, spaced per host, and gated by `robots.txt` (`scraper/robots.ts`).
6. Enrichment pipeline (`src/enrichment/`) – `runEnrichment` selects rows, runs the modules, caches, and writes the dataset, `telemetry.json` and `manifest.json`; `scripts/enrich.ts` and `universities enrich-all` are thin wrappers around it.
7. CLI (`cli.ts`) – user interface for listing, enrichment, and stats.
8. Data tooling (`src/ipeds`, `src/data/validation`, `scripts/syncUsFromIpeds.ts`, `scripts/validateData.ts`) – rebuilds the US block from IPEDS and validates the CSV.

### Scraper Heuristics (High-Level)

- Fetch with retry and a growing delay between attempts.
- Extract `<meta name="description">`, first meaningful paragraph, or tagline patterns.
- Look for contact info via regex (emails, phone numbers, address fragments).
- Infer founding year via patterns like `Established 18xx|19xx|20xx`, and enrolment from phrases like "45,000 students".
- Identify program/faculty keywords in navigation or section headers.
- Collect social links by domain match (twitter.com, facebook.com, etc.).
- Classify type (public/private/research/technical/community) by keyword/phrase heuristics.
- Score data quality based on number & diversity of successfully extracted fields.

### Performance & Respectful Crawling

- Concurrency controlled by a queue (configurable), plus at least `hostInterval` (default 1 s) between requests to the same host.
- `robots.txt` is read once per site (cached for an hour) before any page is fetched. See [robots.txt and politeness](#robotstxt-and-politeness).
- Per‑record caching prevents redundant fetches; `--resume` continues an interrupted run.

## Enrichment Workflow

Enrichment is optional and visits real websites, so run it deliberately. From a checkout use `npm run enrich -- <options>`; from an installed package use `universities enrich-all <options>`. Both run the same code and accept `--flag=value` and `--flag value`.

```bash
npm run enrich -- --country-code GB --limit 25 --concurrency 3 --resume
universities enrich-all --country-code GB --limit 25 --concurrency 3 --resume
```

| Option                 | Description                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `--csv PATH`           | Base CSV (default: the bundled `world-universities.csv`).                                  |
| `--out-dir DIR`        | Output folder (default `./data`; for `npm run enrich`, the repository's `data/`).          |
| `--limit N`            | Process only N universities after `--start` and `--country-code` are applied (`0` = none). |
| `--start N`            | Skip the first N universities.                                                             |
| `--country-code CC,..` | Only these ISO country codes, e.g. `GB` or `GB,IE`.                                        |
| `--concurrency N`      | Universities processed at once (default 5).                                                |
| `--interval MS`        | Minimum gap between any two page requests (default 1000).                                  |
| `--timeout MS`         | Request timeout (default 10000).                                                           |
| `--retries N`          | Attempts per page (default 3).                                                             |
| `--user-agent TEXT`    | `User-Agent` header; also selects the robots.txt group.                                    |
| `--max-crawl-delay MS` | Skip sites whose robots.txt `Crawl-delay` is larger (default 30000).                       |
| `--ignore-robots`      | Do not read robots.txt. Only for sites you own or have permission to scrape.               |
| `--resume`             | Reuse results already in `<out-dir>/cache`. Failed and robots‑blocked ones are retried.    |
| `--feed FILE`          | Rankings or accreditation feed (`.csv`/`.json`); repeatable.                               |
| `--store FILE`         | Also keep results and per‑field history in SQLite (Node 22.13+).                           |
| `--snapshot`           | Copy the outputs to `<out-dir>/snapshots/<runId>/` with `SHA256SUMS`.                      |
| `--publish-dir DIR`    | Copy the snapshot to `DIR` and update `DIR/latest.json` (implies `--snapshot`).            |

Ctrl‑C finishes the universities in progress, writes a partial dataset and exits with code 130; run again with `--resume` to continue.

Outputs in `<out-dir>`:

- `cache/{universityId}.json` – one complete result per university (used by `--resume`).
- `enriched-universities.json` – the aggregated dataset, in CSV order.
- `telemetry.json` – rewritten every two seconds while running: totals, cache hits, failures, robots blocks per host, queue depth, rate, ETA and per‑module counts.
- `manifest.json` – provenance for the run (see below).
- `snapshots/<runId>/` – with `--snapshot`: the three files above plus `SHA256SUMS` (check with `shasum -a 256 -c SHA256SUMS`), and `snapshots/latest.json`.

### robots.txt and politeness

`respectRobots` is on by default and implemented to RFC 9309:

- `https://<site>/robots.txt` is fetched once per origin and cached for an hour (`robotsTtl`).
- The group naming the scraper's `User-Agent` product token (`WorldUniversitiesBot` by default) applies; otherwise the `*` group. `Allow`/`Disallow` use longest‑match with `*` and `$`.
- A 4xx response (including 404) means no restrictions. A 5xx response or a network error means the whole site is treated as disallowed until the cache entry expires.
- A disallowed page is not fetched. The record keeps its base fields, gets the low data‑quality score, and is counted as `blockedByRobots` in the telemetry. `universities enrich <url>` exits with code 3 in that case.
- `Crawl-delay` is honoured as the minimum gap between requests to that host. A delay above `maxCrawlDelay` (default 30 s) makes the scraper skip the site instead.
- Only the first page of a visit is checked. Redirects to another host are followed without a second robots.txt check.

Configure it through `ScrapingConfig` (`respectRobots`, `hostInterval`, `maxCrawlDelay`, `robotsTtl`, `interval`, `userAgent`) or the options above.

### Enrichment modules

A run executes a list of modules in order; each sees the record built by the ones before it. The CLI uses `html-scrape`, then `classification`, then one module per `--feed`.

| Module           | What it adds                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `html-scrape`    | Description, contact, location, founding year, type, programs, faculties, social links, enrolment, motto.        |
| `classification` | `continent` and `subregion` from the country code; `size` from `studentCount`. Never overwrites existing values. |
| `feed:<file>`    | `rankings` and `accreditation` from a CSV or JSON feed, matched by domain first, then by country code and name.  |

Write your own by implementing `EnrichmentModule` and passing it to `runEnrichment`:

```ts
import { runEnrichment, EnrichmentModule } from 'universities';

const accreditationApi: EnrichmentModule = {
  name: 'my-accreditation-api',
  version: '1',
  async enrich(university) {
    const found = await lookup(university.domain); // your code
    return found ? { data: { accreditation: found } } : { status: 'skipped', reason: 'not listed' };
  },
};
```

A module that throws is recorded as failed for that university and the run continues. Rankings and accreditation arrive through feeds (files) rather than live APIs, so the pipeline stays offline‑reproducible.

Feed CSV columns: `source`, `rank`, `year` for a ranking (plus optional `category`, `rankingUrl`) and/or `accreditation` (separate values with `;`), and `domain` or both `countryCode` and `name` to say which university the row is about. A JSON feed is an array of `{ domain?, countryCode?, name?, rankings?, accreditation? }`.

### History store (SQLite)

`--store history.db` (or `new SqliteStore(path)`) keeps the latest record of each university and a history of what changed on every run (`store.history(id)` returns the changed fields with old and new values; unchanged records add nothing). It uses Node's built‑in `node:sqlite`, so it needs Node 22.13 or newer and installs no native module; on older Node it fails with a clear message and the rest of the tool works without it. DuckDB is not supported.

### Provenance manifest and snapshots

`manifest.json` records everything needed to reproduce or audit a run: the run id, tool and Node versions, the git commit and whether the tree was dirty (when the CSV is in a git checkout), the SHA‑256 of the input CSV and of the output, the filters used, every module with its version and configuration (user agent, intervals, `respectRobots`), and the outcome counts. `--publish-dir` copies a finished snapshot to any folder you can publish from (a static‑hosting branch, a mounted bucket, or the files you attach to a GitHub release); partial runs are never snapshotted.

## CLI Reference

| Command        | Purpose                                                    | Key Options                                                                                                                    |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `list`         | Filter & display base (or partially enriched) universities | `--name` (alias `--search`), `--country`, `--country-code`, `--limit`, `--json`                                                |
| `enrich <url>` | Enrich a single university homepage and print JSON         | `--name`, `--country-code`, `--country`, `--timeout`, `--interval`, `--retries`, `--user-agent`, `--ignore-robots`, `-o/--out` |
| `enrich-all`   | Batch enrichment with caching, telemetry and a manifest    | see [Enrichment Workflow](#enrichment-workflow); `universities enrich-all --help` lists them                                   |
| `stats`        | Show aggregated statistics                                 | None                                                                                                                           |

Exit codes of `enrich <url>`: 0 enriched, 1 the page could not be fetched, 3 skipped because robots.txt disallows it. `enrich-all` exits 0 on success, 2 for bad options and 130 when interrupted.

Examples:

```bash
universities list --name technology --limit 8
universities list --country-code GB --json --limit 5
universities enrich https://www.stanford.edu/ --country-code US
universities enrich-all --country-code IE --resume --snapshot
universities stats
```

## Documentation site

```bash
npm run docs   # writes site/
```

`site/index.html` (this README), `site/guide.html` (`docs/API.md`), `site/api.html` (every public export with its signature and TSDoc, generated from the sources with the TypeScript compiler) and `site/metrics.html` (dataset counts by continent, sub‑region and country, plus enrichment coverage and the last run when `data/` holds one). The site is static, has no scripts, and is not committed or published to npm; serve `site/` from any static host.

## Package formats

`npm run build:tsc` writes CommonJS to `dist/` (what `main`, `bin` and `require` use) and an ES module bundle to `dist/esm/index.mjs` (`import`). `npm run verify:dist` loads both, checks that they export the same names and exercises them; `npm run build:publish` runs it. Node 20.19 or newer is required: the HTTP and queue dependencies are ES‑module‑only, which CommonJS can load from that version on.

## Roadmap

Open ideas, none started:

- [ ] Live ranking and accreditation API modules (today they arrive through feed files)
- [ ] DuckDB backend for the history store (SQLite covers history today)
- [ ] Scheduled enrichment runs and publishing from CI (the CI workflows were removed on purpose)

## Testing

Run unit and integration tests:

```bash
npm test
```

Coverage reports are emitted to `coverage/`. The Jest configuration fails the run when coverage drops below the thresholds in `jest.config.js` (about 95% statements and lines, 89% branches).

## Contributing

We welcome contributions! Suggested steps:

1. Fork & create a feature branch.
2. Install dependencies: `npm install`.
3. Run `npm run build` & ensure tests pass.
4. Add or update tests for your change.
5. Follow lint & formatting (`npm run lint`, `npm run format`).
6. Submit a PR referencing any related issues.

Please consult (or propose) a `CONTRIBUTING.md` for evolving guidelines. Ethical scraping considerations and rate limiting are especially important—avoid aggressive concurrency.

## Ethical & Legal Considerations

- This project performs only light, homepage‑level scraping by default.
- robots.txt is enforced by default (see [robots.txt and politeness](#robotstxt-and-politeness)). `--ignore-robots` exists for sites you own or have permission to scrape; terms of service still apply.
- Do not use the enrichment pipeline to harvest personal data beyond institutional metadata.
- Consider running enrichment in batches with conservative concurrency settings.

## Troubleshooting

| Issue                                | Cause                                                                    | Resolution                                                      |
| ------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `ERR_REQUIRE_ESM` on startup         | Node older than 20.19 cannot `require()` the ES‑module‑only dependencies | Upgrade to Node 20.19 or newer                                  |
| Many `blocked by robots.txt` results | The site disallows crawlers, or its robots.txt returned a 5xx            | Expected; check `telemetry.json` → `robotsBlockedHosts`         |
| `--store` fails with `node:sqlite`   | Node older than 22.13                                                    | Upgrade Node, or run without `--store`                          |
| Empty enrichment fields              | Site structure variation                                                 | Re‑run later or inspect HTML; heuristics will improve over time |
| Slow enrichment run                  | Network latency / conservative concurrency                               | Increase `--concurrency` cautiously                             |

## Security

No secrets are stored. If you identify a security concern (e.g., vulnerable dependency or scraping misuse vector) please open an issue with reproduction details or use private disclosure if sensitive.

## License

This repository is distributed under the terms of the MIT License. See `LICENSE` for details.

## Acknowledgements

Inspired by the open university datasets community and contributors who maintain baseline CSV resources. Future improvements will strive for transparency, repeatability, and respectful data gathering.

---

Give a ⭐ if you find this useful and feel free to open issues for ideas or enhancements.

---

<sup>Generated documentation improvements are iterative; feel free to propose edits.</sup>

## Technologies

<img alt="TypeScript" src="https://img.shields.io/badge/typescript-%233178C6.svg?style=for-the-badge&logo=typescript&logoColor=white"/><img alt="Prettier" src="https://img.shields.io/badge/prettier-%23F7B93E.svg?style=for-the-badge&logo=prettier&logoColor=white"/><img alt="ESLint" src="https://img.shields.io/badge/eslint-%234B32C3.svg?style=for-the-badge&logo=eslint&logoColor=white"/><img alt="Jest" src="https://img.shields.io/badge/jest-%23C21325.svg?style=for-the-badge&logo=jest&logoColor=white"/><img alt="NodeJS" src="https://img.shields.io/badge/nodejs-%23339933.svg?style=for-the-badge&logo=node.js&logoColor=white"/><img alt="NPM" src="https://img.shields.io/badge/npm-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white"/>

## How To Contribute

Click on these badges to see how you might be able to help:

<div align="center" markdown="1">

[![GitHub repo Issues](https://img.shields.io/github/issues/Vaporjawn/universities?style=flat&logo=github&logoColor=red&label=Issues)](https://github.com/Vaporjawn/universities/issues)&#160;[![GitHub repo Good Issues for newbies](https://img.shields.io/github/issues/Vaporjawn/universities/good%20first%20issue?style=flat&logo=github&logoColor=green&label=Good%20First%20issues)](https://github.com/Vaporjawn/universities/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)&#160;[![GitHub Help Wanted issues](https://img.shields.io/github/issues/Vaporjawn/universities/help%20wanted?style=flat&logo=github&logoColor=b545d1&label=%22Help%20Wanted%22%20issues)](https://github.com/Vaporjawn/universities/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)[![GitHub repo PRs](https://img.shields.io/github/issues-pr/Vaporjawn/universities?style=flat&logo=github&logoColor=orange&label=PRs)](https://github.com/Vaporjawn/universities/pulls)&#160;[![GitHub repo Merged PRs](https://img.shields.io/github/issues-search/Vaporjawn/universities?style=flat&logo=github&logoColor=green&label=Merged%20PRs&query=is%3Amerged)](https://github.com/Vaporjawn/universities/pulls?q=is%3Apr+is%3Amerged)&#160;[![GitHub Help Wanted PRs](https://img.shields.io/github/issues-pr/Vaporjawn/universities/help%20wanted?style=flat&logo=github&logoColor=b545d1&label=%22Help%20Wanted%22%20PRs)](https://github.com/Vaporjawn/universities/pulls?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)

</div>

### Installation

```bash
npm install
```

### Running

```bash
npm start
```

### Testing

```bash
npm test
```

### Building

```bash
npm run build
```

## Thanks to all Contributors 💪

- **Thank you** for considering to contribute
- Feel free to submit feature requests, UI updates, bugs as issues.
- Checkout [Contribution Guidelines](https://github.com/Vaporjawn/universities/blob/master/CONTRIBUTING.md) for more information.
- Have a feature request? Feel free to create a issue for it.

[![Contributors](https://contrib.rocks/image?repo=Vaporjawn/universities)](https://github.com/Vaporjawn/universities/graphs/contributors)

## Your Support means a lot

Give a ⭐ to show support for the project.
