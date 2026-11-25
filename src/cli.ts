#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import path from 'path';
import fs from 'fs';
import { loadBaseUniversities, toPartialUniversity } from './data/loadBase';
import { UniversityRepository } from './repository/UniversityRepository';
import { University } from './types/University';
import { ENRICH_HELP } from './enrichment/args';
import { enrichMain } from './enrichment/run';

const program = new Command();

/**
 * Read the version from package.json at runtime. Importing the JSON from src/ would change tsc's
 * inferred rootDir and move the build output to dist/src/, breaking "main" and "bin".
 */
function readPackageVersion(): string {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
}

program.name('universities').description('CLI to search and explore world universities').version(readPackageVersion());

program
  .command('list')
  .description('List universities with optional filters')
  .option('-c, --country <country>', 'Filter by country name')
  .option('-C, --country-code <code>', 'Filter by ISO country code')
  .option('-n, --name <term>', 'Filter by name fragment')
  .option('-s, --search <term>', 'Alias for --name')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('--json', 'Output as JSON')
  .action(async opts => {
    const repo = await loadRepository();
    const results = repo.search({
      name: opts.name ?? opts.search,
      country: opts.country,
      countryCode: opts.countryCode,
      limit: parseInt(opts.limit, 10),
    });

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      for (const u of results) {
        console.log(`${u.countryCode}\t${u.name}\t${u.url}`);
      }
      console.log(`\n${results.length} universities shown.`);
    }
  });

program
  .command('enrich <url>')
  .description('Enrich a single university homepage and print the result as JSON')
  .option('--name <name>', 'University name to record (default: the URL)')
  .option('--country-code <code>', 'ISO country code to record (default: XX)')
  .option('--country <country>', 'Country name to record (default: derived from the code, else Unknown)')
  .option('--timeout <ms>', 'Request timeout in milliseconds', value => parseIntegerOption(value, '--timeout', 1))
  .option('--interval <ms>', 'Minimum milliseconds between requests', value =>
    parseIntegerOption(value, '--interval', 0)
  )
  .option('--retries <n>', 'Attempts per page', value => parseIntegerOption(value, '--retries', 1))
  .option('--user-agent <text>', 'User-Agent header, also used to pick the robots.txt group')
  .option('--ignore-robots', 'Do not read robots.txt (only for sites you own or have permission to scrape)')
  .option('-o, --out <file>', 'Write the JSON to a file instead of printing it')
  .action(async (url: string, opts) => {
    // Lazy import keeps `list` and `stats` fast: the scraper pulls in the HTTP and HTML parsing dependencies.
    const { UniversityScraper, DEFAULT_SCRAPING_CONFIG } = await import('./scraper/UniversityScraper');
    const { createClassificationModule } = await import('./enrichment/modules');
    const { countryNameFromCode } = await import('./data/loadBase');
    const { mergeUniversity } = await import('./enrichment/merge');

    const countryCode = String(opts.countryCode ?? 'XX').toUpperCase();
    const scraper = new UniversityScraper({
      ...DEFAULT_SCRAPING_CONFIG,
      ...(opts.timeout !== undefined && { timeout: opts.timeout }),
      ...(opts.interval !== undefined && { interval: opts.interval }),
      ...(opts.retries !== undefined && { retries: opts.retries }),
      ...(opts.userAgent && { userAgent: opts.userAgent }),
      respectRobots: !opts.ignoreRobots,
    });
    const base = {
      url,
      name: opts.name ?? url,
      countryCode,
      country: opts.country ?? (countryCode === 'XX' ? 'Unknown' : countryNameFromCode(countryCode)),
    };
    const result = await scraper.scrapeUniversityDetailed(base);
    const classified = await createClassificationModule().enrich(result.university);
    const university = classified.data ? mergeUniversity(result.university, classified.data) : result.university;

    const json = JSON.stringify(university, null, 2);
    if (opts.out) fs.writeFileSync(opts.out, `${json}\n`);
    else console.log(json);

    if (result.status === 'blocked-by-robots') {
      console.error(`Not fetched: ${result.reason}. Use --ignore-robots only if you have permission.`);
      process.exitCode = 3;
    } else if (result.status === 'failed') {
      console.error(`Could not enrich ${url}: ${result.reason}`);
      process.exitCode = 1;
    }
  });

program
  .command('enrich-all')
  .description('Enrich many universities from the base CSV with caching, telemetry and a provenance manifest')
  .argument('[options...]', 'see the options below')
  .allowUnknownOption()
  .helpOption(false)
  .addHelpText('after', `\n${ENRICH_HELP}`)
  .action(async (rawArgs: string[]) => {
    const csv = findBaseCsv();
    process.exitCode = await enrichMain(rawArgs, {
      defaultCsv: csv,
      defaultOutDir: path.resolve(process.cwd(), 'data'),
      toolVersion: readPackageVersion(),
    });
  });

program
  .command('stats')
  .description('Show statistics about the dataset')
  .action(async () => {
    const repo = await loadRepository();
    const stats = repo.stats();
    console.log(JSON.stringify(stats, null, 2));
  });

/** Parse a whole-number option and fail with a readable message otherwise. */
function parseIntegerOption(value: string, flag: string, min: number): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min) {
    throw new InvalidArgumentError(`${flag} expects an integer >= ${min}, got "${value}"`);
  }
  return number;
}

/** Path of the bundled base CSV, whether running from `dist/` or from `src/`. */
function findBaseCsv(): string {
  const csvPath = path.join(__dirname, '..', 'world-universities.csv');
  return fs.existsSync(csvPath) ? csvPath : path.join(__dirname, '..', '..', 'world-universities.csv');
}

/** Returns `id`, or `id-<1-based row number>` when the same id was already used by an earlier row. */
function uniqueId(id: string, index: number, seenIds: Set<string>): string {
  const unique = seenIds.has(id) ? `${id}-${index + 1}` : id;
  seenIds.add(unique);
  return unique;
}

async function loadRepository(): Promise<UniversityRepository> {
  const resolvedCsv = findBaseCsv();
  const base = await loadBaseUniversities(resolvedCsv);
  const seenIds = new Set<string>();
  const universities: University[] = base.map(
    (r, index) =>
      ({
        ...toPartialUniversity(r),
        id: uniqueId(`${r.countryCode}-${r.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, index, seenIds),
        lastUpdated: new Date(),
        dataQuality: { completeness: 0.1, accuracy: 0.5, freshness: 1, reliability: 0.4 },
        sources: [r.url],
      }) as University
  );
  return new UniversityRepository(universities);
}

program.parseAsync(process.argv);
