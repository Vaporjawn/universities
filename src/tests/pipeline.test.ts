import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClassificationModule } from '../enrichment/modules';
import { publishSnapshot, runEnrichment, writeSnapshot } from '../enrichment/pipeline';
import { SqliteStore } from '../enrichment/store';
import { EnrichmentModule, Telemetry } from '../enrichment/types';
import { University } from '../types/University';

const CSV = [
  'GB,Alpha University,https://alpha.ac.uk/',
  'GB,Beta University,https://beta.ac.uk/',
  'IE,Gamma University,https://gamma.ie/',
  'IE,Gamma University,https://gamma.ie/',
  'FR,Delta University,https://delta.fr/',
].join('\n');

let folder: string;
let csv: string;
let outDir: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'universities-pipeline-'));
  csv = path.join(folder, 'base.csv');
  outDir = path.join(folder, 'out');
  fs.writeFileSync(csv, CSV);
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

/** A module that describes each university and counts its calls. */
const describing = (calls: string[] = [], overrides: Partial<EnrichmentModule> = {}): EnrichmentModule => ({
  name: 'describe',
  version: '7',
  describe: () => ({ note: 'fake' }),
  async enrich(u) {
    calls.push(u.name as string);
    return { data: { description: `About ${u.name}` }, sources: [`src:${u.name}`] };
  },
  ...overrides,
});

const run = (extra: object = {}) =>
  runEnrichment({ csv, outDir, modules: [describing()], concurrency: 2, telemetryIntervalMs: 5, ...extra });
