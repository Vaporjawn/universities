#!/usr/bin/env ts-node
/*
 * Rebuild the US block of world-universities.csv from the NCES IPEDS directory file.
 *
 * Source: https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip (Institutional Characteristics ->
 * Directory information; replace 2024 with the latest year). Unzip it and pass the CSV:
 *
 *   npm run sync:us -- --ipeds=/path/to/HD2024.csv                     dry run, prints a report
 *   npm run sync:us -- --ipeds=/path/to/HD2024.csv --write             rewrite the US rows
 *   npm run sync:us -- --ipeds=/path/to/HD2024.csv --check             exit 1 if the CSV is out of date
 *   npm run sync:us -- --ipeds=... --write --removed-report=out.csv    also save the old rows that were dropped
 *
 * Selection rule: currently active, degree-granting institutions in the 50 states and DC. Rows for
 * other countries, including US territories, are never touched.
 */
import fs from 'fs';
import path from 'path';
import {
  US_COUNTRY_CODE,
  formatCsvLine,
  parseIpedsDirectory,
  replaceCountryBlock,
  selectUsInstitutions,
  toUsCsvRows,
} from '../src/ipeds';
import { loadBaseUniversities } from '../src/data/loadBase';

interface SyncOptions {
  ipeds?: string;
  csv: string;
  write: boolean;
  check: boolean;
  removedReport?: string;
}

function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    csv: path.resolve(__dirname, '..', 'world-universities.csv'),
    write: false,
    check: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--ipeds=')) options.ipeds = path.resolve(arg.slice('--ipeds='.length));
    else if (arg.startsWith('--csv=')) options.csv = path.resolve(arg.slice('--csv='.length));
    else if (arg.startsWith('--removed-report='))
      options.removedReport = path.resolve(arg.slice('--removed-report='.length));
    else if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.ipeds) throw new Error('Missing --ipeds=PATH (the unzipped IPEDS HDYYYY.csv file)');
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const institutions = await parseIpedsDirectory(options.ipeds as string);
  if (institutions.length === 0) {
    throw new Error(`No institutions could be read from ${options.ipeds}; is it an IPEDS HDYYYY.csv file?`);
  }
  const selected = selectUsInstitutions(institutions);
  const { rows, skippedWithoutWebsite } = toUsCsvRows(selected);

  const existing = (await loadBaseUniversities(options.csv)).filter(r => r.countryCode === US_COUNTRY_CODE);
  const existingLines = new Set(existing.map(r => formatCsvLine(r)));
  const newLines = new Set(rows.map(r => formatCsvLine(r)));
  const removed = existing.filter(r => !newLines.has(formatCsvLine(r)));
  const added = rows.filter(r => !existingLines.has(formatCsvLine(r)));
  // A removed row whose name still exists in the new block was only updated (new URL or spelling);
  // the rest are institutions IPEDS no longer lists as active degree-granting (renamed, merged, closed).
  const newNames = new Set(rows.map(r => r.name.toLowerCase()));
  const dropped = removed.filter(r => !newNames.has(r.name.toLowerCase()));

  console.log(`IPEDS rows read:                     ${institutions.length}`);
  console.log(`Active degree-granting (states+DC): ${selected.length}`);
  console.log(`Skipped, no usable website:          ${skippedWithoutWebsite.length}`);
  skippedWithoutWebsite.forEach(i => console.log(`  - ${i.name} (${i.stateCode}, UNITID ${i.unitId})`));
  console.log(`US rows now in CSV:                  ${existing.length}`);
  console.log(`US rows after sync:                  ${rows.length}`);
  console.log(`  rows identical to before: ${rows.length - added.length}`);
  console.log(`  rows added or changed:    ${added.length}`);
  console.log(`  old rows replaced:        ${removed.length - dropped.length} (same name, new URL or spelling)`);
  console.log(
    `  old rows dropped:         ${dropped.length} (name not in IPEDS: renamed, merged, closed or non-degree)`
  );

  if (options.removedReport) {
    fs.mkdirSync(path.dirname(options.removedReport), { recursive: true });
    fs.writeFileSync(options.removedReport, dropped.map(r => formatCsvLine(r)).join('\n') + '\n');
    console.log(`Wrote ${dropped.length} dropped rows to ${options.removedReport}`);
  }

  const upToDate = added.length === 0 && removed.length === 0;
  if (options.check) {
    if (!upToDate) {
      console.error('world-universities.csv US block is out of date. Run with --write to update it.');
      process.exitCode = 1;
    } else {
      console.log('US block is up to date with the IPEDS file.');
    }
    return;
  }

  if (options.write) {
    const updated = replaceCountryBlock(fs.readFileSync(options.csv, 'utf8'), US_COUNTRY_CODE, rows);
    fs.writeFileSync(options.csv, updated);
    console.log(`Rewrote the US block in ${options.csv}`);
  } else {
    console.log('Dry run: nothing written. Add --write to apply.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
