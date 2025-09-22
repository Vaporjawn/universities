import { loadBaseUniversities, toPartialUniversity, UniversityRepository } from '../index';
import { BaseUniversityRecord } from '../data/loadBase';
import { University } from '../types/University';
import path from 'path';

describe('Universities Library', () => {
  let baseRecords: BaseUniversityRecord[];
  let universities: Partial<University>[];
  let repository: UniversityRepository;
  const csvPath = path.join(process.cwd(), 'world-universities.csv');

  beforeAll(async () => {
    baseRecords = await loadBaseUniversities(csvPath);
    universities = baseRecords.map(toPartialUniversity);
    repository = new UniversityRepository(universities as University[]);
  });

  describe('loadBaseUniversities', () => {
    it('should load universities from CSV', async () => {
      expect(baseRecords).toBeDefined();
      expect(Array.isArray(baseRecords)).toBe(true);
      expect(baseRecords.length).toBeGreaterThan(0);
    });

    it('should load universities with required fields', async () => {
      const [record] = baseRecords;
      expect(record).toHaveProperty('countryCode');
      expect(record).toHaveProperty('name');
      expect(record).toHaveProperty('url');
      expect(typeof record.countryCode).toBe('string');
      expect(typeof record.name).toBe('string');
      expect(typeof record.url).toBe('string');
    });

    it('should convert base records to partial universities', () => {
      const [record] = baseRecords;
      const university = toPartialUniversity(record);
      expect(university).toHaveProperty('name');
      expect(university).toHaveProperty('country');
      expect(university).toHaveProperty('countryCode');
      expect(university).toHaveProperty('url');
    });
  });

  describe('UniversityRepository', () => {
    it('should initialize with universities', () => {
      expect(repository).toBeDefined();
      expect(repository.stats().totalCount).toBe(universities.length);
    });

    it('should search by country code', () => {
      const usUniversities = repository.search({ countryCode: 'US', limit: 10 });
      expect(usUniversities.length).toBeGreaterThan(0);
      expect(usUniversities.length).toBeLessThanOrEqual(10);
      usUniversities.forEach(uni => {
        expect(uni.countryCode).toBe('US');
      });
    });

    it('should search by name fragment', () => {
      const techUniversities = repository.search({ name: 'Tech', limit: 5 });
      expect(techUniversities.length).toBeGreaterThan(0);
      techUniversities.forEach(uni => {
        expect(uni.name?.toLowerCase()).toContain('tech');
      });
    });

    it('should limit results correctly', () => {
      const limitedResults = repository.search({ limit: 3 });
      expect(limitedResults.length).toBe(3);
    });

    it('should return empty array for invalid country code', () => {
      const results = repository.search({ countryCode: 'XX' });
      expect(results.length).toBe(0);
    });

    it('should provide meaningful statistics', () => {
      const stats = repository.stats();
      expect(stats.totalCount).toBeGreaterThan(0);
      expect(Object.keys(stats.countByCountry).length).toBeGreaterThan(0);
      expect(typeof stats.countByType).toBe('object');
      expect(typeof stats.countBySize).toBe('object');
    });
  });

  describe('Search functionality', () => {
    it('should handle multiple search criteria', () => {
      const results = repository.search({
        countryCode: 'US',
        name: 'University',
        limit: 5,
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      results.forEach(uni => {
        expect(uni.countryCode).toBe('US');
        expect(uni.name?.toLowerCase()).toContain('university');
      });
    });

    it('should handle empty search criteria', () => {
      const results = repository.search({});
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Data integrity', () => {
    it('should have valid URLs', () => {
      const sampleRecords = baseRecords.slice(0, 100);
      sampleRecords.forEach(record => {
        expect(typeof record.url).toBe('string');
        expect(record.url).toMatch(/^https?:\/\//);
      });
    });

    it('should have valid country codes', () => {
      const countryCodes = [...new Set(baseRecords.map(r => r.countryCode))];
      countryCodes.forEach(code => {
        expect(typeof code).toBe('string');
        expect(code.length).toBe(2);
        expect(code).toMatch(/^[A-Z]{2}$/);
      });
    });

    it('should have non-empty university names', () => {
      const sampleRecords = baseRecords.slice(0, 100);
      sampleRecords.forEach(record => {
        expect(typeof record.name).toBe('string');
        expect(record.name.length).toBeGreaterThan(0);
      });
    });
  });
});