const sha = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('runEnrichment', () => {
  it('enriches every row in CSV order and writes the dataset, telemetry and manifest', async () => {
    const result = await run({ toolVersion: '9.9.9' });
    expect(result.universities.map(u => u.name)).toEqual([
      'Alpha University',
      'Beta University',
      'Gamma University',
      'Gamma University',
      'Delta University',
    ]);
    expect(result.universities[0]).toMatchObject({
      id: 'gb-alpha-university-alpha-ac-uk',
      description: 'About Alpha University',
      country: 'United Kingdom',
      sources: ['src:Alpha University'],
    });
    expect(JSON.parse(fs.readFileSync(result.outputFile, 'utf8'))).toHaveLength(5);
    expect(result.telemetry).toMatchObject({
      state: 'completed',
      total: 5,
      completed: 5,
      enriched: 5,
      failed: 0,
      queued: 0,
      active: 0,
    });
    expect(JSON.parse(fs.readFileSync(result.telemetryFile, 'utf8')).state).toBe('completed');
    expect(fs.readdirSync(path.join(outDir, 'cache'))).toHaveLength(5);
  });

  it('gives duplicate rows distinct ids, independent of --start', async () => {
    const all = await run();
    const ids = all.universities.map(u => u.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids[3]).toBe('ie-gamma-university-gamma-ie-4');
    const later = await run({ start: 3, limit: 1 });
    expect(later.universities[0].id).toBe('ie-gamma-university-gamma-ie-4');
  });

  it('applies --country-code before --start and --limit, and --limit=0 selects nothing', async () => {
    expect((await run({ countryCode: ['ie'] })).universities.map(u => u.countryCode)).toEqual(['IE', 'IE']);
    expect((await run({ countryCode: ['GB', 'FR'], start: 1, limit: 1 })).universities.map(u => u.name)).toEqual([
      'Beta University',
    ]);
    const none = await run({ limit: 0 });
    expect(none.universities).toEqual([]);
    expect(none.telemetry).toMatchObject({ total: 0, state: 'completed' });
    expect(JSON.parse(fs.readFileSync(none.outputFile, 'utf8'))).toEqual([]);
  });

  it('runs the modules in order, each seeing the previous one’s output, and counts per module', async () => {
    const seen: (string | undefined)[] = [];
    const second: EnrichmentModule = {
      name: 'second',
      version: '1',
      async enrich(u) {
        seen.push(u.description);
        return { status: 'skipped', reason: 'demo' };
      },
    };
    const result = await run({ modules: [describing(), second, createClassificationModule()], limit: 2 });
    expect(seen).toEqual(['About Alpha University', 'About Beta University']);
    expect(result.telemetry.modules).toEqual({
      describe: { ok: 2, skipped: 0, failed: 0, blocked: 0 },
      second: { ok: 0, skipped: 2, failed: 0, blocked: 0 },
      classification: { ok: 2, skipped: 0, failed: 0, blocked: 0 },
    });
    expect(result.universities[0]).toMatchObject({ continent: 'Europe', subregion: 'Northern Europe' });
  });

  it('records a module that throws as failed, keeps the base record, and continues', async () => {
    const result = await run({
      modules: [
        describing([], {
          async enrich(u) {
            if (u.name === 'Beta University') throw new Error('kaboom');
            return { data: { description: 'ok' } };
          },
        }),
      ],
      limit: 3,
    });
    expect(result.universities).toHaveLength(3);
    expect(result.universities[1]).toMatchObject({
      name: 'Beta University',
      sources: [],
      dataQuality: { completeness: 0.2 },
    });
    expect(result.telemetry).toMatchObject({ enriched: 2, failed: 1 });
    expect(result.telemetry.failures).toEqual([
      { id: 'gb-beta-university-beta-ac-uk', name: 'Beta University', error: 'kaboom' },
    ]);
    expect(result.telemetry.modules.describe.failed).toBe(1);
    // A failed result is not cached, so it is retried on resume.
    expect(fs.existsSync(path.join(outDir, 'cache', 'gb-beta-university-beta-ac-uk.json'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'cache', 'gb-alpha-university-alpha-ac-uk.json'))).toBe(true);
  });

  it('counts robots.txt blocks per host and does not cache them', async () => {
    const blocking = describing([], {
      async enrich() {
        return { status: 'blocked', reason: 'disallowed' };
      },
    });
    const result = await run({ modules: [blocking], countryCode: ['GB'] });
    expect(result.telemetry).toMatchObject({ blockedByRobots: 2, failed: 0, enriched: 0 });
    expect(result.telemetry.robotsBlockedHosts).toEqual({ 'alpha.ac.uk': 1, 'beta.ac.uk': 1 });
    expect(result.telemetry.failures[0].error).toBe('disallowed');
    expect(fs.readdirSync(path.join(outDir, 'cache'))).toEqual([]);
    expect(result.manifest.counts.blockedByRobots).toBe(2);
  });

  it('resumes from the cache, running modules only for what is missing', async () => {
    await run({ limit: 3 });
    const calls: string[] = [];
    const resumed = await run({ resume: true, modules: [describing(calls)] });
    expect(calls).toEqual(['Gamma University', 'Delta University']);
    expect(resumed.telemetry).toMatchObject({ fromCache: 3, enriched: 2, completed: 5 });
    expect(resumed.universities[0].lastUpdated).toBeInstanceOf(Date);
    expect(resumed.universities).toHaveLength(5);
  });

  it('ignores an unreadable cache file instead of failing', async () => {
    await run({ limit: 1 });
    fs.writeFileSync(path.join(outDir, 'cache', 'gb-alpha-university-alpha-ac-uk.json'), '{ not json');
    const calls: string[] = [];
    const resumed = await run({ resume: true, limit: 1, modules: [describing(calls)] });
    expect(calls).toEqual(['Alpha University']);
    expect(resumed.telemetry.fromCache).toBe(0);
  });

  it('stops starting new universities when aborted and reports an interrupted, partial run', async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    const result = await run({
      concurrency: 1,
      signal: controller.signal,
      modules: [
        describing(calls, {
          async enrich(u) {
            calls.push(u.name as string);
            if (calls.length === 2) controller.abort();
            return { data: { description: 'x' } };
          },
        }),
      ],
      snapshot: true,
    });
    expect(calls).toHaveLength(2);
    expect(result.universities).toHaveLength(2);
    expect(result.telemetry).toMatchObject({ state: 'interrupted', completed: 2, queued: 3 });
    expect(result.manifest.interrupted).toBe(true);
    expect(result.snapshotDir).toBeUndefined();

    // Continuing finishes the rest from where it stopped.
    const rest: string[] = [];
    const resumed = await run({ resume: true, modules: [describing(rest)] });
    expect(rest).toHaveLength(3);
    expect(resumed.universities).toHaveLength(5);
  });

  it('reports progress, rate and queue figures', async () => {
    const updates: Telemetry[] = [];
    await run({ onProgress: (t: Telemetry) => updates.push(JSON.parse(JSON.stringify(t))), concurrency: 2 });
    expect(updates.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...updates.map(t => t.active))).toBeLessThanOrEqual(2);
    expect(updates[updates.length - 1]).toMatchObject({ completed: 5, queued: 0 });
    expect(updates.every(t => t.etaSeconds === null || t.etaSeconds >= 0)).toBe(true);
  });

  it('computes rate and ETA from the clock', async () => {
    let tick = 0;
    const updates: Telemetry[] = [];
    await run({
      now: () => new Date(Date.UTC(2026, 0, 1) + 1000 * tick++),
      onProgress: (t: Telemetry) => updates.push(JSON.parse(JSON.stringify(t))),
      concurrency: 1,
      limit: 2,
    });
    const middle = updates.find(t => t.completed === 1) as Telemetry;
    expect(middle.ratePerSecond).toBeGreaterThan(0);
    expect(middle.etaSeconds).toBeGreaterThan(0);
  });

  it('writes a manifest that identifies the input, the modules and the output', async () => {
    const result = await run({ toolVersion: '1.2.3', countryCode: ['GB'], limit: 2 });
    const manifest = JSON.parse(fs.readFileSync(result.manifestFile, 'utf8'));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      runId: result.runId,
      tool: { name: 'universities', version: '1.2.3', node: process.versions.node },
      interrupted: false,
      git: null,
      input: {
        file: csv,
        sha256: sha(csv),
        rows: 5,
        selected: 2,
        filters: { countryCode: ['GB'], start: 0, limit: 2 },
      },
      options: { concurrency: 2, resume: false },
      modules: [{ name: 'describe', version: '7', config: { note: 'fake' } }],
      output: { file: result.outputFile, sha256: sha(result.outputFile), count: 2 },
      counts: { fromCache: 0, enriched: 2, failed: 0, blockedByRobots: 0 },
    });
    expect(manifest.output.bytes).toBe(fs.statSync(result.outputFile).size);
    expect(result.runId).toMatch(/^\d{8}T\d{6}Z-[0-9a-f]{6}$/);
  });

  it('records the git commit when the CSV lives in a repository', async () => {
    const { execFileSync } = await import('child_process');
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', folder, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'ignore' });
    git('init', '-q');
    git('add', 'base.csv');
    git('commit', '-q', '-m', 'init');
    const result = await run({ limit: 1 });
    expect(result.manifest.git).toMatchObject({ commit: expect.stringMatching(/^[0-9a-f]{40}$/), dirty: true }); // out/ is untracked
  });

  it('fails clearly when the CSV is missing, and when the output folder cannot be created', async () => {
    await expect(run({ csv: path.join(folder, 'missing.csv') })).rejects.toThrow();
    fs.writeFileSync(path.join(folder, 'file'), '');
    await expect(run({ outDir: path.join(folder, 'file', 'sub') })).rejects.toThrow();
  });

  it('shortens very long ids so the cache file name stays valid', async () => {
    fs.writeFileSync(csv, `GB,${'Very Long Name '.repeat(30)},https://long.ac.uk/`);
    const result = await run();
    expect(result.universities[0].id.length).toBeGreaterThan(200);
    const [file] = fs.readdirSync(path.join(outDir, 'cache'));
    expect(file.length).toBeLessThan(200);
    expect((await run({ resume: true, modules: [describing()] })).telemetry.fromCache).toBe(1);
  });

  it('keeps going when storing one result fails', async () => {
    const store = {
      startRun: jest.fn(),
      finishRun: jest.fn(),
      upsert: jest.fn(() => {
        throw new Error('disk full');
      }),
    };
    const result = await run({ store: store as unknown as SqliteStore, limit: 2 });
    expect(result.telemetry.failed).toBe(2);
    expect(result.telemetry.failures[0].error).toContain('disk full');
    expect(store.finishRun).toHaveBeenCalled();
  });
});

