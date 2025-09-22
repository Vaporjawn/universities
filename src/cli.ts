#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { loadBaseUniversities, toPartialUniversity } from './data/loadBase';
import { UniversityRepository } from './repository/UniversityRepository';
import { University } from './types/University';

const program = new Command();

program.name('universities').description('CLI to search and explore world universities').version('0.1.0');

program
  .command('list')
  .description('List universities with optional filters')
  .option('-c, --country <country>', 'Filter by country name')
  .option('-C, --country-code <code>', 'Filter by ISO country code')
  .option('-s, --search <term>', 'Search by name term')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('--json', 'Output as JSON')
  .action(async opts => {
    const repo = await loadRepository();
    const results = repo.search({
      name: opts.search,
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
  .description('Enrich a single university URL to show sample data fields')
  .action(async (url: string) => {
    // Lazy import to avoid loading ESM-only dependencies during normal list usage
    const { UniversityScraper } = await import('./scraper/UniversityScraper');
    const scraper = new UniversityScraper();
    const uni = await scraper.scrapeUniversity({ url, name: url, countryCode: 'XX', country: 'Unknown' });
    console.log(JSON.stringify(uni, null, 2));
  });

program
  .command('stats')
  .description('Show statistics about the dataset')
  .action(async () => {
    const repo = await loadRepository();
    const stats = repo.stats();
    console.log(JSON.stringify(stats, null, 2));
  });

async function loadRepository(): Promise<UniversityRepository> {
  const csvPath = path.join(__dirname, '..', 'world-universities.csv');
  let resolvedCsv = csvPath;
  if (!fs.existsSync(resolvedCsv)) {
    // fallback to root
    resolvedCsv = path.join(__dirname, '..', '..', 'world-universities.csv');
  }
  const base = await loadBaseUniversities(resolvedCsv);
  const universities: University[] = base.map(r =>
    ({
      ...toPartialUniversity(r),
      id: `${r.countryCode}-${r.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      lastUpdated: new Date(),
      dataQuality: { completeness: 0.1, accuracy: 0.5, freshness: 1, reliability: 0.4 },
      sources: [r.url],
    }) as University
  );
  return new UniversityRepository(universities);
}

program.parseAsync(process.argv);
