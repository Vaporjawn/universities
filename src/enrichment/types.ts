import { University } from '../types/University';

/** How a module finished for one university. */
export type ModuleStatus = 'ok' | 'skipped' | 'failed' | 'blocked';

/** What a module returns for one university. */
export interface ModuleResult {
  /** Fields to merge into the record. Undefined values are ignored. */
  data?: Partial<University>;
  /** Defaults to `ok`. */
  status?: ModuleStatus;
  /** Human-readable explanation for `skipped`, `failed` and `blocked`. */
  reason?: string;
  /** URLs or file names the data came from. They are added to `University.sources`. */
  sources?: string[];
}

/**
 * A pluggable enrichment step. The pipeline runs the modules in order; each sees the record as built by the
 * modules before it, so a later module can use what an earlier one found.
 */
export interface EnrichmentModule {
  /** Unique, stable name. It appears in telemetry and in the provenance manifest. */
  name: string;
  /** Version of the module's logic or data, recorded in the manifest. */
  version: string;
  /**
   * Enrich one university.
   *
   * @param university - The record so far. Must not be mutated.
   * @returns The fields to add. Throwing marks the module as failed for this university without stopping the run.
   */
  enrich(university: Readonly<Partial<University>>): Promise<ModuleResult>;
  /** Optional description of the module's inputs for the manifest, e.g. `{ file, sha256 }`. */
  describe?(): Record<string, unknown>;
}

/** Outcome counts for one module. */
export interface ModuleCounts {
  ok: number;
  skipped: number;
  failed: number;
  blocked: number;
}

/** A failed university recorded in telemetry. */
export interface FailureRecord {
  id: string;
  name: string;
  error: string;
}

/** Progress and queue figures for a run, written to `telemetry.json` and passed to `onProgress`. */
export interface Telemetry {
  runId: string;
  state: 'running' | 'completed' | 'interrupted';
  startedAt: string;
  updatedAt: string;
  /** Universities selected for this run. */
  total: number;
  /** Universities finished, from cache or freshly enriched. */
  completed: number;
  fromCache: number;
  enriched: number;
  failed: number;
  blockedByRobots: number;
  /** Universities waiting for a worker. */
  queued: number;
  /** Universities being processed right now. */
  active: number;
  /** Universities finished per second since the start. */
  ratePerSecond: number;
  /** Estimated seconds left, or `null` before any rate is known. */
  etaSeconds: number | null;
  modules: Record<string, ModuleCounts>;
  /** The first failures, capped so the file stays small. */
  failures: FailureRecord[];
  /** Hosts that were skipped because of robots.txt, with how many universities each blocked. */
  robotsBlockedHosts: Record<string, number>;
}