describe('snapshots', () => {
  it('copies the outputs with SHA256SUMS that verify, and points latest.json at them', async () => {
    const result = await run({ snapshot: true });
    const dir = result.snapshotDir as string;
    expect(dir).toBe(path.join(outDir, 'snapshots', result.runId));
    expect(fs.readdirSync(dir).sort()).toEqual([
      'SHA256SUMS',
      'enriched-universities.json',
      'manifest.json',
      'telemetry.json',
    ]);
    for (const line of fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
      const [hash, name] = line.split(/\s{2}/);
      expect(sha(path.join(dir, name))).toBe(hash);
    }
    expect(JSON.parse(fs.readFileSync(path.join(outDir, 'snapshots', 'latest.json'), 'utf8'))).toEqual({
      runId: result.runId,
      path: dir,
    });
  });

  it('publishes a snapshot to another folder with a latest.json listing hashes', async () => {
    const publishDir = path.join(folder, 'published');
    const result = await run({ publishDir });
    expect(result.publishedDir).toBe(path.join(publishDir, result.runId));
    const latest = JSON.parse(fs.readFileSync(path.join(publishDir, 'latest.json'), 'utf8'));
    expect(latest.runId).toBe(result.runId);
    expect(latest.files.map((f: { name: string }) => f.name).sort()).toEqual([
      'SHA256SUMS',
      'enriched-universities.json',
      'manifest.json',
      'telemetry.json',
    ]);
    for (const file of latest.files) expect(sha(path.join(result.publishedDir as string, file.name))).toBe(file.sha256);
  });

  it('is skipped unless requested', async () => {
    const result = await run();
    expect(result.snapshotDir).toBeUndefined();
    expect(fs.existsSync(path.join(outDir, 'snapshots'))).toBe(false);
  });

  it('exposes writeSnapshot and publishSnapshot for custom workflows', async () => {
    const file = path.join(folder, 'one.json');
    fs.writeFileSync(file, '[]');
    const snapshot = await writeSnapshot(path.join(folder, 'o'), 'r1', [file]);
    expect(fs.readFileSync(path.join(snapshot, 'SHA256SUMS'), 'utf8')).toContain('  one.json');
    expect(await publishSnapshot(snapshot, path.join(folder, 'p'), 'r1')).toBe(path.join(folder, 'p', 'r1'));
  });
});

