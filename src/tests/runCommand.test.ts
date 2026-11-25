import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { buildModules, enrichMain, EnrichCommandContext, formatProgress, runEnrichCommand } from '../enrichment/run';
import { parseEnrichArgs } from '../enrichment/args';
import { SqliteStore } from '../enrichment/store';
import { Telemetry } from '../enrichment/types';

let server: http.Server;
let base: string;
let robots = 'User-agent: *\nAllow: /';
let onPage: (url: string) => void = () => undefined;
let folder: string;
let context: EnrichCommandContext;
let logs: string[];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end(robots);
      return;
    }
    onPage(req.url ?? '');
    res
      .writeHead(200, { 'Content-Type': 'text/html' })
      .end('<html><body><p>Founded in 1950. 8,000 students.</p></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

beforeEach(() => {
  robots = 'User-agent: *\nAllow: /';
  onPage = () => undefined;
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'universities-run-'));
  fs.writeFileSync(path.join(folder, 'base.csv'), `GB,One,${base}one\nGB,Two,${base}two\nGB,Three,${base}three\n`);
  logs = [];
  context = {
    defaultCsv: path.join(folder, 'base.csv'),
    defaultOutDir: path.join(folder, 'out'),
    toolVersion: '3.2.1',
    log: m => logs.push(m),
  };
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const fast = ['--interval=0', '--concurrency=1'];

describe('formatProgress', () => {
  const telemetry = {
    completed: 3,
    total: 10,
    fromCache: 1,
    enriched: 1,
    failed: 1,
    blockedByRobots: 0,
    active: 2,
    queued: 5,
    ratePerSecond: 1.5,
    etaSeconds: 4,
  } as Telemetry;

  it('summarises the counters, the queue and the ETA', () => {
    expect(formatProgress(telemetry)).toBe(
      'Progress: 3/10 (cache 1, enriched 1, failed 1, robots-blocked 0; 2 active, 5 queued; 1.5/s, ETA 4s)'
    );
  });

  it('says the ETA is unknown before a rate exists', () => {
    expect(formatProgress({ ...telemetry, etaSeconds: null })).toContain('ETA unknown');
  });
});

describe('buildModules', () => {
  it('builds the scraper from the options, with robots on by default and off for --ignore-robots', async () => {
    const polite = await buildModules(
      parseEnrichArgs(['--user-agent=Bot/1', '--timeout=1234', '--retries=2', '--max-crawl-delay=99'])
    );
    expect(polite.scraper.settings).toMatchObject({
      userAgent: 'Bot/1',
      timeout: 1234,
      retries: 2,
      maxCrawlDelay: 99,
      respectRobots: true,
    });
    expect(polite.modules.map(m => m.name)).toEqual(['html-scrape', 'classification']);
    const rude = await buildModules(parseEnrichArgs(['--ignore-robots']));
    expect(rude.scraper.settings.respectRobots).toBe(false);
  });

  it('adds one module per feed and fails for a missing feed file', async () => {
    const feed = path.join(folder, 'r.csv');
    fs.writeFileSync(feed, 'source,rank,year,domain\nQS,1,2026,127.0.0.1\n');
    const { modules } = await buildModules(parseEnrichArgs([`--feed=${feed}`]));
    expect(modules.map(m => m.name)).toEqual(['html-scrape', 'classification', `feed:${feed}`]);
    await expect(buildModules(parseEnrichArgs([`--feed=${path.join(folder, 'nope.csv')}`]))).rejects.toThrow();
  });
});

describe('runEnrichCommand', () => {
  it('prints the usage for --help without running anything', async () => {
    expect(await runEnrichCommand(parseEnrichArgs(['--help']), context)).toBeUndefined();
    expect(logs.join('\n')).toContain('Usage: universities enrich-all');
    expect(fs.existsSync(path.join(folder, 'out'))).toBe(false);
  });

  it('runs end to end against a real HTTP server: rankings feed, history store, snapshot and publish', async () => {
    const feed = path.join(folder, 'rankings.csv');
    fs.writeFileSync(feed, 'source,rank,year,domain\nQS,7,2026,127.0.0.1\n');
    const store = path.join(folder, 'history.db');
    const publish = path.join(folder, 'published');
    const args = parseEnrichArgs([
      ...fast,
      `--feed=${feed}`,
      `--publish-dir=${publish}`,
      ...(SqliteStore.isSupported() ? [`--store=${store}`] : []),
    ]);

    const result = await runEnrichCommand(args, context);
    expect(result?.telemetry).toMatchObject({ state: 'completed', total: 3, enriched: 3 });
    expect(result?.manifest.tool.version).toBe('3.2.1');
    expect(result?.manifest.modules.map(m => m.name)).toEqual(['html-scrape', 'classification', `feed:${feed}`]);
    expect(result?.universities[0]).toMatchObject({
      foundedYear: 1950,
      studentCount: 8000,
      size: 'medium',
      continent: 'Europe',
      rankings: [{ source: 'QS', rank: 7, year: 2026 }],
    });
    expect(result?.universities[0].sources).toEqual(expect.arrayContaining([`${base}one`, feed]));
    expect(fs.existsSync(path.join(publish, 'latest.json'))).toBe(true);
    expect(logs.join('\n')).toMatch(/Done\. Enriched 3, cache 0, failed 0, blocked by robots\.txt 0/);
    expect(logs.join('\n')).toContain('Published:');
    expect(logs.some(l => l.startsWith('Progress: 3/3'))).toBe(true);

    if (SqliteStore.isSupported()) {
      const opened = new SqliteStore(store);
      expect(opened.count()).toBe(3);
      opened.close();
    }
  });

  it('stops cleanly on SIGINT: finishes the university in progress, reports it, and removes its signal handlers', async () => {
    const before = process.listenerCount('SIGINT');
    onPage = url => {
      if (url === '/one') process.emit('SIGINT');
    };
    const result = await runEnrichCommand(parseEnrichArgs(fast), context);
    expect(result?.telemetry).toMatchObject({ state: 'interrupted', completed: 1 });
    expect(logs.join('\n')).toContain('Stopping after the universities in progress');
    expect(logs.join('\n')).toContain('Interrupted. Enriched 1');
    expect(process.listenerCount('SIGINT')).toBe(before);
    expect(process.listenerCount('SIGTERM')).toBe(0);
  });

  it('ignores a second signal while already stopping', async () => {
    onPage = url => {
      if (url === '/one') {
        process.emit('SIGINT');
        process.emit('SIGINT');
      }
    };
    await runEnrichCommand(parseEnrichArgs(fast), context);
    expect(logs.filter(l => l.startsWith('Stopping after')).length).toBe(1);
  });

  it('uses the context defaults when no paths are given', async () => {
    const result = await runEnrichCommand(parseEnrichArgs([...fast, '--limit=1']), context);
    expect(result?.outputFile).toBe(path.join(folder, 'out', 'enriched-universities.json'));
    expect(result?.manifest.input.file).toBe(path.join(folder, 'base.csv'));
  });
});

describe('enrichMain', () => {
  it('returns 2 and prints the message for bad arguments', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await enrichMain(['--limit=-3'], context)).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('--limit expects'));
    error.mockRestore();
  });

  it('returns 0 for a normal run and for --help, and 130 when interrupted', async () => {
    expect(await enrichMain(['--help'], context)).toBe(0);
    expect(await enrichMain([...fast, '--limit=1'], context)).toBe(0);
    onPage = url => {
      if (url === '/one') process.emit('SIGINT');
    };
    expect(await enrichMain(fast, context)).toBe(130);
  });

  it('logs with console.log when the context has no logger', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await enrichMain(['--help'], { ...context, log: undefined });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Usage: universities enrich-all'));
    log.mockRestore();
  });
});
