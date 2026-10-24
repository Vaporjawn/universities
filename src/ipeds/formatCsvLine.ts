import { UniversityCsvRow } from './types';

/** Quote a CSV field only when it contains a comma, a double quote or a line break. */
function quoteField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialise one world-universities.csv row (no trailing newline). */
export function formatCsvLine(row: UniversityCsvRow): string {
  return [row.countryCode, row.name, row.url].map(quoteField).join(',');
}
