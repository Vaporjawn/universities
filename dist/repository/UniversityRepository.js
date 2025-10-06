"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversityRepository = void 0;
const University_1 = require("../types/University");
class UniversityRepository {
    constructor(universities = []) {
        this.universities = [];
        this.universities = universities;
    }
    setData(universities) {
        this.universities = universities;
    }
    getAll() {
        return this.universities;
    }
    search(options = {}) {
        let results = [...this.universities];
        if (options.name) {
            const term = options.name.toLowerCase();
            results = results.filter(u => u.name.toLowerCase().includes(term));
        }
        if (options.country) {
            const country = options.country.toLowerCase();
            results = results.filter(u => { var _a; return ((_a = u.country) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === country; });
        }
        if (options.countryCode) {
            const code = options.countryCode.toUpperCase();
            results = results.filter(u => { var _a; return ((_a = u.countryCode) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === code; });
        }
        if (options.type) {
            const types = Array.isArray(options.type) ? options.type : [options.type];
            results = results.filter(u => u.type && types.includes(u.type));
        }
        if (options.foundedAfter) {
            results = results.filter(u => u.foundedYear && u.foundedYear > options.foundedAfter);
        }
        if (options.foundedBefore) {
            results = results.filter(u => u.foundedYear && u.foundedYear < options.foundedBefore);
        }
        if (options.hasProgram) {
            const programTerm = options.hasProgram.toLowerCase();
            results = results.filter(u => { var _a; return (_a = u.programs) === null || _a === void 0 ? void 0 : _a.some(p => p.name.toLowerCase().includes(programTerm)); });
        }
        if (options.degreeLevel) {
            const degrees = Array.isArray(options.degreeLevel) ? options.degreeLevel : [options.degreeLevel];
            results = results.filter(u => { var _a; return (_a = u.degrees) === null || _a === void 0 ? void 0 : _a.some(d => degrees.includes(d)); });
        }
        if (options.languages) {
            results = results.filter(u => { var _a; return (_a = options.languages) === null || _a === void 0 ? void 0 : _a.every(l => { var _a; return (_a = u.languages) === null || _a === void 0 ? void 0 : _a.includes(l); }); });
        }
        if (options.minStudentCount) {
            results = results.filter(u => u.studentCount && u.studentCount >= options.minStudentCount);
        }
        if (options.maxStudentCount) {
            results = results.filter(u => u.studentCount && u.studentCount <= options.maxStudentCount);
        }
        // Sorting
        if (options.sortBy) {
            const order = options.sortOrder === 'desc' ? -1 : 1;
            switch (options.sortBy) {
                case University_1.UniversitySortField.NAME:
                    results.sort((a, b) => a.name.localeCompare(b.name) * order);
                    break;
                case University_1.UniversitySortField.COUNTRY:
                    results.sort((a, b) => (a.country || '').localeCompare(b.country || '') * order);
                    break;
                case University_1.UniversitySortField.FOUNDED_YEAR:
                    results.sort((a, b) => ((a.foundedYear || 0) - (b.foundedYear || 0)) * order);
                    break;
                case University_1.UniversitySortField.STUDENT_COUNT:
                    results.sort((a, b) => ((a.studentCount || 0) - (b.studentCount || 0)) * order);
                    break;
            }
        }
        // Pagination
        const offset = options.offset || 0;
        const limit = options.limit || results.length;
        return results.slice(offset, offset + limit);
    }
    stats() {
        const countByCountry = {};
        for (const u of this.universities) {
            countByCountry[u.countryCode] = (countByCountry[u.countryCode] || 0) + 1;
        }
        const countByType = Object.values(University_1.UniversityType).reduce((acc, t) => (Object.assign(Object.assign({}, acc), { [t]: 0 })), {});
        const countBySize = Object.values(University_1.UniversitySize).reduce((acc, s) => (Object.assign(Object.assign({}, acc), { [s]: 0 })), {});
        // We could populate types/sizes if data exists
        for (const u of this.universities) {
            if (u.type && countByType[u.type] !== undefined)
                countByType[u.type] += 1;
            if (u.size && countBySize[u.size] !== undefined)
                countBySize[u.size] += 1;
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
exports.UniversityRepository = UniversityRepository;
//# sourceMappingURL=UniversityRepository.js.map