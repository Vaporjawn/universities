#!/usr/bin/env ts-node
/*
 * Validate world-universities.csv. Exits 1 when any error-level rule fails.
 *
 *   npm run validate:data                      checks ../world-universities.csv
 *   npm run validate:data -- --csv=other.csv   checks another file
 *
 * Duplicate rows (same country, name and URL) fail unless listed in scripts/data/reviewed-duplicates.json.
 */
import fs from 'fs';
import path from 'path';
import { readRawCsvRows, validateDatasetRows } from '../src/data/validation';

const MAX_PRINTED_ISSUES = 50;

async function main(): Promise<void> {
  const csvArg = process.argv.slice(2).find(arg => arg.startsWith('--csv='));
  const csvPath = csvArg
    ? path.resolve(csvArg.slice('--csv='.length))
    : path.resolve(__dirname, '..', 'world-universities.csv');
  const reviewedPath = path.resolve(__dirname, 'data', 'reviewed-duplicates.json');
  const reviewed = new Set<string>(JSON.parse(fs.readFileSync(reviewedPath, 'utf8')).reviewed);

  const report = validateDatasetRows(await readRawCsvRows(csvPath), { reviewedDuplicates: reviewed });
  const errors = report.issues.filter(issue => issue.severity === 'error');

  console.log(`Rows checked: ${report.rowCount}`);
  console.log(`Shared websites (informational): ${report.sharedWebsiteGroups} groups`);
  console.log(`Same name with different URLs (informational): ${report.sameNameDifferentUrlGroups} groups`);
  errors
    .slice(0, MAX_PRINTED_ISSUES)
    .forEach(issue => console.error(`line ${issue.line}: [${issue.rule}] ${issue.message}`));
  if (errors.length > MAX_PRINTED_ISSUES) console.error(`... and ${errors.length - MAX_PRINTED_ISSUES} more`);

  if (errors.length > 0) {
    console.error(`FAILED: ${errors.length} error(s)`);
    process.exitCode = 1;
  } else {
    console.log('OK: no errors');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
