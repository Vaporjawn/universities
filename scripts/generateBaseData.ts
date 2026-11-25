#!/usr/bin/env ts-node
/*
 * Generate the base dataset as JSON: `npm run generate:data [-- --csv=PATH --out=PATH]`.
 *
 * Reads world-universities.csv and writes data/base-universities.json: one record per CSV row with the same id the
 * enrichment pipeline uses (so the file lines up with data/cache/ and data/enriched-universities.json), the country
 * name, the continent and UN sub-region, and the domain. Nothing is fetched from the network.
 */
import fs from 'fs-extra';
import path from 'path';
import { loadBaseUniversities } from '../src/data/loadBase';
import { buildBaseUniversities } from '../src/data/baseUniversities';

const root = path.resolve(__dirname, '..');

/** Read `--name=value` or `--name value` from the arguments. */
const option = (name: string): string | undefined => {
  const argv = process.argv.slice(2);
  const index = argv.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
  if (index < 0) return undefined;
  return argv[index].includes('=') ? argv[index].slice(name.length + 1) : argv[index + 1];
};

const main = async (): Promise<void> => {
  const csv = path.resolve(option('--csv') ?? path.join(root, 'world-universities.csv'));
  const out = path.resolve(option('--out') ?? path.join(root, 'data', 'base-universities.json'));

  const rows = await loadBaseUniversities(csv);
  const universities = buildBaseUniversities(rows);
  await fs.ensureDir(path.dirname(out));
  await fs.writeJSON(out, universities, { spaces: 2 });

  const withoutGeography = universities.filter(u => !u.continent);
  console.log(`Wrote ${universities.length} universities to ${out}`);
  if (withoutGeography.length > 0) {
    const codes = [...new Set(withoutGeography.map(u => u.countryCode))].sort();
    console.warn(`No continent known for country code(s): ${codes.join(', ')}`);
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
