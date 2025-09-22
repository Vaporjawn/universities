#!/usr/bin/env ts-node
/*
 * Batch enrichment script
 * Loads base universities from CSV, performs respectful concurrent scraping with caching.
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadBaseUniversities } from '../src/data/loadBase';
import { UniversityScraper, DEFAULT_SCRAPING_CONFIG } from '../src/scraper/UniversityScraper';
import { University } from '../src/types/University';
import PQueue from 'p-queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '..', 'data', 'cache');
const OUTPUT_FILE = path.resolve(__dirname, '..', 'data', 'enriched-universities.json');

interface EnrichOptions {
  limit?: number;
  start?: number;
  concurrency?: number;
  resume?: boolean; // skip already cached
}

async function ensureDirs() {
  await fs.ensureDir(CACHE_DIR);
  await fs.ensureDir(path.dirname(OUTPUT_FILE));
}

function cachePath(id: string) {
  return path.join(CACHE_DIR, `${id}.json`);
}

async function loadCached(id: string): Promise<University | undefined> {
  const p = cachePath(id);
  if (await fs.pathExists(p)) {
    try {
      const data = await fs.readJSON(p);
      return data as University;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function saveCached(u: University) {
  const p = cachePath(u.id);
  await fs.writeJSON(p, u, { spaces: 2 });
}

async function main() {
  const args = process.argv.slice(2);
  const opts: EnrichOptions = {};
  for (const arg of args) {
    if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--start=')) opts.start = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--concurrency=')) opts.concurrency = parseInt(arg.split('=')[1], 10);
    if (arg === '--resume') opts.resume = true;
  }

  await ensureDirs();

  console.log('Loading base universities...');
  const base = await loadBaseUniversities(
    path.resolve(__dirname, '..', 'world-universities.csv').replace('/scripts', '')
  );

  const slice = base.slice(opts.start || 0, opts.limit ? (opts.start || 0) + opts.limit : undefined);
  console.log(`Total to process: ${slice.length}`);

  const scraper = new UniversityScraper({
    ...DEFAULT_SCRAPING_CONFIG,
    concurrency: opts.concurrency || DEFAULT_SCRAPING_CONFIG.concurrency,
  });

  const queue = new PQueue({ concurrency: scraper['config'].concurrency });
  const enriched: University[] = [];
  let processed = 0;
  let skipped = 0;

  for (const b of slice) {
    queue.add(async () => {
      const existing = opts.resume ? await loadCached(scraper['generateUniversityId'](b)) : undefined;
      if (existing) {
        enriched.push(existing);
        skipped++;
        return;
      }
      try {
        const full = await scraper.scrapeUniversity(b);
        enriched.push(full);
        await saveCached(full);
      } catch (e) {
        console.warn('Enrichment failed for', b.name, e);
      } finally {
        processed++;
        if (processed % 25 === 0) {
          console.log(`Progress: ${processed}/${slice.length} (skipped ${skipped})`);
        }
      }
    });
  }

  // Wait for queue
  await queue.onIdle();

  console.log('Writing enriched output...');
  await fs.writeJSON(OUTPUT_FILE, enriched, { spaces: 2 });
  console.log(`Done. Enriched: ${enriched.length}, skipped (cache): ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
