import csv from 'csv-parser';
import fs from 'fs';
import { RawCsvRow } from './types';

/**
 * Read world-universities.csv without trimming or dropping anything, so validation can see
 * whitespace and short rows that `loadBaseUniversities` silently cleans up.
 */
export function readRawCsvRows(csvPath: string): Promise<RawCsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: RawCsvRow[] = [];
    const input = fs.createReadStream(csvPath);
    input.on('error', reject);
    input
      .pipe(csv({ headers: false }))
      .on('data', (record: Record<string, string>) => {
        const fields = Object.keys(record)
          .sort((a, b) => Number(a) - Number(b))
          .map(key => record[key]);
        rows.push({ line: rows.length + 1, fields });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}
