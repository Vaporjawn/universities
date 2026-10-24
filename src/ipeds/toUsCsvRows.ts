import { US_COUNTRY_CODE } from './constants';
import { normalizeWebAddress } from './normalizeWebAddress';
import { IpedsInstitution, UniversityCsvRow } from './types';

export interface UsCsvRowsResult {
  /** Rows sorted by name (case-insensitive), then URL, so the output is deterministic. */
  rows: UniversityCsvRow[];
  /** Institutions left out because IPEDS reports no usable website (the CSV requires a URL). */
  skippedWithoutWebsite: IpedsInstitution[];
}

/** Convert selected IPEDS institutions into sorted world-universities.csv rows. */
export function toUsCsvRows(institutions: readonly IpedsInstitution[]): UsCsvRowsResult {
  const rows: UniversityCsvRow[] = [];
  const skippedWithoutWebsite: IpedsInstitution[] = [];

  for (const institution of institutions) {
    const url = normalizeWebAddress(institution.webAddress);
    if (!url) {
      skippedWithoutWebsite.push(institution);
      continue;
    }
    rows.push({ countryCode: US_COUNTRY_CODE, name: institution.name, url });
  }

  rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.url.localeCompare(b.url));
  return { rows, skippedWithoutWebsite };
}
