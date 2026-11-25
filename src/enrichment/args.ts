/** Options for `universities enrich-all` and `npm run enrich`. */
export interface EnrichArgs {
  csv?: string;
  outDir?: string;
  limit?: number;
  start?: number;
  countryCode?: string[];
  concurrency?: number;
  interval?: number;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  maxCrawlDelay?: number;
  ignoreRobots: boolean;
  resume: boolean;
  feeds: string[];
  store?: string;
  snapshot: boolean;
  publishDir?: string;
  help: boolean;
}

/** Help text shared by the CLI and the script. */
export const ENRICH_HELP = `Options (each accepts --flag=value or --flag value):
  --csv PATH             Base CSV (default: the bundled world-universities.csv)
  --out-dir DIR          Where cache/, enriched-universities.json, manifest.json and telemetry.json go (default: ./data)
  --limit N              Process only N universities after --start and --country-code are applied (0 means none)
  --start N              Skip the first N universities
  --country-code CC,...  Only these ISO country codes, e.g. GB or GB,IE
  --concurrency N        Universities processed at once (default 5)
  --interval MS          Minimum gap between any two page requests (default 1000)
  --timeout MS           Request timeout (default 10000)
  --retries N            Attempts per page (default 3)
  --user-agent TEXT      User-Agent header, also used to pick the robots.txt group
  --max-crawl-delay MS   Skip sites whose robots.txt Crawl-delay is larger (default 30000)
  --ignore-robots        Do not read robots.txt. Only for sites you own or have permission to scrape.
  --resume               Reuse results already in <out-dir>/cache
  --feed FILE            Rankings/accreditation feed (.csv or .json); repeatable
  --store FILE           Also record results and per-field history in a SQLite database (Node 22.13+)
  --snapshot             Copy the outputs to <out-dir>/snapshots/<runId>/ with SHA256SUMS
  --publish-dir DIR      Copy the snapshot to DIR and update DIR/latest.json (implies --snapshot)
  --help                 Show this text`;

const INTEGER_FLAGS: Record<string, { key: keyof EnrichArgs; min: number }> = {
  '--limit': { key: 'limit', min: 0 },
  '--start': { key: 'start', min: 0 },
  '--concurrency': { key: 'concurrency', min: 1 },
  '--interval': { key: 'interval', min: 0 },
  '--timeout': { key: 'timeout', min: 1 },
  '--retries': { key: 'retries', min: 1 },
  '--max-crawl-delay': { key: 'maxCrawlDelay', min: 0 },
};

const STRING_FLAGS: Record<string, keyof EnrichArgs> = {
  '--csv': 'csv',
  '--out-dir': 'outDir',
  '--user-agent': 'userAgent',
  '--store': 'store',
  '--publish-dir': 'publishDir',
};

/**
 * Parse enrichment flags. Both `--limit=5` and `--limit 5` work.
 *
 * @param argv - Arguments after the command name.
 * @throws On an unknown flag, a missing value, or a number that is not an integer in range.
 */
export const parseEnrichArgs = (argv: string[]): EnrichArgs => {
  const args: EnrichArgs = { ignoreRobots: false, resume: false, feeds: [], snapshot: false, help: false };
  const target = args as unknown as Record<string, unknown>;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const equals = token.indexOf('=');
    const flag = token.startsWith('--') && equals > 0 ? token.slice(0, equals) : token;
    const inline = token.startsWith('--') && equals > 0 ? token.slice(equals + 1) : undefined;

    /** The flag's value: inline, or the next argument. */
    const value = (): string => {
      const next = inline ?? argv[++i];
      if (next === undefined || (inline === undefined && next.startsWith('--'))) {
        throw new Error(`${flag} needs a value`);
      }
      return next;
    };

    if (flag === '--help' || flag === '-h') args.help = true;
    else if (flag === '--resume') args.resume = true;
    else if (flag === '--ignore-robots') args.ignoreRobots = true;
    else if (flag === '--snapshot') args.snapshot = true;
    else if (flag === '--feed') args.feeds.push(value());
    else if (flag === '--country-code') {
      const codes = value()
        .split(',')
        .map(code => code.trim().toUpperCase())
        .filter(Boolean);
      if (codes.length === 0 || codes.some(code => !/^[A-Z]{2}$/.test(code))) {
        throw new Error('--country-code expects ISO 3166-1 alpha-2 codes such as GB or GB,IE');
      }
      args.countryCode = codes;
    } else if (flag in INTEGER_FLAGS) {
      const { key, min } = INTEGER_FLAGS[flag];
      const text = value();
      const number = Number(text);
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < min) {
        throw new Error(`${flag} expects an integer >= ${min}, got "${text}"`);
      }
      target[key] = number;
    } else if (flag in STRING_FLAGS) {
      target[STRING_FLAGS[flag]] = value();
    } else {
      throw new Error(`Unknown option ${token}. Run with --help to list the options.`);
    }
  }

  if (args.publishDir) args.snapshot = true;
  return args;
};
