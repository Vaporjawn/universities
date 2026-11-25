import path from 'path';
import { DEFAULT_SCRAPING_CONFIG, UniversityScraper } from '../scraper/UniversityScraper';
import { ENRICH_HELP, EnrichArgs, parseEnrichArgs } from './args';
import { loadFeed } from './feed';
import { createClassificationModule, createFeedModule, createHtmlScrapeModule } from './modules';
import { EnrichmentRunResult, runEnrichment } from './pipeline';
import { SqliteStore } from './store';
import { EnrichmentModule, Telemetry } from './types';

/** Where a command finds its defaults. */
export interface EnrichCommandContext {
  /** CSV used when `--csv` is not given. */
  defaultCsv: string;
  /** Output folder used when `--out-dir` is not given. */
  defaultOutDir: string;
  toolVersion: string;
  /** Where messages go. Defaults to `console.log`. */
  log?: (message: string) => void;
}

/** One-line progress text for a telemetry snapshot. */
export const formatProgress = (t: Telemetry): string => {
  const eta = t.etaSeconds === null ? 'unknown' : `${t.etaSeconds}s`;
  return (
    `Progress: ${t.completed}/${t.total} (cache ${t.fromCache}, enriched ${t.enriched}, failed ${t.failed}, ` +
    `robots-blocked ${t.blockedByRobots}; ${t.active} active, ${t.queued} queued; ${t.ratePerSecond}/s, ETA ${eta})`
  );
};

/**
 * Build the standard module list for an enrichment run: homepage scrape, classification, then each feed.
 *
 * @param args - Parsed command-line options.
 * @returns The modules and the scraper they share.
 */
export const buildModules = async (
  args: EnrichArgs
): Promise<{ modules: EnrichmentModule[]; scraper: UniversityScraper }> => {
  const scraper = new UniversityScraper({
    ...DEFAULT_SCRAPING_CONFIG,
    concurrency: args.concurrency ?? DEFAULT_SCRAPING_CONFIG.concurrency,
    interval: args.interval ?? DEFAULT_SCRAPING_CONFIG.interval,
    timeout: args.timeout ?? DEFAULT_SCRAPING_CONFIG.timeout,
    retries: args.retries ?? DEFAULT_SCRAPING_CONFIG.retries,
    userAgent: args.userAgent ?? DEFAULT_SCRAPING_CONFIG.userAgent,
    maxCrawlDelay: args.maxCrawlDelay ?? DEFAULT_SCRAPING_CONFIG.maxCrawlDelay,
    respectRobots: !args.ignoreRobots,
  });
  const modules: EnrichmentModule[] = [createHtmlScrapeModule(scraper), createClassificationModule()];
  for (const file of args.feeds) {
    modules.push(createFeedModule(await loadFeed(path.resolve(file))));
  }
  return { modules, scraper };
};

/**
 * Run the batch enrichment command with already parsed options.
 *
 * Ctrl-C finishes the universities in progress, writes a partial dataset and telemetry, and exits cleanly, so the
 * run can be continued with `--resume`.
 */
export const runEnrichCommand = async (
  args: EnrichArgs,
  context: EnrichCommandContext
): Promise<EnrichmentRunResult | undefined> => {
  const log = context.log ?? console.log;
  if (args.help) {
    log(`Usage: universities enrich-all [options]\n\n${ENRICH_HELP}`);
    return undefined;
  }

  const { modules } = await buildModules(args);
  const store = args.store ? new SqliteStore(path.resolve(args.store)) : undefined;
  const controller = new AbortController();
  const onSignal = (): void => {
    if (controller.signal.aborted) return;
    log('Stopping after the universities in progress. Re-run with --resume to continue.');
    controller.abort();
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  let lastPrinted = 0;
  try {
    const result = await runEnrichment({
      csv: path.resolve(args.csv ?? context.defaultCsv),
      outDir: path.resolve(args.outDir ?? context.defaultOutDir),
      modules,
      start: args.start,
      limit: args.limit,
      countryCode: args.countryCode,
      concurrency: args.concurrency,
      resume: args.resume,
      store,
      snapshot: args.snapshot,
      publishDir: args.publishDir ? path.resolve(args.publishDir) : undefined,
      toolVersion: context.toolVersion,
      signal: controller.signal,
      onProgress: t => {
        if (t.completed - lastPrinted >= 25 || (t.completed === t.total && t.completed !== lastPrinted)) {
          lastPrinted = t.completed;
          log(formatProgress(t));
        }
      },
    });
    const t = result.telemetry;
    log(
      `${t.state === 'interrupted' ? 'Interrupted' : 'Done'}. Enriched ${t.enriched}, cache ${t.fromCache}, ` +
        `failed ${t.failed}, blocked by robots.txt ${t.blockedByRobots}. Wrote ${result.outputFile}`
    );
    log(`Manifest: ${result.manifestFile}`);
    if (result.snapshotDir) log(`Snapshot: ${result.snapshotDir}`);
    if (result.publishedDir) log(`Published: ${result.publishedDir}`);
    return result;
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    store?.close();
  }
};

/**
 * Parse `argv` and run the batch enrichment command. Parse errors are returned as a message, not thrown.
 *
 * @returns Exit code: 0 on success, 2 for bad arguments, 130 when interrupted.
 */
export const enrichMain = async (argv: string[], context: EnrichCommandContext): Promise<number> => {
  let args: EnrichArgs;
  try {
    args = parseEnrichArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }
  const result = await runEnrichCommand(args, context);
  return result?.telemetry.state === 'interrupted' ? 130 : 0;
};
