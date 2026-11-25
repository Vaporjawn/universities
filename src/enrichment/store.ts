import { University } from '../types/University';

/** The subset of `node:sqlite`'s `DatabaseSync` the store uses. */
interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
}

/** What changed in one stored university between two runs. */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/** One row of a university's history. */
export interface HistoryEntry {
  runId: string;
  changedAt: string;
  changeType: 'insert' | 'update';
  changes: Record<string, FieldChange>;
}

/** Result of storing one university. */
export interface UpsertResult {
  changeType: 'insert' | 'update' | 'unchanged';
  changedFields: string[];
}

/** Fields that change on every run and would make every record look modified. */
const VOLATILE_FIELDS = new Set(['lastUpdated']);

/** Stable JSON text: object keys sorted, so equal records always serialise equally. */
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );

/**
 * Persistent store of enriched universities with a per-field change history, so repeated runs record deltas rather
 * than overwriting. Backed by Node's built-in `node:sqlite`, which needs Node 22.5 or newer (22.13 without a flag);
 * no native module is installed.
 */
export class SqliteStore {
  private readonly db: SqliteDatabase;

  /**
   * Open or create a database.
   *
   * @param filePath - Database file, or `:memory:`.
   * @throws When `node:sqlite` is not available in this Node version.
   */
  constructor(filePath: string) {
    this.db = SqliteStore.open(filePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS universities (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_updated TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS history (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        university_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        change_type TEXT NOT NULL,
        changes TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS history_by_university ON history (university_id, seq);
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        universities INTEGER
      );
    `);
  }

  /** Whether this Node version can open a store. */
  static isSupported(): boolean {
    try {
      return Boolean(SqliteStore.loadModule());
    } catch {
      return false;
    }
  }

  private static loadModule(): { DatabaseSync: new (path: string) => SqliteDatabase } | undefined {
    const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
    return getBuiltin?.call(process, 'node:sqlite') as
      { DatabaseSync: new (path: string) => SqliteDatabase } | undefined;
  }

  private static open(filePath: string): SqliteDatabase {
    const sqlite = SqliteStore.loadModule();
    if (!sqlite) {
      throw new Error(
        `The SQLite store needs Node 22.13 or newer (node:sqlite); this is Node ${process.versions.node}. ` +
          'Run without --store, or upgrade Node.'
      );
    }
    return new sqlite.DatabaseSync(filePath);
  }

  /** Record that a run has started. */
  startRun(runId: string, startedAt: string): void {
    this.db.prepare('INSERT OR REPLACE INTO runs (run_id, started_at) VALUES (?, ?)').run(runId, startedAt);
  }

  /** Record that a run has finished. */
  finishRun(runId: string, finishedAt: string, universities: number): void {
    this.db
      .prepare('UPDATE runs SET finished_at = ?, universities = ? WHERE run_id = ?')
      .run(finishedAt, universities, runId);
  }

  /**
   * Insert a university or update it, writing a history row listing the fields that changed.
   *
   * @param university - The enriched record.
   * @param runId - Run that produced it.
   * @param at - Timestamp for the history row.
   * @returns What happened. `unchanged` writes no history row.
   */
  upsert(university: University, runId: string, at: string = new Date().toISOString()): UpsertResult {
    const next = JSON.parse(JSON.stringify(university)) as Record<string, unknown>;
    const row = this.db.prepare('SELECT data FROM universities WHERE id = ?').get(university.id);

    if (!row) {
      this.db
        .prepare('INSERT INTO universities (id, data, first_seen, last_updated) VALUES (?, ?, ?, ?)')
        .run(university.id, stableStringify(next), at, at);
      const changes = Object.fromEntries(
        Object.entries(next)
          .filter(([key]) => !VOLATILE_FIELDS.has(key))
          .map(([key, value]) => [key, { from: undefined, to: value }])
      );
      this.writeHistory(university.id, runId, at, 'insert', changes);
      return { changeType: 'insert', changedFields: Object.keys(changes) };
    }

    const previous = JSON.parse(String(row.data)) as Record<string, unknown>;
    const changes: Record<string, FieldChange> = {};
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (VOLATILE_FIELDS.has(key)) continue;
      if (stableStringify(previous[key]) !== stableStringify(next[key])) {
        changes[key] = { from: previous[key], to: next[key] };
      }
    }
    if (Object.keys(changes).length === 0) return { changeType: 'unchanged', changedFields: [] };

    this.db
      .prepare('UPDATE universities SET data = ?, last_updated = ? WHERE id = ?')
      .run(stableStringify(next), at, university.id);
    this.writeHistory(university.id, runId, at, 'update', changes);
    return { changeType: 'update', changedFields: Object.keys(changes) };
  }

  /** The stored record for an id, or `undefined`. */
  get(id: string): University | undefined {
    const row = this.db.prepare('SELECT data FROM universities WHERE id = ?').get(id);
    return row ? (JSON.parse(String(row.data)) as University) : undefined;
  }

  /** Number of stored universities. */
  count(): number {
    return Number(this.db.prepare('SELECT COUNT(*) AS n FROM universities').get()?.n ?? 0);
  }

  /** The change history of one university, oldest first. */
  history(id: string): HistoryEntry[] {
    return this.db
      .prepare('SELECT run_id, changed_at, change_type, changes FROM history WHERE university_id = ? ORDER BY seq')
      .all(id)
      .map(r => ({
        runId: String(r.run_id),
        changedAt: String(r.changed_at),
        changeType: r.change_type as HistoryEntry['changeType'],
        changes: JSON.parse(String(r.changes)) as Record<string, FieldChange>,
      }));
  }

  /** Close the database. */
  close(): void {
    this.db.close();
  }

  private writeHistory(
    id: string,
    runId: string,
    at: string,
    changeType: HistoryEntry['changeType'],
    changes: Record<string, FieldChange>
  ): void {
    this.db
      .prepare('INSERT INTO history (university_id, run_id, changed_at, change_type, changes) VALUES (?, ?, ?, ?, ?)')
      .run(id, runId, at, changeType, JSON.stringify(changes));
  }
}
