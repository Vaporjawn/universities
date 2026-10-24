import { UniversityRepository } from '../repository/UniversityRepository';
import { DegreeLevel, University, UniversitySize, UniversitySortField, UniversityType } from '../types/University';

function makeUniversity(overrides: Partial<University> & Pick<University, 'id' | 'name'>): University {
  return {
    country: 'United States',
    countryCode: 'US',
    url: `http://www.${overrides.id}.edu/`,
    lastUpdated: new Date('2026-01-01'),
    dataQuality: { completeness: 0.5, accuracy: 0.5, freshness: 0.5, reliability: 0.5 },
    sources: [],
    ...overrides,
  };
}

const alpha = makeUniversity({
  id: 'alpha',
  name: 'Alpha University',
  city: 'Boston',
  state: 'MA',
  foundedYear: 1636,
  studentCount: 30000,
  type: UniversityType.PRIVATE_NON_PROFIT,
  size: UniversitySize.LARGE,
  degrees: [DegreeLevel.BACHELOR, DegreeLevel.DOCTORAL],
  languages: ['en'],
  accreditation: ['NECHE'],
  programs: [{ name: 'Computer Science', degreeLevel: DegreeLevel.BACHELOR }],
  dataQuality: { completeness: 1, accuracy: 1, freshness: 1, reliability: 1 },
});
const beta = makeUniversity({
  id: 'beta',
  name: 'Beta Institute of Technology',
  city: 'Austin',
  state: 'TX',
  foundedYear: 1900,
  studentCount: 0,
  type: UniversityType.TECHNICAL,
  size: UniversitySize.VERY_SMALL,
  degrees: [DegreeLevel.MASTER],
  languages: ['en', 'es'],
  accreditation: ['SACSCOC', 'ABET'],
  programs: [{ name: 'Mechanical Engineering', degreeLevel: DegreeLevel.MASTER }],
  dataQuality: { completeness: 0.2, accuracy: 0.2, freshness: 0.2, reliability: 0.2 },
});
const gamma = makeUniversity({
  id: 'gamma',
  name: 'Gamma College',
  country: 'Canada',
  countryCode: 'CA',
  city: 'Toronto',
  foundedYear: 0,
  studentCount: 12000,
  type: UniversityType.PUBLIC,
  size: UniversitySize.MEDIUM,
  degrees: [DegreeLevel.BACHELOR],
});
// No enrichment data at all: only the base fields every record has.
const delta = makeUniversity({ id: 'delta', name: 'Delta University', country: 'Mexico', countryCode: 'MX' });

const names = (list: University[]) => list.map(u => u.name);

