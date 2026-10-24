/** One data row of world-universities.csv exactly as it appears in the file (nothing trimmed). */
export interface RawCsvRow {
  /** 1-based line number in the file (the file has no header and no multi-line fields). */
  line: number;
  fields: string[];
}

export type DatasetIssueSeverity = 'error' | 'info';

export interface DatasetIssue {
  /** Short machine-readable rule id, for example `surrounding-whitespace`. */
  rule: string;
  severity: DatasetIssueSeverity;
  line: number;
  message: string;
}

export interface DatasetReport {
  rowCount: number;
  issues: DatasetIssue[];
  /** Number of distinct (country, website) pairs used by more than one row. Informational: multi-campus sites. */
  sharedWebsiteGroups: number;
  /** Number of (country, name) pairs that appear with different URLs. Informational: often an old and a new domain. */
  sameNameDifferentUrlGroups: number;
}

export interface ValidateDatasetOptions {
  /** Lower-case `COUNTRY|name|url` keys of duplicate rows that were reviewed and are intentional. */
  reviewedDuplicates?: ReadonlySet<string>;
}
