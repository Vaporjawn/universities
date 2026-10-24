import { isKnownCountryCode } from '../loadBase';
import { normalizeWebAddress } from '../../ipeds/normalizeWebAddress';
import { DatasetIssue, DatasetReport, RawCsvRow, ValidateDatasetOptions } from './types';

/** Host without scheme, `www.` prefix, path or trailing slash, for grouping rows that share a website. */
function websiteKey(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\d*\./, '');
}

/**
 * Check every row of world-universities.csv.
 *
 * Errors (fail the build): wrong field count, malformed or unknown country code, empty name,
 * leading/trailing whitespace, a URL that is not a clean http(s) address, and duplicate rows
 * (same country, name and URL) that are not in `reviewedDuplicates`.
 *
 * Shared websites and same-name rows with different URLs are common and often legitimate, so they
 * are only counted in the report.
 */
export function validateDatasetRows(rows: readonly RawCsvRow[], options: ValidateDatasetOptions = {}): DatasetReport {
  const reviewed = options.reviewedDuplicates ?? new Set<string>();
  const issues: DatasetIssue[] = [];
  const addError = (rule: string, line: number, message: string) =>
    issues.push({ rule, severity: 'error', line, message });

  const rowKeyLines = new Map<string, number[]>();
  const websiteGroups = new Map<string, number>();
  const urlsByName = new Map<string, Set<string>>();

  for (const { line, fields } of rows) {
    if (fields.length !== 3) {
      addError('field-count', line, `expected 3 fields, found ${fields.length}`);
      continue;
    }
    const [countryCode, name, url] = fields;

    if (!/^[A-Z]{2}$/.test(countryCode))
      addError('country-code-format', line, `"${countryCode}" is not two upper-case letters`);
    else if (!isKnownCountryCode(countryCode))
      addError('unknown-country-code', line, `"${countryCode}" has no entry in countryMap`);

    if (!name.trim()) addError('empty-name', line, 'name is empty');

    if (countryCode !== countryCode.trim() || name !== name.trim() || url !== url.trim()) {
      addError('surrounding-whitespace', line, `leading or trailing whitespace in ${JSON.stringify(fields)}`);
    }

    if (normalizeWebAddress(url) !== url) {
      addError(
        'invalid-url',
        line,
        `"${url}" is not a clean http(s) URL (no spaces, fragment, or missing scheme or host)`
      );
    }

    const rowKey = `${countryCode}|${name.trim().toLowerCase()}|${url.trim().toLowerCase()}`;
    rowKeyLines.set(rowKey, [...(rowKeyLines.get(rowKey) ?? []), line]);

    const siteKey = `${countryCode}|${websiteKey(url)}`;
    websiteGroups.set(siteKey, (websiteGroups.get(siteKey) ?? 0) + 1);

    const nameKey = `${countryCode}|${name.trim().toLowerCase()}`;
    urlsByName.set(nameKey, (urlsByName.get(nameKey) ?? new Set<string>()).add(url.trim().toLowerCase()));
  }

  for (const [rowKey, lines] of rowKeyLines) {
    if (lines.length > 1 && !reviewed.has(rowKey)) {
      addError(
        'duplicate-row',
        lines[1],
        `${rowKey} appears ${lines.length} times (lines ${lines.join(', ')}) and is not in the reviewed list`
      );
    }
  }

  return {
    rowCount: rows.length,
    issues,
    sharedWebsiteGroups: [...websiteGroups.values()].filter(count => count > 1).length,
    sameNameDifferentUrlGroups: [...urlsByName.values()].filter(urls => urls.size > 1).length,
  };
}