const describeStore = SqliteStore.isSupported() ? describe : describe.skip;
describeStore('SqliteStore', () => {
  const university = (overrides: Partial<University> = {}): University =>
    ({
      id: 'gb-a',
      name: 'A',
      country: 'United Kingdom',
      countryCode: 'GB',
      url: 'https://a.ac.uk',
      lastUpdated: new Date('2026-01-01'),
      dataQuality: { completeness: 0.5, accuracy: 1, freshness: 1, reliability: 1 },
      sources: [],
      ...overrides,
    }) as University;

  it('inserts, detects unchanged records, and records per-field history on update', () => {
    const store = new SqliteStore(':memory:');
    store.startRun('r1', '2026-01-01T00:00:00Z');
    expect(store.upsert(university(), 'r1', '2026-01-01T00:00:00Z').changeType).toBe('insert');
    expect(store.count()).toBe(1);

    // lastUpdated alone never counts as a change.
    expect(store.upsert(university({ lastUpdated: new Date('2027-01-01') }), 'r2')).toEqual({
      changeType: 'unchanged',
      changedFields: [],
    });

    const update = store.upsert(university({ description: 'new', city: 'Leeds' }), 'r3', '2026-03-01T00:00:00Z');
    expect(update).toEqual({ changeType: 'update', changedFields: expect.arrayContaining(['description', 'city']) });
    const history = store.history('gb-a');
    expect(history.map(h => [h.runId, h.changeType])).toEqual([
      ['r1', 'insert'],
      ['r3', 'update'],
    ]);
    expect(history[1].changes.description).toEqual({ from: undefined, to: 'new' });

    // Removing a field is a change too.
    expect(store.upsert(university({ description: 'new' }), 'r4').changedFields).toEqual(['city']);
    expect(store.get('gb-a')?.description).toBe('new');
    expect(store.get('missing')).toBeUndefined();
    store.finishRun('r1', '2026-01-02T00:00:00Z', 1);
    store.close();
  });

  it('persists across openings and gives a run a history through the pipeline', async () => {
    const file = path.join(folder, 'store.db');
    const first = new SqliteStore(file);
    await run({ store: first, limit: 2 });
    first.close();

    const second = new SqliteStore(file);
    const rerun = await run({
      store: second,
      limit: 2,
      modules: [
        describing([], {
          async enrich(u) {
            return { data: { description: `v2 ${u.name}` } };
          },
        }),
      ],
    });
    expect(second.count()).toBe(2);
    const history = second.history('gb-alpha-university-alpha-ac-uk');
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ runId: rerun.runId, changeType: 'update' });
    expect(history[1].changes.description.to).toBe('v2 Alpha University');
    second.close();
  });
});

describe('SqliteStore without node:sqlite', () => {
  it('explains what is needed', () => {
    const real = (process as unknown as { getBuiltinModule?: unknown }).getBuiltinModule;
    (process as unknown as { getBuiltinModule: unknown }).getBuiltinModule = () => undefined;
    try {
      expect(SqliteStore.isSupported()).toBe(false);
      expect(() => new SqliteStore(':memory:')).toThrow('needs Node 22.13 or newer');
    } finally {
      (process as unknown as { getBuiltinModule: unknown }).getBuiltinModule = real;
    }
  });
});
