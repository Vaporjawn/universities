import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadBaseUniversities, toPartialUniversity } from '../data/loadBase';
import { buildBaseUniversities } from '../data/baseUniversities';
import { DataQuality, University } from '../types/University';
import { gitState, RunManifest, sha256File, writeJsonAtomic } from './manifest';
import { mergeUniversity } from './merge';
import { SqliteStore } from './store';
import { EnrichmentModule, FailureRecord, ModuleCounts, ModuleStatus, Telemetry } from './types';

/** Options for {@link runEnrichment}. */
export interface EnrichmentRunOptions {
  /** Base CSV with `countryCode,name,url` rows. */
  csv: string;
  /** Folder for `cache/`, `enriched-universities.json`, `manifest.json`, `telemetry.json` and `snapshots/`. */
  outDir: string;
  /** Modules to run, in order. */
  modules: EnrichmentModule[];
  /** Skip the first N rows of the (country-filtered) CSV. */
  start?: number;
  /** Process at most N rows. `0` processes none. */
  limit?: number;
  /** Only these ISO country codes. */
  countryCode?: string[];
  /** Universities processed at once. Default 5. */
  concurrency?: number;
  /** Reuse cached results from a previous run. Failed and robots-blocked universities are retried. */
  resume?: boolean;
  /** Record results and history here. The caller opens and closes it. */
  store?: SqliteStore;
  /** Copy the outputs to `<outDir>/snapshots/<runId>/` after a complete run. */
  snapshot?: boolean;
  /** Also copy the snapshot here and update `<publishDir>/latest.json`. Implies `snapshot`. */
  publishDir?: string;
  /** Recorded in the manifest. */
  toolVersion?: string;
  /** Called after every university and on a timer with the current telemetry. */
  onProgress?: (telemetry: Telemetry) => void;
  /** Aborting stops starting new universities, lets running ones finish, and writes a partial result. */
  signal?: AbortSignal;
  /** How often `telemetry.json` is rewritten while running. Default 2000 ms. */
  telemetryIntervalMs?: number;
  /** Clock, replaceable in tests. */
  now?: () => Date;
}

/** What {@link runEnrichment} returns. */
export interface EnrichmentRunResult {
  runId: string;
  universities: University[];
  telemetry: Telemetry;
  manifest: RunManifest;
  outputFile: string;
  manifestFile: string;
  telemetryFile: string;
  /** Set when a snapshot was written. */
  snapshotDir?: string;
  /** Set when the snapshot was copied to `publishDir`. */
  publishedDir?: string;
}

/** Placeholder quality for a record no module could enrich, equal to the scraper's own failure score. */
const UNENRICHED_QUALITY: DataQuality = { completeness: 0.2, accuracy: 0.5, freshness: 1.0, reliability: 0.3 };

/** Failures kept in telemetry. */
const MAX_FAILURES = 200;

/** Cache file for an id. Very long ids fall back to a hash so the name stays within file-system limits. */
const cacheFile = (outDir: string, id: string): string => {
  const name = id.length > 180 ? `${id.slice(0, 120)}-${crypto.createHash('sha1').update(id).digest('hex')}` : id;
  const cacheDir = path.resolve(outDir, 'cache');
  const file = path.resolve(cacheDir, `${name}.json`);
  // Belt and braces: ids are already reduced to [a-z0-9-], but a cache path must never leave the cache folder.
  if (path.dirname(file) !== cacheDir) throw new Error(`Refusing cache path outside ${cacheDir}: ${id}`);
  return file;
};

/** Read a cached record, or `undefined` when missing or unreadable. */
const readCache = async (file: string): Promise<University | undefined> => {
  try {
    const record = JSON.parse(await fs.promises.readFile(file, 'utf8')) as University;
    record.lastUpdated = new Date(record.lastUpdated);
    return record;
  } catch {
    return undefined;
  }
};

/** Generate a sortable run id such as `20261124T195900Z-3fa9c1`. */
const makeRunId = (now: Date): string =>
  `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}-${crypto.randomBytes(3).toString('hex')}`;

/** A fresh counter set for a module. */
const emptyCounts = (): ModuleCounts => ({ ok: 0, skipped: 0, failed: 0, blocked: 0 });

/**
 * Run the enrichment pipeline over the base CSV: select rows, enrich each with the modules, cache results, then
 * write the dataset, telemetry and a provenance manifest (and optionally a snapshot and a store update).
 *
 * @param options - See {@link EnrichmentRunOptions}.
 * @returns The enriched universities and the paths of everything written.
 * @throws When the CSV cannot be read or the output folder cannot be written. Failures of single universities
 * never throw: they are counted in the telemetry.
 */
