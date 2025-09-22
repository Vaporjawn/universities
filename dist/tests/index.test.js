"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const path_1 = __importDefault(require("path"));
describe('Universities Library', () => {
    let baseRecords;
    let universities;
    let repository;
    const csvPath = path_1.default.join(process.cwd(), 'world-universities.csv');
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        baseRecords = yield (0, index_1.loadBaseUniversities)(csvPath);
        universities = baseRecords.map(index_1.toPartialUniversity);
        repository = new index_1.UniversityRepository(universities);
    }));
    describe('loadBaseUniversities', () => {
        it('should load universities from CSV', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(baseRecords).toBeDefined();
            expect(Array.isArray(baseRecords)).toBe(true);
            expect(baseRecords.length).toBeGreaterThan(0);
        }));
        it('should load universities with required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const [record] = baseRecords;
            expect(record).toHaveProperty('countryCode');
            expect(record).toHaveProperty('name');
            expect(record).toHaveProperty('url');
            expect(typeof record.countryCode).toBe('string');
            expect(typeof record.name).toBe('string');
            expect(typeof record.url).toBe('string');
        }));
        it('should convert base records to partial universities', () => {
            const [record] = baseRecords;
            const university = (0, index_1.toPartialUniversity)(record);
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
                var _a;
                expect((_a = uni.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('tech');
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
                var _a;
                expect(uni.countryCode).toBe('US');
                expect((_a = uni.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('university');
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
//# sourceMappingURL=index.test.js.map