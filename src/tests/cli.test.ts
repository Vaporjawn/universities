import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '..', '..');
const tsNodeBin = require.resolve('ts-node/dist/bin.js');
const packageVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version;

/** Run the real CLI source through ts-node, exactly as `npm start`-style development would. */
function runCli(...args: string[]): string {
  return execFileSync(process.execPath, [tsNodeBin, 'src/cli.ts', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024, // the full dataset as JSON is tens of MB
  });
}

describe('CLI', () => {
  jest.setTimeout(60000);

  it('reports the version from package.json', () => {
    expect(runCli('--version').trim()).toBe(packageVersion);
  });

  it('lists universities by --name', () => {
    const output = runCli('list', '--name', 'polytechnic', '--limit', '2');
    const rows = output.split('\n').filter(line => /^[A-Z]{2}\t/.test(line));
    expect(rows).toHaveLength(2);
    rows.forEach(row => expect(row.toLowerCase()).toContain('polytechnic'));
    expect(output).toContain('2 universities shown.');
  });

  it('still accepts --search as an alias for --name', () => {
    expect(runCli('list', '--search', 'polytechnic', '--limit', '2')).toBe(
      runCli('list', '--name', 'polytechnic', '--limit', '2')
    );
  });

  it('prints parseable JSON with --json and filters by country code', () => {
    const results = JSON.parse(runCli('list', '--country-code', 'US', '--limit', '1', '--json'));
    expect(results).toHaveLength(1);
    expect(results[0].countryCode).toBe('US');
  });

  it('shows nothing for --limit 0', () => {
    expect(runCli('list', '--limit', '0')).toContain('0 universities shown.');
  });

  it('gives every university a unique id', () => {
    const all = JSON.parse(runCli('list', '--limit', '100000', '--json')) as { id: string }[];
    expect(all.length).toBeGreaterThan(9000);
    expect(new Set(all.map(u => u.id)).size).toBe(all.length);
  });
});
