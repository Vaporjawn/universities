<div align="center">
<h1>
Universities
</h1>
<p><strong>Worldwide universities dataset & enrichment toolkit</strong> – instant access to a global list of institutions plus an optional, rate‑limited scraper that augments each with descriptive, academic, and classification metadata via a TypeScript API & CLI.</p>

[![Installation](https://github.com/Vaporjawn/universities/actions/workflows/install.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/install.js.yml)
[![Build](https://github.com/Vaporjawn/universities/actions/workflows/build.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/build.js.yml)
[![Linting](https://github.com/Vaporjawn/universities/actions/workflows/lint.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/lint.js.yml)
[![Tests](https://github.com/Vaporjawn/universities/actions/workflows/tests.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/tests.js.yml)
[![Security Scan](https://github.com/Vaporjawn/universities/actions/workflows/securityScan.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/securityScan.yml)

[![GitHub repo forks](https://img.shields.io/github/forks/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Forks)](https://github.com/Vaporjawn/universities/network)&#160;[![GitHub repo stars](https://img.shields.io/github/stars/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Stars)](https://github.com/Vaporjawn/universities/stargazers)&#160;[![GitHub repo contributors](https://img.shields.io/github/contributors-anon/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Contributors)](https://github.com/Vaporjawn/universities/graphs/contributors)[![GitHub org sponsors](https://img.shields.io/github/sponsors/Vaporjawn?style=flat&logo=github&logoColor=whitesmoke&label=Sponsors)](https://github.com/sponsors/Vaporjawn)&#160;[![GitHub repo watchers](https://img.shields.io/github/watchers/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Watchers)](https://github.com/Vaporjawn/universities/watchers)&#160;[![GitHub repo size](https://img.shields.io/github/repo-size/Vaporjawn/universities?style=flat&logo=github&logoColor=whitesmoke&label=Repo%20Size)](https://github.com/Vaporjawn/universities/archive/refs/heads/main.zip)

[![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/typescript/main?style=flat&logo=typescript&logoColor=whitesmoke&label=TypeScript)](https://www.typescriptlang.org/)&#160;![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/prettier/main?style=flat&logo=prettier&logoColor=whitesmoke&label=Prettier)&#160;![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/eslint/main?style=flat&logo=eslint&logoColor=whitesmoke&label=ESLint)&#160;![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Vaporjawn/universities/dev/jest/main?style=flat&logo=jest&logoColor=whitesmoke&label=Jest)&#160;

</div>

## Overview

`universities` is an evolving TypeScript/Node.js library and CLI that provides a structured, extensible dataset of the world's universities along with an enrichment pipeline that (optionally) visits institutional homepages to extract additional metadata.

Core goals:

1. Provide immediate, zero‑network access to a clean base list of universities (name, domains, country info, web site) sourced from the public world universities dataset.
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

> NOTE: Full automatic enrichment of every university (≈9k+) can take considerable time and should be run thoughtfully to avoid undue load on remote servers. The base dataset works instantly without enrichment.

## Key Features

- Base dataset loader (CSV → strongly typed objects)
- In‑memory repository with searching, filtering, sorting and basic statistics
- Extensible domain model (`University`, `Program`, `Faculty`, ranking + classification enums)
- Heuristic scraper with retry + rate limiting queue
- Batch enrichment script with per‑university JSON caching (resumable)
- CLI with subcommands: `list`, `enrich`, `stats`
- TypeScript declarations for consumption in TS or JS projects
- Modular architecture to allow swapping scraping strategies or adding alternate data sources later (e.g., APIs, ranking feeds)

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

Enrich a single university (fetch + parse homepage):

```bash
universities enrich https://www.mit.edu/
```

View aggregated stats (counts by type, size, etc.— improves once enriched data exists):

```bash
universities stats
```

## Programmatic Usage

```ts
import { loadBaseUniversities } from 'universities/dist/data/loadBase';
import { UniversityRepository } from 'universities/dist/repository/UniversityRepository';

async function example() {
  const base = await loadBaseUniversities();
  const repo = new UniversityRepository(base);

  const results = repo.search({ countryCode: 'US', name: 'state', limit: 20 });
  console.log(results.slice(0, 3));
  console.log(repo.stats());
}

example();
```

> The scraper (`UniversityScraper`) is intentionally decoupled and lazily imported in the CLI to avoid pulling ESM‑only dependencies when unnecessary. For programmatic enrichment you can: `import { UniversityScraper } from 'universities/dist/scraper/UniversityScraper';`

## Data Model (Simplified)

```ts
interface University {
  id: string; // Stable hash/id generation
  name: string;
  country: string;
  countryCode: string;
  alphaTwoCode?: string; // If present in source
  webPages: string[]; // One or more homepage URLs
  domains: string[]; // Domain(s)
  stateProvince?: string;
  // Enriched fields (optional until scraping):
  description?: string;
  motto?: string;
  foundingYear?: number;
  location?: string;
  contact?: { email?: string; phone?: string; address?: string };
  programs?: { name: string; degreeLevels?: string[] }[];
  faculties?: { name: string; description?: string }[];
  social?: { twitter?: string; facebook?: string; instagram?: string; linkedin?: string; youtube?: string };
  classification?: { type?: string; degreeLevel?: string[] };
  dataQuality?: { score: number; factors: string[] };
  enrichedAt?: string; // ISO timestamp when enrichment occurred
}
```

See the full definitions in `src/types/University.ts` for exhaustive enum types, search options, stats structure, and classification helpers.

## Architecture Overview

Layered design:

1. Source Layer (`world-universities.csv`) – raw dataset.
2. Loader (`loadBaseUniversities`) – parses CSV into partial `University` objects.
3. Domain Types (`types/University.ts`) – strongly typed schema + enums + search contracts.
4. Repository (`UniversityRepository`) – in‑memory indexing, filtering, sorting, basic statistics.
5. Scraper (`UniversityScraper`) – fetch + parse homepage, extraction heuristics, classification & data quality scoring (rate limited via queue).
6. Enrichment Script (`scripts/enrich.ts`) – orchestrates batch scraping with caching to `data/cache/*.json` and writes aggregated enriched dataset.
7. CLI (`cli.ts`) – user interface for listing, enrichment, and stats.

### Scraper Heuristics (High-Level)

- Fetch with retry & jitter backoff.
- Extract `<meta name="description">`, first meaningful paragraph, or tagline patterns.
- Look for contact info via regex (emails, phone numbers, address fragments).
- Infer founding year via patterns like `Established 18xx|19xx|20xx`.
- Identify program/faculty keywords in navigation or section headers.
- Collect social links by domain match (twitter.com, facebook.com, etc.).
- Classify type (public/private/research/technical/community) by keyword/phrase heuristics.
- Score data quality based on number & diversity of successfully extracted fields.

### Performance & Respectful Crawling

- Concurrency controlled by a queue (configurable).
- Optional pauses / resume; per‑record caching prevents redundant fetches.
- Future roadmap includes robots.txt parsing & adaptive politeness windows.

## Enrichment Workflow

The batch enrichment script is optional and can be executed when you purposely want deeper metadata.

```bash
npm run build
node dist/scripts/enrich.js --concurrency 3 --resume
```

Flags (planned / implemented):

| Flag                  | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| `--concurrency <n>`   | Number of parallel fetches (default modest to prevent overloading sites). |
| `--resume`            | Skip already cached universities (looks in `data/cache/`).                |
| `--limit <n>`         | (Planned) Process only the first N universities for sampling.             |
| `--country-code <CC>` | (Planned) Restrict enrichment to a country subset.                        |

Outputs:

- `data/cache/{universityId}.json` – per‑university enriched snapshot.
- `data/enriched-universities.json` – aggregated enriched dataset (written after run).

## CLI Reference

| Command        | Purpose                                                    | Key Options                                                  |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `list`         | Filter & display base (or partially enriched) universities | `--name`, `--country`, `--country-code`, `--limit`, `--json` |
| `enrich <url>` | Enrich a single university homepage                        | (none yet; uses internal defaults)                           |
| `stats`        | Show aggregated statistics                                 | None                                                         |

Examples:

```bash
universities list --name technology --limit 8
universities list --country-code GB --json --limit 5
universities enrich https://www.stanford.edu/
universities stats
```

## Roadmap

- [ ] Full dataset enrichment pipeline automation & snapshot publishing
- [ ] Dual ESM + CJS distribution build (current workaround: lazy import for ESM‑only deps)
- [ ] Robots.txt compliance & politeness policy configuration
- [ ] Advanced classification (continent/region inference, size estimation heuristics, ranking ingestion)
- [ ] Pluggable enrichment modules (e.g., ranking APIs, accreditation feeds)
- [ ] Incremental persistent store (SQLite / LiteFS / DuckDB) for historical deltas
- [ ] Comprehensive test suite (scraper mocks, repository edge cases, CLI integration)
- [ ] Documentation site (API reference, enrichment metrics dashboard)
- [ ] Progressive enrichment resume with queuing telemetry
- [ ] Data provenance & reproducibility manifest (hashes, run metadata)

## Testing

Run unit and integration tests:

```bash
npm test
```

Coverage reports are emitted to `coverage/`.

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
- Always respect target site terms of service and robots.txt (planned feature for enforcement).
- Do not use the enrichment pipeline to harvest personal data beyond institutional metadata.
- Consider running enrichment in batches with conservative concurrency settings.

## Troubleshooting

| Issue                                   | Cause                                                           | Resolution                                                      |
| --------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `ERR_REQUIRE_ESM` when using CLI `list` | ESM‑only dependency (`p-queue`) pulled into non‑enrichment path | Resolved via lazy import; update to latest version of package   |
| Empty enrichment fields                 | Site structure variation                                        | Re‑run later or inspect HTML; heuristics will improve over time |
| Slow enrichment run                     | Network latency / conservative concurrency                      | Increase `--concurrency` cautiously                             |

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

[![Installation](https://github.com/Vaporjawn/universities/actions/workflows/install.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/install.js.yml)

```bash
npm install
```

### Running

```bash
npm start
```

or

```bash
npm run dev
```

### Testing

[![Tests](https://github.com/Vaporjawn/universities/actions/workflows/tests.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/tests.js.yml)

```bash
npm test
```

### Building

[![Build](https://github.com/Vaporjawn/universities/actions/workflows/build.js.yml/badge.svg)](https://github.com/Vaporjawn/universities/actions/workflows/build.js.yml)

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
