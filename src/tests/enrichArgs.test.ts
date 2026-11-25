import { ENRICH_HELP, parseEnrichArgs } from '../enrichment/args';

describe('parseEnrichArgs', () => {
  it('has sensible defaults', () => {
    expect(parseEnrichArgs([])).toEqual({
      ignoreRobots: false,
      resume: false,
      feeds: [],
      snapshot: false,
      help: false,
    });
  });

  it('accepts --flag=value and --flag value interchangeably', () => {
    const equals = parseEnrichArgs(['--limit=5', '--start=2', '--concurrency=3', '--csv=a.csv', '--out-dir=out']);
    const spaced = parseEnrichArgs([
      '--limit',
      '5',
      '--start',
      '2',
      '--concurrency',
      '3',
      '--csv',
      'a.csv',
      '--out-dir',
      'out',
    ]);
    expect(spaced).toEqual(equals);
    expect(equals).toMatchObject({ limit: 5, start: 2, concurrency: 3, csv: 'a.csv', outDir: 'out' });
  });

  it('reads the politeness options', () => {
    expect(
      parseEnrichArgs([
        '--interval=2000',
        '--timeout',
        '5000',
        '--retries=2',
        '--user-agent=Bot/1 (me)',
        '--max-crawl-delay=0',
        '--ignore-robots',
      ])
    ).toMatchObject({
      interval: 2000,
      timeout: 5000,
      retries: 2,
      userAgent: 'Bot/1 (me)',
      maxCrawlDelay: 0,
      ignoreRobots: true,
    });
  });

  it('reads country codes, upper-cases them, and accepts a list', () => {
    expect(parseEnrichArgs(['--country-code=gb']).countryCode).toEqual(['GB']);
    expect(parseEnrichArgs(['--country-code', 'gb, ie']).countryCode).toEqual(['GB', 'IE']);
    expect(() => parseEnrichArgs(['--country-code=GBR'])).toThrow('ISO 3166-1 alpha-2');
    expect(() => parseEnrichArgs(['--country-code='])).toThrow('ISO 3166-1 alpha-2');
    expect(() => parseEnrichArgs(['--country-code'])).toThrow('needs a value');
    expect(() => parseEnrichArgs(['--country-code', ','])).toThrow('ISO 3166-1 alpha-2');
  });

  it('collects repeated --feed, and --store, --resume, --snapshot', () => {
    expect(
      parseEnrichArgs(['--feed=a.csv', '--feed', 'b.json', '--store=x.db', '--resume', '--snapshot'])
    ).toMatchObject({
      feeds: ['a.csv', 'b.json'],
      store: 'x.db',
      resume: true,
      snapshot: true,
    });
  });

  it('makes --publish-dir imply --snapshot', () => {
    expect(parseEnrichArgs(['--publish-dir=pub'])).toMatchObject({ publishDir: 'pub', snapshot: true });
  });

  it('accepts --limit=0 and rejects negative, fractional, non-numeric and below-minimum numbers', () => {
    expect(parseEnrichArgs(['--limit=0']).limit).toBe(0);
    for (const bad of [
      '--limit=-1',
      '--limit=1.5',
      '--limit=abc',
      '--limit=',
      '--concurrency=0',
      '--timeout=0',
      '--limit=99999999999999999999',
    ]) {
      expect(() => parseEnrichArgs([bad])).toThrow();
    }
    expect(() => parseEnrichArgs(['--limit=-1'])).toThrow('--limit expects an integer >= 0, got "-1"');
  });

  it('rejects a missing value, including when the next token is another flag', () => {
    expect(() => parseEnrichArgs(['--csv'])).toThrow('--csv needs a value');
    expect(() => parseEnrichArgs(['--csv', '--resume'])).toThrow('--csv needs a value');
  });

  it('rejects unknown options and stray arguments', () => {
    expect(() => parseEnrichArgs(['--bogus'])).toThrow('Unknown option --bogus');
    expect(() => parseEnrichArgs(['--limit=1', 'extra'])).toThrow('Unknown option extra');
  });

  it('recognises --help and -h', () => {
    expect(parseEnrichArgs(['--help']).help).toBe(true);
    expect(parseEnrichArgs(['-h']).help).toBe(true);
    for (const flag of [
      '--limit',
      '--start',
      '--country-code',
      '--ignore-robots',
      '--resume',
      '--feed',
      '--store',
      '--snapshot',
    ]) {
      expect(ENRICH_HELP).toContain(flag);
    }
  });
});