export const runEnrichment = async (options: EnrichmentRunOptions): Promise<EnrichmentRunResult> => {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const runId = makeRunId(startedAt);
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const start = options.start ?? 0;

  const all = await loadBaseUniversities(options.csv);
  const wanted = options.countryCode ? new Set(options.countryCode.map(c => c.toUpperCase())) : undefined;
  const filtered = all
    .map((record, row) => ({ record, row }))
    .filter(({ record }) => !wanted || wanted.has(record.countryCode.toUpperCase()));
  const selected = filtered.slice(start, options.limit !== undefined ? start + options.limit : undefined);

  // Ids name the cache files, so they must be unique and must not depend on --start or --country-code:
  // they are assigned over the whole CSV first.
  const ids = buildBaseUniversities(all).map(u => u.id);
  const items = selected.map(({ record, row }) => ({
    partial: { ...toPartialUniversity(record), id: ids[row] },
    id: ids[row],
  }));

  await fs.promises.mkdir(path.join(options.outDir, 'cache'), { recursive: true });
  const telemetryFile = path.join(options.outDir, 'telemetry.json');
  const outputFile = path.join(options.outDir, 'enriched-universities.json');
  const manifestFile = path.join(options.outDir, 'manifest.json');

  const results: (University | undefined)[] = new Array(items.length).fill(undefined);
  const failures: FailureRecord[] = [];
  const blockedHosts: Record<string, number> = {};
  const moduleCounts: Record<string, ModuleCounts> = Object.fromEntries(
    options.modules.map(m => [m.name, emptyCounts()])
  );
  const telemetry: Telemetry = {
    runId,
    state: 'running',
    startedAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
    total: items.length,
    completed: 0,
    fromCache: 0,
    enriched: 0,
    failed: 0,
    blockedByRobots: 0,
    queued: items.length,
    active: 0,
    ratePerSecond: 0,
    etaSeconds: null,
    modules: moduleCounts,
    failures,
    robotsBlockedHosts: blockedHosts,
  };

  /** Refresh derived figures and notify the listener. */
  const refresh = (): void => {
    const current = now();
    const elapsedSeconds = (current.getTime() - startedAt.getTime()) / 1000;
    telemetry.updatedAt = current.toISOString();
    telemetry.ratePerSecond = elapsedSeconds > 0 ? Number((telemetry.completed / elapsedSeconds).toFixed(3)) : 0;
    const remaining = telemetry.total - telemetry.completed;
    telemetry.etaSeconds = telemetry.ratePerSecond > 0 ? Math.round(remaining / telemetry.ratePerSecond) : null;
    options.onProgress?.(telemetry);
  };

  let writing: Promise<void> = Promise.resolve();
  /** Queue a telemetry write; writes run one after another so a slow disk cannot reorder them. */
  const flushTelemetry = (): Promise<void> => {
    refresh();
    const snapshot = JSON.parse(JSON.stringify(telemetry));
    writing = writing.then(() => writeJsonAtomic(telemetryFile, snapshot)).catch(() => undefined);
    return writing;
  };
  const timer = setInterval(() => void flushTelemetry(), options.telemetryIntervalMs ?? 2000);
  timer.unref();

  options.store?.startRun(runId, telemetry.startedAt);

  /** Enrich one item with every module and store the result. */
  const processItem = async (index: number): Promise<void> => {
    const { partial, id } = items[index];
    let record: Partial<University> | undefined;
    let fromCache = false;

    const cached = options.resume ? await readCache(cacheFile(options.outDir, id)) : undefined;
    if (cached) {
      record = cached;
      fromCache = true;
    } else {
      record = partial;
      const problems: { status: ModuleStatus; reason?: string }[] = [];
      for (const module of options.modules) {
        let status: ModuleStatus;
        let reason: string | undefined;
        try {
          const result = await module.enrich(record);
          status = result.status ?? 'ok';
          ({ reason } = result);
          if (result.data) record = mergeUniversity(record, result.data);
          if (result.sources?.length) record = mergeUniversity(record, { sources: result.sources });
        } catch (error) {
          status = 'failed';
          reason = error instanceof Error ? error.message : String(error);
        }
        moduleCounts[module.name][status]++;
        if (status === 'failed' || status === 'blocked') problems.push({ status, reason });
      }

      const blocked = problems.find(p => p.status === 'blocked');
      const failed = problems.find(p => p.status === 'failed');
      if (blocked) {
        telemetry.blockedByRobots++;
        try {
          const host = new URL(partial.url ?? '').hostname;
          blockedHosts[host] = (blockedHosts[host] ?? 0) + 1;
        } catch {
          // A URL that cannot be parsed has no host to report.
        }
      }
      if (failed || blocked) {
        if (failed) telemetry.failed++;
        if (failures.length < MAX_FAILURES) {
          failures.push({ id, name: partial.name ?? id, error: (failed ?? blocked)?.reason ?? 'unknown' });
        }
      } else {
        telemetry.enriched++;
      }

      record = {
        ...record,
        id,
        lastUpdated: record.lastUpdated ?? now(),
        dataQuality: record.dataQuality ?? UNENRICHED_QUALITY,
        sources: record.sources ?? [],
      };
      // Only complete results are cached, so --resume retries the failed and blocked ones.
      if (!failed && !blocked) {
        await writeJsonAtomic(cacheFile(options.outDir, id), record);
      }
    }

    if (fromCache) telemetry.fromCache++;
    const university = record as University;
    results[index] = university;
    options.store?.upsert(university, runId, now().toISOString());
  };

  let next = 0;
  /** One worker: take the next index until the list is empty or the run is aborted. */
  const worker = async (): Promise<void> => {
    while (next < items.length && !options.signal?.aborted) {
      const index = next++;
      telemetry.queued = items.length - next;
      telemetry.active++;
      try {
        await processItem(index);
      } catch (error) {
        // Storing or caching failed for this item; record it and carry on with the rest.
        telemetry.failed++;
        if (failures.length < MAX_FAILURES) {
          failures.push({
            id: items[index].id,
            name: items[index].partial.name ?? items[index].id,
            error: String(error),
          });
        }
      } finally {
        telemetry.active--;
        telemetry.completed++;
        refresh();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, worker));
  clearInterval(timer);

  const interrupted = Boolean(options.signal?.aborted) && telemetry.completed < telemetry.total;
  telemetry.state = interrupted ? 'interrupted' : 'completed';
  telemetry.queued = interrupted ? items.length - telemetry.completed : 0;
  await flushTelemetry();

  const universities = results.filter((u): u is University => u !== undefined);
  await writeJsonAtomic(outputFile, universities);
  const finishedAt = now();
  options.store?.finishRun(runId, finishedAt.toISOString(), universities.length);

  const outputStat = await fs.promises.stat(outputFile);
  const manifest: RunManifest = {
    schemaVersion: 1,
    runId,
    tool: {
      name: 'universities',
      version: options.toolVersion ?? 'unknown',
      node: process.versions.node,
      platform: `${process.platform}-${process.arch}`,
    },
    startedAt: telemetry.startedAt,
    finishedAt: finishedAt.toISOString(),
    interrupted,
    git: gitState(path.dirname(path.resolve(options.csv))),
    input: {
      file: path.resolve(options.csv),
      sha256: await sha256File(options.csv),
      rows: all.length,
      selected: items.length,
      filters: { countryCode: options.countryCode, start, limit: options.limit },
    },
    options: { concurrency, resume: Boolean(options.resume), store: options.store ? 'sqlite' : undefined },
    modules: options.modules.map(m => ({ name: m.name, version: m.version, config: m.describe?.() })),
    output: {
      file: path.resolve(outputFile),
      sha256: await sha256File(outputFile),
      count: universities.length,
      bytes: outputStat.size,
    },
    counts: {
      fromCache: telemetry.fromCache,
      enriched: telemetry.enriched,
      failed: telemetry.failed,
      blockedByRobots: telemetry.blockedByRobots,
    },
  };
  await writeJsonAtomic(manifestFile, manifest);

  const result: EnrichmentRunResult = {
    runId,
    universities,
    telemetry,
    manifest,
    outputFile,
    manifestFile,
    telemetryFile,
  };

  // A partial dataset must not be published as if it were complete.
  if ((options.snapshot || options.publishDir) && !interrupted) {
    result.snapshotDir = await writeSnapshot(options.outDir, runId, [outputFile, manifestFile, telemetryFile]);
    if (options.publishDir) {
      result.publishedDir = await publishSnapshot(result.snapshotDir, options.publishDir, runId);
    }
  }
  return result;
};

/**
 * Copy files into `<outDir>/snapshots/<runId>/`, write a `SHA256SUMS` file next to them (checkable with
 * `shasum -a 256 -c SHA256SUMS`) and point `<outDir>/snapshots/latest.json` at the snapshot.
 *
 * @returns The snapshot folder.
 */
export const writeSnapshot = async (outDir: string, runId: string, files: string[]): Promise<string> => {
  const snapshotDir = path.join(outDir, 'snapshots', runId);
  await fs.promises.mkdir(snapshotDir, { recursive: true });
  const sums: string[] = [];
  for (const file of files) {
    const destination = path.join(snapshotDir, path.basename(file));
    await fs.promises.copyFile(file, destination);
    sums.push(`${await sha256File(destination)}  ${path.basename(file)}`);
  }
  await fs.promises.writeFile(path.join(snapshotDir, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  await writeJsonAtomic(path.join(outDir, 'snapshots', 'latest.json'), { runId, path: snapshotDir });
  return snapshotDir;
};

/**
 * Copy a snapshot folder to `<publishDir>/<runId>/` and update `<publishDir>/latest.json`. The destination can be
 * a checkout of a static-hosting branch, a mounted bucket, or a folder whose files you attach to a GitHub release.
 *
 * @returns The folder the snapshot was copied to.
 */
export const publishSnapshot = async (snapshotDir: string, publishDir: string, runId: string): Promise<string> => {
  const destination = path.join(publishDir, runId);
  await fs.promises.mkdir(destination, { recursive: true });
  const files: { name: string; sha256: string }[] = [];
  for (const name of await fs.promises.readdir(snapshotDir)) {
    await fs.promises.copyFile(path.join(snapshotDir, name), path.join(destination, name));
    files.push({ name, sha256: await sha256File(path.join(destination, name)) });
  }
  await writeJsonAtomic(path.join(publishDir, 'latest.json'), { runId, publishedAt: new Date().toISOString(), files });
  return destination;
};