describe('UniversityRepository', () => {
  let repo: UniversityRepository;

  beforeEach(() => {
    repo = new UniversityRepository([alpha, beta, gamma, delta]);
  });

  describe('construction and data', () => {
    it('returns what it was constructed with', () => {
      expect(repo.getAll()).toHaveLength(4);
    });

    it('replaces its data with setData', () => {
      repo.setData([alpha]);
      expect(names(repo.getAll())).toEqual(['Alpha University']);
    });

    it('starts empty without arguments', () => {
      expect(new UniversityRepository().getAll()).toEqual([]);
    });

    it('does not reorder its stored data when sorting results', () => {
      repo.search({ sortBy: UniversitySortField.NAME, sortOrder: 'desc' });
      expect(names(repo.getAll())).toEqual([
        'Alpha University',
        'Beta Institute of Technology',
        'Gamma College',
        'Delta University',
      ]);
    });
  });

  describe('text and location filters', () => {
    it('matches name fragments case-insensitively', () => {
      expect(names(repo.search({ name: 'university' }))).toEqual(['Alpha University', 'Delta University']);
    });

    it('matches country by full name, case-insensitively', () => {
      expect(names(repo.search({ country: 'CANADA' }))).toEqual(['Gamma College']);
    });

    it('matches country code case-insensitively', () => {
      expect(names(repo.search({ countryCode: 'mx' }))).toEqual(['Delta University']);
    });

    it('matches city and state exactly, ignoring case', () => {
      expect(names(repo.search({ city: 'boston' }))).toEqual(['Alpha University']);
      expect(names(repo.search({ state: 'tx' }))).toEqual(['Beta Institute of Technology']);
      expect(repo.search({ city: 'Bost' })).toEqual([]);
    });

    it('returns nothing when no record matches', () => {
      expect(repo.search({ countryCode: 'XX' })).toEqual([]);
    });
  });

  describe('classification filters', () => {
    it('filters by a single type and by a list of types', () => {
      expect(names(repo.search({ type: UniversityType.PUBLIC }))).toEqual(['Gamma College']);
      expect(names(repo.search({ type: [UniversityType.PUBLIC, UniversityType.TECHNICAL] }))).toEqual([
        'Beta Institute of Technology',
        'Gamma College',
      ]);
    });

    it('filters by a single size and by a list of sizes', () => {
      expect(names(repo.search({ size: UniversitySize.LARGE }))).toEqual(['Alpha University']);
      expect(names(repo.search({ size: [UniversitySize.LARGE, UniversitySize.MEDIUM] }))).toEqual([
        'Alpha University',
        'Gamma College',
      ]);
    });

    it('filters by one degree level and by any of several', () => {
      expect(names(repo.search({ degreeLevel: DegreeLevel.DOCTORAL }))).toEqual(['Alpha University']);
      expect(names(repo.search({ degreeLevel: [DegreeLevel.MASTER, DegreeLevel.DOCTORAL] }))).toEqual([
        'Alpha University',
        'Beta Institute of Technology',
      ]);
    });

    it('requires every listed language', () => {
      expect(names(repo.search({ languages: ['en', 'es'] }))).toEqual(['Beta Institute of Technology']);
      expect(names(repo.search({ languages: ['en'] }))).toEqual(['Alpha University', 'Beta Institute of Technology']);
    });

    it('requires every listed accreditation', () => {
      expect(names(repo.search({ accreditation: ['SACSCOC', 'ABET'] }))).toEqual(['Beta Institute of Technology']);
      expect(repo.search({ accreditation: ['SACSCOC', 'NECHE'] })).toEqual([]);
    });

    it('matches program names by fragment', () => {
      expect(names(repo.search({ hasProgram: 'computer' }))).toEqual(['Alpha University']);
      expect(repo.search({ hasProgram: 'astronomy' })).toEqual([]);
    });
  });

  describe('numeric filters (zero is a real value)', () => {
    it('foundedAfter and foundedBefore are exclusive bounds', () => {
      expect(names(repo.search({ foundedAfter: 1636 }))).toEqual(['Beta Institute of Technology']);
      expect(names(repo.search({ foundedBefore: 1900 }))).toEqual(['Alpha University', 'Gamma College']);
    });

    it('applies foundedBefore: 0 instead of ignoring it', () => {
      // Nothing was founded before year 0, and records without a year never match.
      expect(repo.search({ foundedBefore: 0 })).toEqual([]);
    });

    it('applies foundedAfter: 0 instead of ignoring it', () => {
      // delta has no foundedYear so it is excluded; gamma (year 0) is not strictly after 0.
      expect(names(repo.search({ foundedAfter: 0 }))).toEqual(['Alpha University', 'Beta Institute of Technology']);
    });

    it('minStudentCount is inclusive and minStudentCount: 0 still excludes records without a count', () => {
      expect(names(repo.search({ minStudentCount: 12000 }))).toEqual(['Alpha University', 'Gamma College']);
      expect(names(repo.search({ minStudentCount: 0 }))).toEqual([
        'Alpha University',
        'Beta Institute of Technology',
        'Gamma College',
      ]);
    });

    it('maxStudentCount is inclusive and maxStudentCount: 0 keeps only records with exactly zero', () => {
      expect(names(repo.search({ maxStudentCount: 12000 }))).toEqual(['Beta Institute of Technology', 'Gamma College']);
      expect(names(repo.search({ maxStudentCount: 0 }))).toEqual(['Beta Institute of Technology']);
    });
  });

  describe('sorting', () => {
    it('sorts by name in both directions', () => {
      expect(names(repo.search({ sortBy: UniversitySortField.NAME }))).toEqual([
        'Alpha University',
        'Beta Institute of Technology',
        'Delta University',
        'Gamma College',
      ]);
      expect(names(repo.search({ sortBy: UniversitySortField.NAME, sortOrder: 'desc' }))[0]).toBe('Gamma College');
    });

    it('sorts by country', () => {
      expect(names(repo.search({ sortBy: UniversitySortField.COUNTRY })).slice(0, 1)).toEqual(['Gamma College']);
      expect(names(repo.search({ sortBy: UniversitySortField.COUNTRY, sortOrder: 'desc' }))[0]).toBe(
        'Alpha University'
      );
    });

    it('sorts by founded year, treating a missing year as 0', () => {
      const ascending = names(repo.search({ sortBy: UniversitySortField.FOUNDED_YEAR }));
      expect(ascending.slice(-2)).toEqual(['Alpha University', 'Beta Institute of Technology']);
      expect(names(repo.search({ sortBy: UniversitySortField.FOUNDED_YEAR, sortOrder: 'desc' }))[0]).toBe(
        'Beta Institute of Technology'
      );
    });

    it('sorts by student count in both directions', () => {
      expect(names(repo.search({ sortBy: UniversitySortField.STUDENT_COUNT, sortOrder: 'desc' }))).toEqual([
        'Alpha University',
        'Gamma College',
        'Beta Institute of Technology',
        'Delta University',
      ]);
      expect(names(repo.search({ sortBy: UniversitySortField.STUDENT_COUNT }))[3]).toBe('Alpha University');
    });

    it('sorts by data quality score', () => {
      expect(names(repo.search({ sortBy: UniversitySortField.DATA_QUALITY, sortOrder: 'desc' }))[0]).toBe(
        'Alpha University'
      );
      expect(names(repo.search({ sortBy: UniversitySortField.DATA_QUALITY }))[0]).toBe('Beta Institute of Technology');
    });

    it('sorts by data quality for records that are missing dataQuality', () => {
      const bare = { ...delta, id: 'bare', name: 'Bare College', dataQuality: undefined } as unknown as University;
      const sorted = new UniversityRepository([alpha, bare]).search({ sortBy: UniversitySortField.DATA_QUALITY });
      expect(names(sorted)).toEqual(['Bare College', 'Alpha University']);
    });
  });

  describe('pagination', () => {
    const sorted = { sortBy: UniversitySortField.NAME };

    it('limits results', () => {
      expect(repo.search({ ...sorted, limit: 2 })).toHaveLength(2);
    });

    it('returns no results for limit: 0', () => {
      expect(repo.search({ limit: 0 })).toEqual([]);
    });

    it('skips records with offset', () => {
      expect(names(repo.search({ ...sorted, offset: 2 }))).toEqual(['Delta University', 'Gamma College']);
    });

    it('combines offset and limit', () => {
      expect(names(repo.search({ ...sorted, offset: 1, limit: 2 }))).toEqual([
        'Beta Institute of Technology',
        'Delta University',
      ]);
    });

    it('returns an empty page past the end', () => {
      expect(repo.search({ offset: 10 })).toEqual([]);
    });
  });

  describe('stats', () => {
    it('counts by country, type and size', () => {
      const stats = repo.stats();
      expect(stats.totalCount).toBe(4);
      expect(stats.countByCountry).toEqual({ US: 2, CA: 1, MX: 1 });
      expect(stats.countByType[UniversityType.PUBLIC]).toBe(1);
      expect(stats.countByType[UniversityType.TECHNICAL]).toBe(1);
      expect(stats.countByType[UniversityType.RESEARCH]).toBe(0);
      expect(stats.countBySize[UniversitySize.LARGE]).toBe(1);
      expect(stats.countBySize[UniversitySize.VERY_LARGE]).toBe(0);
    });

    it('computes the average and extremes from records that have the data', () => {
      const stats = repo.stats();
      // (30000 + 0 + 12000) / 3 records that have a studentCount; delta is ignored.
      expect(stats.averageStudentCount).toBe(14000);
      expect(stats.largestUniversity?.name).toBe('Alpha University');
      expect(stats.smallestUniversity?.name).toBe('Beta Institute of Technology');
      // Records with a foundedYear: alpha 1636, beta 1900, gamma 0.
      expect(stats.oldestUniversity?.name).toBe('Gamma College');
      expect(stats.newestUniversity?.name).toBe('Beta Institute of Technology');
    });

    it('reports 0 and undefined when no record has enrichment data', () => {
      const stats = new UniversityRepository([delta]).stats();
      expect(stats.totalCount).toBe(1);
      expect(stats.averageStudentCount).toBe(0);
      expect(stats.largestUniversity).toBeUndefined();
      expect(stats.smallestUniversity).toBeUndefined();
      expect(stats.oldestUniversity).toBeUndefined();
      expect(stats.newestUniversity).toBeUndefined();
    });

    it('handles an empty repository', () => {
      const stats = new UniversityRepository().stats();
      expect(stats.totalCount).toBe(0);
      expect(stats.countByCountry).toEqual({});
      expect(stats.averageStudentCount).toBe(0);
    });

    it('ignores type and size values that are not in the enums', () => {
      const odd = makeUniversity({ id: 'odd', name: 'Odd', type: 'mystery' as UniversityType });
      const stats = new UniversityRepository([odd]).stats();
      expect(Object.values(stats.countByType).every(n => n === 0)).toBe(true);
    });
  });
});
