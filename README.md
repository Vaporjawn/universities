<div align="center">

# 🎓 universities

**11,252 universities in 204 countries, ready to query, and a polite enrichment pipeline when you want more.**

A typed dataset, CLI and library for ESM and CommonJS. The base data works offline in milliseconds. Enrichment is opt-in, obeys `robots.txt`, and leaves a verifiable trail.

[![npm version](https://img.shields.io/npm/v/universities?style=flat-square&logo=npm&color=cb3837)](https://www.npmjs.com/package/universities)
[![npm downloads](https://img.shields.io/npm/dm/universities?style=flat-square&color=blue)](https://www.npmjs.com/package/universities)
[![node](https://img.shields.io/node/v/universities?style=flat-square&logo=node.js&logoColor=white&color=339933)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/universities?style=flat-square&logo=typescript&logoColor=white&color=3178c6)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/npm/l/universities?style=flat-square&color=lightgrey)](LICENSE)

[Quick start](#-quick-start) · [Library](#-use-it-as-a-library) · [Enrichment](#-enrichment) · [CLI](#-cli-reference) · [Data](#-the-data) · [Docs](docs/API.md) · [Changelog](CHANGELOG.md)

</div>

---

## ✨ At a glance

|                      |                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| 🌍 **Coverage**      | 11,252 institutions · 204 country and territory codes · all six inhabited continents, tagged by UN sub-region |
| 🇺🇸 **United States** | 3,968 institutions rebuilt from the federal **NCES IPEDS 2024** registry                                      |
| ⚡ **Zero network**  | Search, filter, sort and aggregate the bundled CSV instantly                                                  |
| 🤝 **Polite**        | `robots.txt` enforced (RFC 9309), per-host spacing, `Crawl-delay`, retries, size caps                         |
| 🔁 **Resumable**     | Per-university cache, `--resume`, Ctrl-C safe, live `telemetry.json`                                          |
| 🧾 **Verifiable**    | Provenance `manifest.json`, SHA-256 snapshots, optional SQLite change history                                 |
| 🔌 **Extensible**    | Pluggable enrichment modules and rankings/accreditation feeds                                                 |
| 📦 **Modern**        | One entry point for `import` and `require`, full TypeScript types, Node 20.19+                                |

## 🚀 Quick start

```bash
npx universities list --country-code GB --limit 3
```

```text
GB	Aga Khan University	http://www.aku.edu/
GB	American InterContinental University - London	http://www.aiuniv.edu/
GB	Anglia Ruskin University	http://www.anglia.ac.uk/

3 universities shown.
```

More ways to ask:

```bash
npx universities list --name polytechnic --limit 10      # search by name
npx universities list --country-code CA --json --limit 3 # machine-readable
npx universities stats                                   # counts by type, size, country…
```

Install it for real:

```bash
npm install universities        # library
npm install -g universities     # `universities` command on your PATH
```

## 📚 Use it as a library

One entry point, both module systems:

```ts
import { loadBaseUniversities, toPartialUniversity, UniversityRepository, inferGeography } from 'universities';
// const { … } = require('universities');   // CommonJS works too
```

```ts
import { createRequire } from 'node:module';
import path from 'node:path';
import type { University } from 'universities';

// The CSV ships inside the package.
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

repo.search({ countryCode: 'US', name: 'state', limit: 3 });
repo.stats();
inferGeography('GB'); // { continent: 'Europe', subregion: 'Northern Europe' }
```

> Only the package root is public. Deep imports like `universities/dist/…` are not supported.

<details>
<summary><b>The <code>University</code> record</b></summary>

```ts
interface University {
  id: string; // `<country>-<name>-<domain>`, lower-case; the CSV row number is appended on a collision
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
  // Filled in by enrichment:
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

Every type, enum and search option is in [`src/types/University.ts`](src/types/University.ts) and in the generated [API reference](#-documentation-site).

</details>

## 🔎 Enrichment

The base list gives you names and websites. Enrichment visits each homepage (politely) and adds what it can find:

| 🏛️ Identity                 | 📍 Place                   | 🎓 Academic                | 📈 Quality                       |
| --------------------------- | -------------------------- | -------------------------- | -------------------------------- |
| Description, motto, founded | Address, city, state       | Programs and faculties     | Completeness score per record    |
| Type (public, private, …)   | Continent and sub-region   | Enrolment and size class   | Sources listed per record        |
| Social links, contact       | Country name from the code | Rankings and accreditation | Failures and blocks in telemetry |

Try one university first:

```bash
npx universities enrich https://www.mit.edu/ --name "Massachusetts Institute of Technology" --country-code US
```

Then a small batch, then more:

```bash
npx universities enrich-all --country-code GB --limit 25 --resume
# from a checkout: npm run enrich -- --country-code GB --limit 25 --resume
```

> ⏱️ Enriching all ≈11k universities takes a long time and puts real load on real websites. Start small, read `telemetry.json`, keep concurrency low.

Everything lands in `./data` (or `--out-dir`):

```text
data/
├── cache/<id>.json            one finished result per university (powers --resume)
├── enriched-universities.json the dataset, in CSV order
├── telemetry.json             live progress, failures, robots blocks, queue, rate, ETA
├── manifest.json              provenance: inputs, hashes, modules, git commit, counts
└── snapshots/<runId>/         with --snapshot: the files above + SHA256SUMS
```

`Ctrl-C` finishes the universities in progress, writes a partial dataset and exits 130. Run again with `--resume` to carry on.

### 🤝 Respectful by default

`respectRobots` is on and implements [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309):

- `robots.txt` is read once per site (cached an hour) **before** any page is fetched.
- The group naming your user agent wins, otherwise `*`. Longest match wins; `*` and `$` work.
- **4xx** means no restrictions. **5xx or a network error** means the site is treated as closed until the cache expires.
- `Crawl-delay` becomes the minimum gap between requests to that host. A delay above `maxCrawlDelay` (30 s) skips the site.
- A blocked page is never fetched. Its record keeps the base fields, gets a low quality score, and shows up in `telemetry.json` under `robotsBlockedHosts`.
- Requests are rate-limited, spaced per host, retried with a growing delay, and capped at 1 MiB (robots.txt) and 5 MiB (pages).
- `--ignore-robots` exists for sites you own or have permission to scrape. Terms of service still apply.

Set your own identity with `--user-agent "MyResearchBot/1.0 (+https://example.org/bot)"`.

<details>
<summary><b>All <code>enrich-all</code> options</b> (<code>--flag=value</code> and <code>--flag value</code> both work)</summary>

| Option                 | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `--csv PATH`           | Base CSV (default: the bundled `world-universities.csv`).                            |
| `--out-dir DIR`        | Output folder (default `./data`; `npm run enrich` uses the repository's `data/`).    |
| `--limit N`            | Process only N universities after `--start` and `--country-code` apply (`0` = none). |
| `--start N`            | Skip the first N universities.                                                       |
| `--country-code CC,..` | Only these ISO country codes, e.g. `GB` or `GB,IE`.                                  |
| `--concurrency N`      | Universities processed at once (default 5).                                          |
| `--interval MS`        | Minimum gap between any two page requests (default 1000).                            |
| `--timeout MS`         | Request timeout (default 10000).                                                     |
| `--retries N`          | Attempts per page (default 3).                                                       |
| `--user-agent TEXT`    | `User-Agent` header; also selects the robots.txt group.                              |
| `--max-crawl-delay MS` | Skip sites whose robots.txt `Crawl-delay` is larger (default 30000).                 |
| `--ignore-robots`      | Do not read robots.txt. Only for sites you own or have permission to scrape.         |
| `--resume`             | Reuse results in `<out-dir>/cache`. Failed and robots-blocked ones are retried.      |
| `--feed FILE`          | Rankings or accreditation feed (`.csv`/`.json`); repeatable.                         |
| `--store FILE`         | Also keep results and per-field history in SQLite (Node 22.13+).                     |
| `--snapshot`           | Copy the outputs to `<out-dir>/snapshots/<runId>/` with `SHA256SUMS`.                |
| `--publish-dir DIR`    | Copy the snapshot to `DIR` and update `DIR/latest.json` (implies `--snapshot`).      |

Bad or unknown options exit with code 2 and say what was wrong.

</details>

<details>
<summary><b>🔌 Modules and feeds</b>: add rankings, accreditation, or your own data</summary>

A run executes modules in order; each sees the record built by the ones before it.

| Module           | What it adds                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `html-scrape`    | Description, contact, location, founding year, type, programs, faculties, social links, enrolment, motto.        |
| `classification` | `continent` and `subregion` from the country code; `size` from `studentCount`. Never overwrites existing values. |
| `feed:<file>`    | `rankings` and `accreditation` from a CSV or JSON feed, matched by domain first, then by country code and name.  |

Feed CSV columns: `source`, `rank`, `year` for a ranking (plus optional `category`, `rankingUrl`) and/or `accreditation` (separate values with `;`), and `domain` or both `countryCode` and `name` to say which university the row is about. A JSON feed is an array of `{ domain?, countryCode?, name?, rankings?, accreditation? }`.

```bash
npx universities enrich-all --country-code US --limit 50 --feed qs-2026.csv
```

Write your own module and hand it to `runEnrichment`:

```ts
import { runEnrichment, UniversityScraper, createHtmlScrapeModule, createClassificationModule } from 'universities';
import type { EnrichmentModule } from 'universities';

const logo: EnrichmentModule = {
  name: 'logo-guesser',
  version: '1',
  async enrich(university) {
    if (!university.domain) return { status: 'skipped', reason: 'no domain' };
    return { data: { logo: `https://${university.domain}/favicon.ico` } };
  },
};

const result = await runEnrichment({
  csv: 'world-universities.csv',
  outDir: 'data',
  countryCode: ['GB'],
  limit: 10,
  resume: true,
  modules: [createHtmlScrapeModule(new UniversityScraper({ interval: 2000 })), createClassificationModule(), logo],
  onProgress: t => console.log(`${t.completed}/${t.total} · ETA ${t.etaSeconds ?? '?'}s`),
});
```

A module that throws is recorded as failed for that university and the run continues.

</details>

<details>
<summary><b>🧾 Provenance, snapshots and change history</b></summary>

`manifest.json` records what you need to audit or reproduce a run: run id, tool and Node versions, the git commit (and whether the tree was dirty) when the CSV is in a checkout, SHA-256 of the input CSV and of the output, the filters, every module with its version and configuration, and the outcome counts.

`--snapshot` copies the outputs with a `SHA256SUMS` file you can check with `shasum -a 256 -c SHA256SUMS`. `--publish-dir` copies a finished snapshot to any folder you publish from: a static-hosting branch, a mounted bucket, or the files you attach to a GitHub release. Partial (interrupted) runs are never snapshotted.

`--store history.db` keeps the latest record of each university plus what changed on every run (`store.history(id)` returns changed fields with old and new values; unchanged records add nothing). It uses Node's built-in `node:sqlite`, so it needs **Node 22.13+** and installs no native module. On older Node it fails with a clear message and everything else still works.

</details>

## 🌍 The data

`world-universities.csv` has 11,252 institutions in 204 country and territory codes (`countryCode,name,url`, no header).

- **United States: 3,968 institutions, from NCES IPEDS 2024.** Every institution IPEDS reports as currently active and degree-granting in the 50 states and DC, with the name and website it reports. Non-degree schools (cosmetology, truck driving), closed institutions, US territories (which keep their own codes such as `PR` and `GU`) and one institution with no website (Northwestern College, IL) are left out.
- **Everything else** comes from the public world universities dataset and has not been audited against a national registry.
- **Refresh the US block:** download the latest `HDYYYY.zip` from [NCES IPEDS](https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx), unzip it, then `npm run sync:us -- --ipeds=/path/to/HDYYYY.csv` (add `--write` to apply, `--check` to test whether the file is current).
- **Check the data:** `npm run validate:data` fails on malformed rows, unknown country codes, stray whitespace, invalid URLs and unreviewed duplicates. It also runs inside `npm test`.
- **Base data as JSON:** `npm run generate:data` writes `data/base-universities.json` with ids, country names, domains, continents and sub-regions.

## ⌨️ CLI reference

| Command        | What it does                                            | Options                                                                                                                        |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `list`         | Filter and show universities                            | `--name` (alias `--search`), `--country`, `--country-code`, `--limit`, `--json`                                                |
| `enrich <url>` | Enrich one homepage and print JSON                      | `--name`, `--country-code`, `--country`, `--timeout`, `--interval`, `--retries`, `--user-agent`, `--ignore-robots`, `-o/--out` |
| `enrich-all`   | Batch enrichment with caching, telemetry and a manifest | see [all options](#-enrichment) · `universities enrich-all --help`                                                             |
| `stats`        | Aggregated statistics                                   | none                                                                                                                           |

**Exit codes.** `enrich <url>`: `0` enriched · `1` page could not be fetched · `3` skipped because robots.txt disallows it. `enrich-all`: `0` success · `2` bad options · `130` interrupted.

## 📖 Documentation site

```bash
npm run docs   # writes site/
```

Builds a static site you can host anywhere: the README, the [guide](docs/API.md), an **API reference generated from the sources** with the TypeScript compiler (every export, signature and TSDoc), and a **metrics page** (dataset counts by continent, sub-region and country, plus enrichment coverage and the last run when `data/` holds one). No scripts, nothing published to npm.

## 📦 Package formats

`npm run build:tsc` writes CommonJS to `dist/` (what `main`, `bin` and `require` use) and an ES module bundle to `dist/esm/index.mjs` (`import`). `npm run verify:dist` loads both, checks that they export the same names and exercises them. Node **20.19+** is required: the HTTP and queue dependencies are ES-module-only, which CommonJS can load from that version on.

## 🛠️ Development

```bash
git clone https://github.com/Vaporjawn/universities && cd universities
npm install
npm test            # unit + end-to-end tests with coverage thresholds (see jest.config.js)
npm run lint        # ESLint 10 flat config
npm run build:tsc   # CommonJS + ESM
npm run verify:dist # load both builds and compare exports
npm run docs        # documentation site
```

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md): fork, branch, add tests, run `npm run lint` and `npm test`, open a pull request. Scraping changes deserve extra care: keep concurrency low and never weaken the `robots.txt` handling.

### 🧭 Roadmap

Open ideas, none started:

- [ ] Live ranking and accreditation API modules (today they arrive through feed files)
- [ ] DuckDB backend for the history store (SQLite covers history today)
- [ ] Scheduled enrichment runs and publishing from CI

## ⚖️ Ethical and legal notes

- Enrichment is light, homepage-level scraping. It is opt-in.
- `robots.txt` is enforced by default; `--ignore-robots` is for sites you own or have permission to scrape. Terms of service still apply.
- Don't use the pipeline to collect personal data beyond institutional metadata.
- Run in small batches with conservative concurrency.

## 🩺 Troubleshooting

| Symptom                              | Cause                                                         | Fix                                                                  |
| ------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ERR_REQUIRE_ESM` on startup         | Node older than 20.19 cannot `require()` ES-module-only deps  | Upgrade to Node 20.19 or newer                                       |
| Many results "blocked by robots.txt" | The site disallows crawlers, or its robots.txt returned a 5xx | Expected. See `robotsBlockedHosts` in `telemetry.json`               |
| `--store` fails with `node:sqlite`   | Node older than 22.13                                         | Upgrade Node, or run without `--store`                               |
| Empty enrichment fields              | The site's markup doesn't match the heuristics                | Re-run later or inspect the page; heuristics are best-effort         |
| Slow run                             | Latency plus deliberately conservative limits                 | Raise `--concurrency` cautiously, never past what the site tolerates |

## 🔐 Security

No secrets are stored. Fetched responses are size-capped and ids never carry path characters. To report a vulnerable dependency or a misuse vector, open an issue with reproduction details, or use private disclosure for anything sensitive.

## 📄 License

[MIT](LICENSE) © Victor Williams ([@Vaporjawn](https://github.com/Vaporjawn))

## 🙏 Thanks

To the open university-data community, to NCES for IPEDS, and to everyone who files issues and sends pull requests.

[![Contributors](https://contrib.rocks/image?repo=Vaporjawn/universities)](https://github.com/Vaporjawn/universities/graphs/contributors)

<div align="center">

**If this saved you time, a ⭐ on [GitHub](https://github.com/Vaporjawn/universities) is much appreciated.**

</div>
