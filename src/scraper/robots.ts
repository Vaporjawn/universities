/**
 * robots.txt support following RFC 9309: group selection by user agent, `Allow` / `Disallow` with the longest
 * match winning (`Allow` wins a tie), `*` and `$` in patterns, and the widely used `Crawl-delay` extension.
 */

/** One `User-agent` group of a robots.txt file. */
export interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  /** `Crawl-delay` in seconds, when the group has one. */
  crawlDelay?: number;
}

/** The rules that apply to one crawler after group selection. */
export interface RobotsRules {
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

/** Result of asking whether a URL may be fetched. */
export interface RobotsDecision {
  allowed: boolean;
  /** Politeness delay the site asked for, in milliseconds. */
  crawlDelayMs?: number;
  /** Why the URL is not allowed. Only set when `allowed` is false. */
  reason?: string;
}

/** What `fetchText` must return for a robots.txt request. */
export interface RobotsResponse {
  status: number;
  body: string;
}

/** Options for {@link RobotsChecker}. */
export interface RobotsCheckerOptions {
  /** Full `User-Agent` header the scraper sends, e.g. `WorldUniversitiesBot/1.0 (Educational Research)`. */
  userAgent: string;
  /** Fetches a URL as text. It may throw on network errors. It must not follow the 4xx/5xx statuses as errors. */
  fetchText: (url: string) => Promise<RobotsResponse>;
  /** How long a parsed robots.txt is reused, in milliseconds. Defaults to one hour. */
  ttlMs?: number;
  /** A `Crawl-delay` above this many milliseconds is treated as a refusal. Defaults to 30 seconds. */
  maxCrawlDelayMs?: number;
  /** Clock, replaceable in tests. */
  now?: () => number;
}

/** RFC 9309 says a crawler must parse at least 500 KiB. Anything after that is ignored. */
const MAX_ROBOTS_BYTES = 512 * 1024;

/**
 * Parse the text of a robots.txt file into groups. Unknown directives, comments and malformed lines are ignored.
 *
 * @param text - Raw robots.txt content.
 * @returns The groups in file order.
 */
export const parseRobots = (text: string): RobotsGroup[] => {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;
  let collectingAgents = false;

  for (const rawLine of text.slice(0, MAX_ROBOTS_BYTES).split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      // Consecutive User-agent lines share one group; a rule line closes the agent list.
      if (!current || !collectingAgents) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    if (!current) continue;
    collectingAgents = false;

    if (field === 'allow') {
      if (value) current.allow.push(value);
    } else if (field === 'disallow') {
      // An empty Disallow means "allow everything" and adds no rule.
      if (value) current.disallow.push(value);
    } else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = seconds;
    }
  }
  return groups;
};

/**
 * Pick the rules that apply to a crawler: every group naming it (the product token, matched case-insensitively
 * as a prefix), or the `*` groups when none does. Rules of several matching groups are combined.
 *
 * @param groups - Output of {@link parseRobots}.
 * @param userAgent - The crawler's `User-Agent` header or product token.
 * @returns The combined rules. Empty rules allow everything.
 */
export const selectRules = (groups: RobotsGroup[], userAgent: string): RobotsRules => {
  const [token] = userAgent.toLowerCase().split(/[\s/]/);
  const named = groups.filter(g => g.agents.some(agent => agent !== '*' && agent !== '' && token.startsWith(agent)));
  const chosen = named.length > 0 ? named : groups.filter(g => g.agents.includes('*'));
  const rules: RobotsRules = { allow: [], disallow: [] };
  for (const group of chosen) {
    rules.allow.push(...group.allow);
    rules.disallow.push(...group.disallow);
    if (group.crawlDelay !== undefined) {
      rules.crawlDelay = Math.max(rules.crawlDelay ?? 0, group.crawlDelay);
    }
  }
  return rules;
};

