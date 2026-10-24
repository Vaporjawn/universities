import csv from 'csv-parser';
import fs from 'fs';
import { IpedsInstitution } from './types';

/**
 * Read an IPEDS `HDYYYY.csv` directory file (UTF-8, optional BOM) into typed records.
 *
 * Rows without a UNITID or name are ignored. The file is untrusted input: values are only ever
 * compared and re-serialised, never executed.
 */
export function parseIpedsDirectory(filePath: string): Promise<IpedsInstitution[]> {
  return new Promise((resolve, reject) => {
    const institutions: IpedsInstitution[] = [];

    // A read-stream error (missing file, permissions) is not forwarded by pipe(), so listen on the source too.
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input
      .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
      .on('data', (row: Record<string, string>) => {
        const unitId = (row.UNITID ?? '').trim();
        const name = (row.INSTNM ?? '').trim();
        if (!unitId || !name) return;
        institutions.push({
          unitId,
          name,
          stateCode: (row.STABBR ?? '').trim().toUpperCase(),
          webAddress: (row.WEBADDR ?? '').trim(),
          isActive: (row.CYACTIVE ?? '').trim() === '1',
          isDegreeGranting: (row.DEGGRANT ?? '').trim() === '1',
        });
      })
      .on('end', () => resolve(institutions))
      .on('error', reject);
  });
}
