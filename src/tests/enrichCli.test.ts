import { execFile } from 'child_process';
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';

const projectRoot = path.join(__dirname, '..', '..');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the CLI through ts-node without blocking this process, so the test's own HTTP server can answer it. */
const cli = (...args: string[]): Promise<CliResult> =>
  new Promise(resolve => {
    execFile(
      process.execPath,
      [tsNodeBin, 'src/cli.ts', ...args],
      { cwd: projectRoot, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, stdout, stderr });
      }
    );
  });

const PAGE =
  '<html><head><meta name="description" content="A fixture university used by the CLI tests, with a long enough description."></head><body><p>Founded in 1901. About 22,000 students.</p></body></html>';

let server: http.Server;
let base: string;
let robots = 'User-agent: *\nDisallow: /';
const hits: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url ?? '');
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end(robots);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE);
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => {
  hits.length = 0;
});

describe('CLI enrich <url>', () => {
  jest.setTimeout(90000);

  it('does not fetch a page robots.txt disallows, prints the base record, and exits with 3', async () => {
    robots = 'User-agent: *\nDisallow: /';
    const result = await cli('enrich', base, '--name', 'Fixture U', '--country-code', 'gb', '--interval', '0');
    expect(result.code).toBe(3);
    expect(result.stderr).toContain('disallowed by');
    expect(JSON.parse(result.stdout)).toMatchObject({
      name: 'Fixture U',
      countryCode: 'GB',
      country: 'United Kingdom',
      continent: 'Europe',
    });
    expect(hits).toEqual(['/robots.txt']);
  });

  it('enriches the page when robots.txt allows it, classifies it, and writes to --out', async () => {
    robots = 'User-agent: *\nDisallow: /admin';
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'universities-cli-')), 'u.json');
    const result = await cli('enrich', base, '--country-code', 'GB', '--interval', '0', '--out', out);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(JSON.parse(fs.readFileSync(out, 'utf8'))).toMatchObject({
      foundedYear: 1901,
      studentCount: 22000,
      size: 'large',
      subregion: 'Northern Europe',
      description: expect.stringContaining('fixture university'),
    });
    expect(hits).toEqual(['/robots.txt', '/']);
  });

  it('skips robots.txt entirely with --ignore-robots', async () => {
    robots = 'User-agent: *\nDisallow: /';
    const result = await cli('enrich', base, '--ignore-robots', '--interval', '0');
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).foundedYear).toBe(1901);
    expect(hits).toEqual(['/']);
  });

  it('rejects a bad numeric option with a readable message', async () => {
    const result = await cli('enrich', base, '--timeout', 'soon');
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('--timeout expects an integer >= 1, got "soon"');
  });

  it('exits with 1 when the page cannot be fetched', async () => {
    const result = await cli('enrich', 'http://127.0.0.1:1/', '--ignore-robots', '--retries', '1', '--timeout', '2000');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Could not enrich');
  });
});

describe('CLI enrich-all', () => {
  jest.setTimeout(90000);
  const makeCsv = (dir: string) => {
    const csv = path.join(dir, 'base.csv');
    fs.writeFileSync(csv, `GB,Fixture One,${base}one\nGB,Fixture Two,${base}two\nIE,Fixture Three,${base}three\n`);
    return csv;
  };

  it('prints its options with --help', async () => {
    const result = await cli('enrich-all', '--help');
    expect(result.code).toBe(0);
    for (const flag of ['--limit', '--country-code', '--resume', '--ignore-robots', '--snapshot', '--store']) {
      expect(result.stdout).toContain(flag);
    }
  });

  it('exits with 2 and names the problem for an unknown option or a bad value', async () => {
    const unknown = await cli('enrich-all', '--bogus');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Unknown option --bogus');
    const bad = await cli('enrich-all', '--limit=-1');
    expect(bad.code).toBe(2);
    expect(bad.stderr).toContain('--limit expects an integer >= 0');
  });

  it('enriches a country subset end to end, honours robots.txt, and then resumes from the cache', async () => {
    robots = 'User-agent: *\nDisallow: /two';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universities-all-'));
    const csv = makeCsv(dir);
    const outDir = path.join(dir, 'out');
    const args = [
      'enrich-all',
      '--csv',
      csv,
      '--out-dir',
      outDir,
      '--country-code',
      'GB',
      '--interval',
      '0',
      '--concurrency',
      '1',
      '--snapshot',
    ];

    const first = await cli(...args);
    expect(first.code).toBe(0);
    expect(first.stdout).toContain('Enriched 1, cache 0, failed 0, blocked by robots.txt 1');
    const enriched = JSON.parse(fs.readFileSync(path.join(outDir, 'enriched-universities.json'), 'utf8'));
    expect(enriched.map((u: { name: string }) => u.name)).toEqual(['Fixture One', 'Fixture Two']);
    expect(enriched[0]).toMatchObject({ foundedYear: 1901, continent: 'Europe' });
    expect(enriched[1].sources).toEqual([]);
    expect(hits.filter(h => h !== '/robots.txt').sort()).toEqual(['/one']);
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.counts).toMatchObject({ enriched: 1, blockedByRobots: 1 });
    expect(manifest.modules.map((m: { name: string }) => m.name)).toEqual(['html-scrape', 'classification']);
    expect(manifest.modules[0].config).toMatchObject({
      respectRobots: true,
      userAgent: expect.stringContaining('WorldUniversitiesBot'),
    });
    expect(fs.readdirSync(path.join(outDir, 'snapshots', manifest.runId))).toContain('SHA256SUMS');

    hits.length = 0;
    robots = 'User-agent: *\nAllow: /';
    const second = await cli(...args, '--resume');
    expect(second.stdout).toContain('Enriched 1, cache 1, failed 0, blocked by robots.txt 0');
    expect(hits.filter(h => h !== '/robots.txt')).toEqual(['/two']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts the flag syntax from the README: --limit 1 and --limit=1 select the same rows', async () => {
    robots = 'User-agent: *\nAllow: /';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universities-all-'));
    const csv = makeCsv(dir);
    const spaced = await cli(
      'enrich-all',
      '--csv',
      csv,
      '--out-dir',
      path.join(dir, 'a'),
      '--limit',
      '1',
      '--start',
      '1',
      '--interval',
      '0'
    );
    const equals = await cli(
      'enrich-all',
      '--csv',
      csv,
      '--out-dir',
      path.join(dir, 'b'),
      '--limit=1',
      '--start=1',
      '--interval=0'
    );
    expect(spaced.code).toBe(0);
    expect(equals.code).toBe(0);
    const names = (sub: string) =>
      JSON.parse(fs.readFileSync(path.join(dir, sub, 'enriched-universities.json'), 'utf8')).map(
        (u: { name: string }) => u.name
      );
    expect(names('a')).toEqual(['Fixture Two']);
    expect(names('b')).toEqual(['Fixture Two']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses --store with a clear message on a Node without node:sqlite, and works with one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universities-all-'));
    const result = await cli(
      'enrich-all',
      '--csv',
      makeCsv(dir),
      '--out-dir',
      path.join(dir, 'o'),
      '--limit=0',
      '--store',
      path.join(dir, 'h.db')
    );
    const supported = Number(process.versions.node.split('.')[0]) >= 22;
    if (supported) {
      expect(result.code).toBe(0);
      expect(fs.existsSync(path.join(dir, 'h.db'))).toBe(true);
    } else {
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('node:sqlite');
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
