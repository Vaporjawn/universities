import { formatCsvLine } from './formatCsvLine';
import { UniversityCsvRow } from './types';

/**
 * Replace every row of one country in world-universities.csv text with `replacement`, in place.
 *
 * The file is grouped by country code, so the new block is written where the old one started. Rows
 * of all other countries are kept byte for byte. Throws if the country has no rows to anchor on.
 */
export function replaceCountryBlock(
  csvText: string,
  countryCode: string,
  replacement: readonly UniversityCsvRow[]
): string {
  const prefix = `${countryCode},`;
  const lines = csvText.split('\n');
  const firstIndex = lines.findIndex(line => line.startsWith(prefix));
  if (firstIndex === -1) {
    throw new Error(`No existing rows for country ${countryCode}; cannot decide where to insert the block`);
  }

  const kept = lines.filter(line => !line.startsWith(prefix));
  const rowsBefore = lines.slice(0, firstIndex).filter(line => !line.startsWith(prefix)).length;
  kept.splice(rowsBefore, 0, ...replacement.map(formatCsvLine));
  return kept.join('\n');
}
