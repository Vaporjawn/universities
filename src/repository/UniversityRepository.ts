import {
  University,
  UniversitySearchOptions,
  UniversitySortField,
  UniversityStats,
  UniversityType,
  UniversitySize,
} from '../types/University';

/** Average of the four 0-1 data quality scores; records without scores sort as 0. */
function dataQualityScore(u: University): number {
  const q = u.dataQuality;
  if (!q) return 0;
  return (q.completeness + q.accuracy + q.freshness + q.reliability) / 4;
}

/** The first record with the smallest ('min') or largest ('max') value of a numeric field, or undefined. */
function extremeBy(list: University[], field: 'studentCount' | 'foundedYear', which: 'min' | 'max') {
  let best: University | undefined;
  for (const u of list) {
    if (best === undefined) best = u;
    else if (
      which === 'min' ? (u[field] as number) < (best[field] as number) : (u[field] as number) > (best[field] as number)
    )
      best = u;
  }
  return best;
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export class UniversityRepository {
  private universities: University[] = [];

  constructor(universities: University[] = []) {
    this.universities = universities;
  }

  setData(universities: University[]) {
    this.universities = universities;
  }

  getAll(): University[] {
    return this.universities;
  }

  /**
   * Filter, sort and paginate the universities.
   *
   * Numeric options are compared against `undefined`, not truthiness, so `0` is a real value:
   * `limit: 0` returns no results and `minStudentCount: 0` still applies the filter (which then
   * excludes records that have no `studentCount`).
   */
  search(options: UniversitySearchOptions = {}): University[] {
    let results = [...this.universities];

    if (options.name) {
      const term = options.name.toLowerCase();
      results = results.filter(u => u.name.toLowerCase().includes(term));
    }

    if (options.country) {
      const country = options.country.toLowerCase();
      results = results.filter(u => u.country?.toLowerCase() === country);
    }

    if (options.countryCode) {
      const code = options.countryCode.toUpperCase();
      results = results.filter(u => u.countryCode?.toUpperCase() === code);
    }

    if (options.city) {
      const city = options.city.toLowerCase();
      results = results.filter(u => u.city?.toLowerCase() === city);
    }

    if (options.state) {
      const state = options.state.toLowerCase();
      results = results.filter(u => u.state?.toLowerCase() === state);
    }

    if (options.type) {
      const types = asArray(options.type);
      results = results.filter(u => u.type && types.includes(u.type));
    }

    if (options.size) {
      const sizes = asArray(options.size);
      results = results.filter(u => u.size && sizes.includes(u.size));
    }

    if (options.foundedAfter !== undefined) {
      const after = options.foundedAfter;
      results = results.filter(u => u.foundedYear !== undefined && u.foundedYear > after);
    }

    if (options.foundedBefore !== undefined) {
      const before = options.foundedBefore;
      results = results.filter(u => u.foundedYear !== undefined && u.foundedYear < before);
    }

    if (options.hasProgram) {
      const programTerm = options.hasProgram.toLowerCase();
      results = results.filter(u => u.programs?.some(p => p.name.toLowerCase().includes(programTerm)));
    }

    if (options.degreeLevel) {
      const degrees = asArray(options.degreeLevel);
      results = results.filter(u => u.degrees?.some(d => degrees.includes(d)));
    }

    if (options.languages) {
      results = results.filter(u => options.languages?.every(l => u.languages?.includes(l)));
    }

    if (options.accreditation) {
      results = results.filter(u => options.accreditation?.every(a => u.accreditation?.includes(a)));
    }

    if (options.minStudentCount !== undefined) {
      const min = options.minStudentCount;
      results = results.filter(u => u.studentCount !== undefined && u.studentCount >= min);
    }

    if (options.maxStudentCount !== undefined) {
      const max = options.maxStudentCount;
      results = results.filter(u => u.studentCount !== undefined && u.studentCount <= max);
    }

    // Sorting
    if (options.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      switch (options.sortBy) {
        case UniversitySortField.NAME:
          results.sort((a, b) => a.name.localeCompare(b.name) * order);
          break;
        case UniversitySortField.COUNTRY:
          results.sort((a, b) => (a.country || '').localeCompare(b.country || '') * order);
          break;
        case UniversitySortField.FOUNDED_YEAR:
          results.sort((a, b) => ((a.foundedYear || 0) - (b.foundedYear || 0)) * order);
          break;
        case UniversitySortField.STUDENT_COUNT:
          results.sort((a, b) => ((a.studentCount || 0) - (b.studentCount || 0)) * order);
          break;
        case UniversitySortField.DATA_QUALITY:
          results.sort((a, b) => (dataQualityScore(a) - dataQualityScore(b)) * order);
          break;
      }
    }

    // Pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  /**
   * Aggregate counts for the whole repository.
   *
   * `averageStudentCount`, `largestUniversity` and `smallestUniversity` only consider records that
   * have a `studentCount`; `oldestUniversity` and `newestUniversity` only consider records with a
   * `foundedYear`. `averageStudentCount` is `0` when no record has a student count, and the
   * university fields are `undefined` when no record has the data they need.
   */
  stats(): UniversityStats {
    const countByCountry: Record<string, number> = {};

    for (const u of this.universities) {
      countByCountry[u.countryCode] = (countByCountry[u.countryCode] || 0) + 1;
    }

    const countByType = Object.values(UniversityType).reduce(
      (acc, t) => ({ ...acc, [t]: 0 }),
      {} as Record<UniversityType, number>
    );
    const countBySize = Object.values(UniversitySize).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<UniversitySize, number>
    );

    for (const u of this.universities) {
      if (u.type && countByType[u.type] !== undefined) countByType[u.type] += 1;
      if (u.size && countBySize[u.size] !== undefined) countBySize[u.size] += 1;
    }

    const withStudents = this.universities.filter(u => typeof u.studentCount === 'number');
    const withFounded = this.universities.filter(u => typeof u.foundedYear === 'number');

    return {
      totalCount: this.universities.length,
      countByCountry,
      countByType,
      countBySize,
      averageStudentCount: withStudents.length
        ? withStudents.reduce((sum, u) => sum + (u.studentCount as number), 0) / withStudents.length
        : 0,
      oldestUniversity: extremeBy(withFounded, 'foundedYear', 'min'),
      newestUniversity: extremeBy(withFounded, 'foundedYear', 'max'),
      largestUniversity: extremeBy(withStudents, 'studentCount', 'max'),
      smallestUniversity: extremeBy(withStudents, 'studentCount', 'min'),
    };
  }
}
