import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/** SHA-256 of a file, as lower-case hex. Streams, so large files are fine. */
export const sha256File = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', chunk => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });

/** Git commit of the working directory, when it is a git checkout. */
export const gitState = (cwd: string): { commit: string; dirty: boolean } | null => {
  try {
    const run = (args: string[]) =>
      execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { commit: run(['rev-parse', 'HEAD']).trim(), dirty: run(['status', '--porcelain']).trim().length > 0 };
  } catch {
    return null;
  }
};

/** Write JSON atomically: a temporary file in the same folder, then a rename, so readers never see half a file. */
export const writeJsonAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(temporary, JSON.stringify(value, null, 2));
  await fs.promises.rename(temporary, filePath);
};

/** The provenance record written next to every enriched dataset. */
export interface RunManifest {
  schemaVersion: 1;
  runId: string;
  tool: { name: string; version: string; node: string; platform: string };
  startedAt: string;
  finishedAt: string;
  interrupted: boolean;
  git: { commit: string; dirty: boolean } | null;
  input: {
    file: string;
    sha256: string;
    rows: number;
    selected: number;
    filters: { countryCode?: string[]; start: number; limit?: number };
  };
  options: { concurrency: number; resume: boolean; store?: string };
  modules: { name: string; version: string; config?: Record<string, unknown> }[];
  output: { file: string; sha256: string; count: number; bytes: number };
  counts: {
    fromCache: number;
    enriched: number;
    failed: number;
    blockedByRobots: number;
  };
}
