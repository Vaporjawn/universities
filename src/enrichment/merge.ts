import { Ranking, University } from '../types/University';

/** Stable identity of a ranking entry, so merging the same feed twice adds nothing. */
const rankingKey = (r: Ranking): string => `${r.source}|${r.year}|${r.category ?? ''}`;

/**
 * Merge enrichment output into a record. Defined values in `patch` replace those in `base`, except that
 * `rankings`, `accreditation` and `sources` are combined without duplicates (a ranking with the same source, year and
 * category is replaced by the newer one).
 *
 * @param base - The record so far. Not modified.
 * @param patch - Fields to add.
 * @returns A new merged record.
 */
export const mergeUniversity = (base: Partial<University>, patch: Partial<University>): Partial<University> => {
  const merged: Partial<University> = { ...base };
  for (const [key, value] of Object.entries(patch) as [keyof University, unknown][]) {
    if (value === undefined || key === 'rankings' || key === 'accreditation' || key === 'sources') continue;
    (merged as Record<string, unknown>)[key] = value;
  }

  if (patch.rankings?.length) {
    const byKey = new Map((base.rankings ?? []).map(r => [rankingKey(r), r] as const));
    for (const ranking of patch.rankings) byKey.set(rankingKey(ranking), ranking);
    merged.rankings = [...byKey.values()];
  }
  if (patch.accreditation?.length) {
    merged.accreditation = [...new Set([...(base.accreditation ?? []), ...patch.accreditation])];
  }
  if (patch.sources?.length) {
    merged.sources = [...new Set([...(base.sources ?? []), ...patch.sources])];
  }
  return merged;
};