/** Turn a robots.txt path pattern (`*` wildcard, `$` end anchor) into an anchored-at-start regular expression. */
const patternToRegExp = (pattern: string): RegExp => {
  const endAnchored = pattern.endsWith('$');
  const body = endAnchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${endAnchored ? '$' : ''}`);
};

/** Length of the longest pattern that matches `target`, or -1 when none does. */
const longestMatch = (patterns: string[], target: string): number =>
  patterns.reduce(
    (best, pattern) => (patternToRegExp(pattern).test(target) ? Math.max(best, pattern.length) : best),
    -1
  );

/**
 * Decide whether rules allow fetching a path. The longest matching pattern wins and `Allow` wins a tie.
 *
 * @param rules - Rules from {@link selectRules}.
 * @param pathAndQuery - URL path plus query string, e.g. `/admissions?year=2026`.
 */
export const isPathAllowed = (rules: RobotsRules, pathAndQuery: string): boolean => {
  const target = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const allowLength = longestMatch(rules.allow, target);
  const disallowLength = longestMatch(rules.disallow, target);
  return disallowLength < 0 || allowLength >= disallowLength;
};

/** Cached outcome of one robots.txt fetch. */
interface CachedRobots {
  rules: RobotsRules;
  /** Set when robots.txt could not be read, which RFC 9309 treats as "disallow everything". */
  unreachable?: string;
  expiresAt: number;
}

/**
 * Fetches, caches and applies robots.txt files, one per origin.
 *
 * Status handling follows RFC 9309: 2xx is parsed, 4xx (including 404) means there are no restrictions, and a 5xx
 * response or a network error means the site is treated as fully disallowed until the cache entry expires.
 */
export class RobotsChecker {
  private readonly cache = new Map<string, Promise<CachedRobots>>();
  private readonly ttlMs: number;
  private readonly maxCrawlDelayMs: number;
  private readonly now: () => number;

  /** @param options - See {@link RobotsCheckerOptions}. */
  constructor(private readonly options: RobotsCheckerOptions) {
    this.ttlMs = options.ttlMs ?? 60 * 60 * 1000;
    this.maxCrawlDelayMs = options.maxCrawlDelayMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  /**
   * Check a URL against its origin's robots.txt.
   *
   * @param url - Absolute http(s) URL about to be fetched.
   * @returns The decision. A URL that cannot be parsed is not allowed.
   */
  async check(url: string): Promise<RobotsDecision> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { allowed: false, reason: `invalid URL: ${url}` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, reason: `unsupported protocol: ${parsed.protocol}` };
    }

    const entry = await this.load(parsed.origin);
    if (entry.unreachable) {
      return { allowed: false, reason: entry.unreachable };
    }
    const crawlDelayMs = entry.rules.crawlDelay === undefined ? undefined : entry.rules.crawlDelay * 1000;
    if (crawlDelayMs !== undefined && crawlDelayMs > this.maxCrawlDelayMs) {
      return {
        allowed: false,
        crawlDelayMs,
        reason: `robots.txt Crawl-delay of ${entry.rules.crawlDelay}s exceeds the ${this.maxCrawlDelayMs / 1000}s limit`,
      };
    }
    if (!isPathAllowed(entry.rules, `${parsed.pathname}${parsed.search}`)) {
      return { allowed: false, crawlDelayMs, reason: `disallowed by ${parsed.origin}/robots.txt` };
    }
    return { allowed: true, crawlDelayMs };
  }

  /** Number of origins whose robots.txt is currently cached. */
  get cachedOrigins(): number {
    return this.cache.size;
  }

  /** Return the cached robots.txt for an origin, fetching it when missing or expired. Concurrent calls share one fetch. */
  private async load(origin: string): Promise<CachedRobots> {
    const existing = this.cache.get(origin);
    if (existing) {
      const entry = await existing;
      if (entry.expiresAt > this.now()) return entry;
      // Only replace the entry we just saw; another caller may already have refreshed it.
      if (this.cache.get(origin) === existing) this.cache.delete(origin);
      return this.load(origin);
    }
    const pending = this.fetchRules(origin);
    this.cache.set(origin, pending);
    return pending;
  }

  /** Fetch and interpret `<origin>/robots.txt`. Never throws. */
  private async fetchRules(origin: string): Promise<CachedRobots> {
    const expiresAt = this.now() + this.ttlMs;
    try {
      const { status, body } = await this.options.fetchText(`${origin}/robots.txt`);
      if (status >= 200 && status < 300) {
        return { rules: selectRules(parseRobots(body), this.options.userAgent), expiresAt };
      }
      if (status >= 400 && status < 500) {
        return { rules: { allow: [], disallow: [] }, expiresAt };
      }
      return {
        rules: { allow: [], disallow: [] },
        unreachable: `${origin}/robots.txt returned HTTP ${status}`,
        expiresAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        rules: { allow: [], disallow: [] },
        unreachable: `${origin}/robots.txt could not be fetched: ${message}`,
        expiresAt,
      };
    }
  }
}

/**
 * Spaces out requests to the same host. Each call reserves the next free slot synchronously, so concurrent callers
 * queue up behind each other without any shared timer.
 */
export class HostThrottle {
  private readonly nextSlot = new Map<string, number>();

  /** @param now - Clock, replaceable in tests. @param sleep - Sleep, replaceable in tests. */
  constructor(
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))
  ) {}

  /**
   * Wait until a request to `host` may start, then reserve `gapMs` after it for the next caller.
   *
   * @param host - Host name (lower-cased internally).
   * @param gapMs - Minimum spacing between request starts to this host.
   */
  async wait(host: string, gapMs: number): Promise<void> {
    const key = host.toLowerCase();
    const now = this.now();
    const start = Math.max(now, this.nextSlot.get(key) ?? 0);
    this.nextSlot.set(key, start + Math.max(0, gapMs));
    if (start > now) await this.sleep(start - now);
  }
}
