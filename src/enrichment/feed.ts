import csv from 'csv-parser';
import fs from 'fs';
import { Ranking } from '../types/University';

/** One university's entry in a rankings or accreditation feed. */
export interface FeedEntry {
  countryCode?: string;
  name?: string;
  /** Matches the university's hostname, ignoring a leading `www.`. Preferred over name matching. */
  domain?: string;
  rankings?: Ranking[];
  accreditation?: string[];
}

/** Lower-case a name and drop accents, punctuation and the leading "the", so "The Université de X" matches "universite de x". */
export const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');

/** Hostname of a URL or bare domain without `www.`, lower-cased. Empty when it cannot be determined. */
export const normalizeDomain = (urlOrDomain: string | undefined): string => {
  if (!urlOrDomain) return '';
  const trimmed = urlOrDomain.trim();
  try {
    return new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname
      .replace(/^www\./i, '')
      .toLowerCase();
  } catch {
    return '';
  }
};

/** A feed indexed for lookups by domain and by country plus name. */
export class Feed {
  private readonly byDomain = new Map<string, FeedEntry[]>();
  private readonly byName = new Map<string, FeedEntry[]>();

  /** @param entries - Feed rows. @param label - Name of the feed's origin, used as a source for provenance. */
  constructor(
    entries: FeedEntry[],
    readonly label: string
  ) {
    for (const entry of entries) {
      const domain = normalizeDomain(entry.domain);
      if (domain) this.push(this.byDomain, domain, entry);
      if (entry.name && entry.countryCode) {
        this.push(this.byName, `${entry.countryCode.toUpperCase()}|${normalizeName(entry.name)}`, entry);
      }
    }
  }

  /** Number of feed rows indexed. */
  get size(): number {
    return new Set([...this.byDomain.values(), ...this.byName.values()].flat()).size;
  }

  /**
   * Find the entries for a university: those matching its domain first, otherwise those matching country and name.
   *
   * @param university - The identifying fields of the record.
   */
  lookup(university: { name?: string; countryCode?: string; url?: string; domain?: string }): FeedEntry[] {
    const domain = normalizeDomain(university.domain || university.url);
    const byDomain = domain ? this.byDomain.get(domain) : undefined;
    if (byDomain?.length) return byDomain;
    if (university.name && university.countryCode) {
      return this.byName.get(`${university.countryCode.toUpperCase()}|${normalizeName(university.name)}`) ?? [];
    }
    return [];
  }

  private push(map: Map<string, FeedEntry[]>, key: string, entry: FeedEntry): void {
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }
}

/** Remove a leading byte order mark that spreadsheet exports put before the first header. */
const stripByteOrderMark = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/** Read a CSV file into rows keyed by header. */
const readCsvRows = (filePath: string): Promise<Record<string, string>[]> =>
  new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input
      .pipe(csv({ mapHeaders: ({ header }) => stripByteOrderMark(header).trim() }))
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

/**
 * Convert rows of a rankings CSV into feed entries. Columns: `source`, `rank`, `year` (required) and `category`,
 * `rankingUrl`, `accreditation` (`;`-separated), `domain`, `countryCode`, `name` (identify the university: give
 * either `domain` or both `countryCode` and `name`). Rows missing required values or with a non-numeric rank or year
 * are skipped.
 */
export const csvRowsToEntries = (rows: Record<string, string>[]): FeedEntry[] =>
  rows.flatMap(row => {
    const source = row.source?.trim();
    const rank = Number(row.rank);
    const year = Number(row.year);
    const accreditation = (row.accreditation ?? '')
      .split(';')
      .map(a => a.trim())
      .filter(Boolean);
    const hasRanking = Boolean(source) && Number.isFinite(rank) && rank > 0 && Number.isInteger(year) && year > 1900;
    if (!hasRanking && accreditation.length === 0) return [];
    const entry: FeedEntry = {
      countryCode: row.countryCode?.trim() || undefined,
      name: row.name?.trim() || undefined,
      domain: row.domain?.trim() || undefined,
    };
    if (hasRanking) {
      entry.rankings = [
        {
          source: source!,
          rank,
          year,
          category: row.category?.trim() || undefined,
          url: row.rankingUrl?.trim() || undefined,
        },
      ];
    }
    if (accreditation.length) entry.accreditation = accreditation;
    return [entry];
  });

/**
 * Load a feed from a `.csv` (see {@link csvRowsToEntries}) or `.json` file (an array of {@link FeedEntry}).
 *
 * @param filePath - Path to the feed file.
 * @throws When the file is missing, malformed, or has another extension.
 */
export const loadFeed = async (filePath: string): Promise<Feed> => {
  const extension = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  let entries: FeedEntry[];
  if (extension === '.csv') {
    entries = csvRowsToEntries(await readCsvRows(filePath));
  } else if (extension === '.json') {
    const parsed: unknown = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`${filePath}: expected a JSON array of feed entries`);
    entries = parsed as FeedEntry[];
  } else {
    throw new Error(`${filePath}: feeds must be .csv or .json files`);
  }
  return new Feed(entries, filePath);
};
