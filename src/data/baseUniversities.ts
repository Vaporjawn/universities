import { universityIdFor } from '../scraper/UniversityScraper';
import { Continent } from '../types/University';
import { BaseUniversityRecord, toPartialUniversity } from './loadBase';
import { inferGeography } from './regions';

/** A CSV row with the fields that can be derived without any network access. */
export interface BaseUniversity {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  url: string;
  domain: string;
  continent?: Continent;
  subregion?: string;
}

/**
 * Turn CSV rows into base records. Ids are the ones the enrichment pipeline uses; when two rows would share an id
 * the later one gets its 1-based CSV row number appended.
 *
 * @param rows - Rows from `loadBaseUniversities`, in file order.
 */
export const buildBaseUniversities = (rows: BaseUniversityRecord[]): BaseUniversity[] => {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const partial = toPartialUniversity(row);
    let id = universityIdFor(partial);
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    let domain = '';
    try {
      domain = new URL(row.url).hostname;
    } catch {
      // Keep the empty domain for a URL that cannot be parsed; validate:data reports such rows.
    }
    const geography = inferGeography(row.countryCode);
    return {
      id,
      name: row.name,
      country: partial.country as string,
      countryCode: row.countryCode,
      url: row.url,
      domain,
      continent: geography?.continent,
      subregion: geography?.subregion,
    };
  });
};
