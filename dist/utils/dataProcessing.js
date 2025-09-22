"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUniversityData = exports.searchUniversities = exports.filterUniversities = exports.saveUniversitiesToCSV = exports.loadUniversitiesFromCSV = void 0;
const fs = __importStar(require("fs/promises"));
/**
 * Load universities from a CSV file
 * @param filePath - Path to the CSV file
 * @returns Promise resolving to array of University objects
 */
function loadUniversitiesFromCSV(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const csvContent = yield fs.readFile(filePath, 'utf-8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const universities = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length === headers.length) {
                    const university = parseUniversityFromCSV(headers, values);
                    if (university) {
                        universities.push(university);
                    }
                }
            }
            return universities;
        }
        catch (error) {
            throw new Error(`Failed to load universities from CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
exports.loadUniversitiesFromCSV = loadUniversitiesFromCSV;
/**
 * Save universities to a CSV file
 * @param universities - Array of University objects
 * @param filePath - Path to save the CSV file
 */
function saveUniversitiesToCSV(universities, filePath) {
    var _a, _b, _c, _d, _e, _f;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const headers = [
                'id',
                'name',
                'country',
                'countryCode',
                'url',
                'domain',
                'city',
                'state',
                'region',
                'foundedYear',
                'type',
                'studentCount',
                'latitude',
                'longitude',
                'description',
            ];
            const csvLines = [headers.join(',')];
            for (const university of universities) {
                const values = [
                    escapeCSVValue(university.id),
                    escapeCSVValue(university.name),
                    escapeCSVValue(university.country),
                    escapeCSVValue(university.countryCode),
                    escapeCSVValue(university.url),
                    escapeCSVValue(university.domain || ''),
                    escapeCSVValue(university.city || ''),
                    escapeCSVValue(university.state || ''),
                    escapeCSVValue(university.region || ''),
                    ((_a = university.foundedYear) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                    escapeCSVValue(university.type || ''),
                    ((_b = university.studentCount) === null || _b === void 0 ? void 0 : _b.toString()) || '',
                    ((_d = (_c = university.coordinates) === null || _c === void 0 ? void 0 : _c.latitude) === null || _d === void 0 ? void 0 : _d.toString()) || '',
                    ((_f = (_e = university.coordinates) === null || _e === void 0 ? void 0 : _e.longitude) === null || _f === void 0 ? void 0 : _f.toString()) || '',
                    escapeCSVValue(university.description || ''),
                ];
                csvLines.push(values.join(','));
            }
            yield fs.writeFile(filePath, csvLines.join('\n'), 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to save universities to CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
exports.saveUniversitiesToCSV = saveUniversitiesToCSV;
/**
 * Filter universities based on criteria
 * @param universities - Array of universities to filter
 * @param criteria - Filter criteria
 * @returns Filtered array of universities
 */
function filterUniversities(universities, criteria) {
    return universities.filter(university => {
        var _a;
        if (criteria.country && university.country !== criteria.country) {
            return false;
        }
        if (criteria.state && university.state !== criteria.state) {
            return false;
        }
        if (criteria.type && university.type !== criteria.type) {
            return false;
        }
        if (criteria.foundedYearRange && university.foundedYear) {
            const { min, max } = criteria.foundedYearRange;
            if (min && university.foundedYear < min)
                return false;
            if (max && university.foundedYear > max)
                return false;
        }
        if (criteria.studentCountRange && university.studentCount) {
            const { min, max } = criteria.studentCountRange;
            if (min && university.studentCount < min)
                return false;
            if (max && university.studentCount > max)
                return false;
        }
        if (criteria.hasLocation !== undefined) {
            const hasLocation = !!(university.city || ((_a = university.coordinates) === null || _a === void 0 ? void 0 : _a.latitude));
            if (criteria.hasLocation !== hasLocation)
                return false;
        }
        return true;
    });
}
exports.filterUniversities = filterUniversities;
/**
 * Search universities by name
 * @param universities - Array of universities to search
 * @param query - Search query
 * @returns Array of matching universities
 */
function searchUniversities(universities, query) {
    const normalizedQuery = query.toLowerCase();
    return universities
        .filter(university => university.name.toLowerCase().includes(normalizedQuery))
        .sort((a, b) => {
        // Prioritize exact matches, then starts with, then contains
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        if (aName === normalizedQuery)
            return -1;
        if (bName === normalizedQuery)
            return 1;
        if (aName.startsWith(normalizedQuery) && !bName.startsWith(normalizedQuery))
            return -1;
        if (bName.startsWith(normalizedQuery) && !aName.startsWith(normalizedQuery))
            return 1;
        return aName.localeCompare(bName);
    });
}
exports.searchUniversities = searchUniversities;
/**
 * Validate and normalize university data
 * @param data - Partial university data
 * @returns Complete University object
 */
function validateUniversityData(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!((_a = data.name) === null || _a === void 0 ? void 0 : _a.trim())) {
        throw new Error('University name is required');
    }
    if (!((_b = data.country) === null || _b === void 0 ? void 0 : _b.trim())) {
        throw new Error('University country is required');
    }
    if (!((_c = data.countryCode) === null || _c === void 0 ? void 0 : _c.trim())) {
        throw new Error('University country code is required');
    }
    if (!((_d = data.url) === null || _d === void 0 ? void 0 : _d.trim())) {
        throw new Error('University URL is required');
    }
    // Validate country code format
    if (!/^[A-Z]{2}$/.test(data.countryCode)) {
        throw new Error('Country code must be exactly 2 uppercase letters');
    }
    // Validate URL
    try {
        new URL(data.url);
    }
    catch (_k) {
        throw new Error(`Invalid URL: ${data.url}`);
    }
    return {
        id: data.id || `${data.countryCode}-${data.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: data.name.trim(),
        country: data.country.trim(),
        countryCode: data.countryCode.trim(),
        url: data.url.trim(),
        domain: (_e = data.domain) === null || _e === void 0 ? void 0 : _e.trim(),
        city: (_f = data.city) === null || _f === void 0 ? void 0 : _f.trim(),
        state: (_g = data.state) === null || _g === void 0 ? void 0 : _g.trim(),
        region: (_h = data.region) === null || _h === void 0 ? void 0 : _h.trim(),
        foundedYear: data.foundedYear,
        type: data.type,
        studentCount: data.studentCount,
        coordinates: data.coordinates,
        description: (_j = data.description) === null || _j === void 0 ? void 0 : _j.trim(),
        lastUpdated: data.lastUpdated || new Date(),
        dataQuality: data.dataQuality || { completeness: 0.5, accuracy: 0.5, freshness: 0.5, reliability: 0.5 },
        sources: data.sources || [],
    };
}
exports.validateUniversityData = validateUniversityData;
/**
 * Parse a CSV line handling quoted values and commas
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            }
            else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        }
        else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}
/**
 * Parse university data from CSV headers and values
 */
function parseUniversityFromCSV(headers, values) {
    var _a;
    try {
        const data = {};
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i].toLowerCase();
            const value = (_a = values[i]) === null || _a === void 0 ? void 0 : _a.replace(/"/g, '').trim();
            if (!value)
                continue;
            switch (header) {
                case 'id':
                    data.id = value;
                    break;
                case 'name':
                    data.name = value;
                    break;
                case 'country':
                    data.country = value;
                    break;
                case 'countrycode':
                case 'country_code':
                    data.countryCode = value;
                    break;
                case 'url':
                    data.url = value;
                    break;
                case 'domain':
                    data.domain = value;
                    break;
                case 'city':
                    data.city = value;
                    break;
                case 'state':
                    data.state = value;
                    break;
                case 'region':
                    data.region = value;
                    break;
                case 'foundedyear':
                case 'founded_year':
                    const year = parseInt(value);
                    if (!isNaN(year))
                        data.foundedYear = year;
                    break;
                case 'type':
                    // Skip type assignment for now, will be handled in validation
                    break;
                case 'studentcount':
                case 'student_count':
                    const count = parseInt(value);
                    if (!isNaN(count))
                        data.studentCount = count;
                    break;
                case 'latitude':
                    const lat = parseFloat(value);
                    if (!isNaN(lat)) {
                        if (!data.coordinates)
                            data.coordinates = { latitude: 0, longitude: 0 };
                        data.coordinates.latitude = lat;
                    }
                    break;
                case 'longitude':
                    const lng = parseFloat(value);
                    if (!isNaN(lng)) {
                        if (!data.coordinates)
                            data.coordinates = { latitude: 0, longitude: 0 };
                        data.coordinates.longitude = lng;
                    }
                    break;
                case 'description':
                    data.description = value;
                    break;
            }
        }
        // Ensure required fields have defaults
        if (!data.id)
            data.id = `${data.countryCode || 'XX'}-${data.name || 'unknown'}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (!data.countryCode)
            data.countryCode = 'XX';
        if (!data.url)
            data.url = `https://${data.domain || 'example.com'}`;
        return validateUniversityData(data);
    }
    catch (_b) {
        // Skip invalid records
        return null;
    }
}
/**
 * Escape CSV value by wrapping in quotes if necessary
 */
function escapeCSVValue(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
//# sourceMappingURL=dataProcessing.js.map