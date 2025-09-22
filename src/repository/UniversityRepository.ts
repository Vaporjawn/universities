import {
  University,
  UniversitySearchOptions,
  SortOption,
  UniversityStats,
  UniversityType,
  UniversitySize,
} from '../types/University';

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

    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      results = results.filter(u => u.type && types.includes(u.type));
    }

    if (options.foundedAfter) {
      results = results.filter(u => u.foundedYear && u.foundedYear > (options.foundedAfter as number));
    }

    if (options.foundedBefore) {
      results = results.filter(u => u.foundedYear && u.foundedYear < (options.foundedBefore as number));
    }

    if (options.hasProgram) {
      const programTerm = options.hasProgram.toLowerCase();
      results = results.filter(u => u.programs?.some(p => p.name.toLowerCase().includes(programTerm)));
    }

    if (options.degreeLevel) {
      const degrees = Array.isArray(options.degreeLevel) ? options.degreeLevel : [options.degreeLevel];
      results = results.filter(u => u.degrees?.some(d => degrees.includes(d)));
    }

    if (options.languages) {
      results = results.filter(u => options.languages?.every(l => u.languages?.includes(l)));
    }

    if (options.minStudentCount) {
      results = results.filter(u => u.studentCount && u.studentCount >= (options.minStudentCount as number));
    }

    if (options.maxStudentCount) {
      results = results.filter(u => u.studentCount && u.studentCount <= (options.maxStudentCount as number));
    }

    // Sorting
    if (options.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      switch (options.sortBy) {
        case SortOption.NAME:
          results.sort((a, b) => a.name.localeCompare(b.name) * order);
          break;
        case SortOption.COUNTRY:
          results.sort((a, b) => (a.country || '').localeCompare(b.country || '') * order);
          break;
        case SortOption.FOUNDED_YEAR:
          results.sort((a, b) => ((a.foundedYear || 0) - (b.foundedYear || 0)) * order);
          break;
        case SortOption.STUDENT_COUNT:
          results.sort((a, b) => ((a.studentCount || 0) - (b.studentCount || 0)) * order);
          break;
      }
    }

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    return results.slice(offset, offset + limit);
  }

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

    // We could populate types/sizes if data exists
    for (const u of this.universities) {
      if (u.type && countByType[u.type] !== undefined) countByType[u.type] += 1;
      if (u.size && countBySize[u.size] !== undefined) countBySize[u.size] += 1;
    }

    return {
      totalCount: this.universities.length,
      countByCountry,
      countByType,
      countBySize,
      averageStudentCount: 0,
      oldestUniversity: undefined,
      newestUniversity: undefined,
      largestUniversity: undefined,
      smallestUniversity: undefined,
    };
  }
}
