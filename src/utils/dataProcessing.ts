import * as fs from 'fs/promises';
import { University, UniversityType } from '../types/University';

/**
 * Load universities from a CSV file
 * @param filePath - Path to the CSV file
 * @returns Promise resolving to array of University objects
 */
export async function loadUniversitiesFromCSV(filePath: string): Promise<University[]> {
  try {
    const csvContent = await fs.readFile(filePath, 'utf-8');
    const lines = splitCSVRecords(csvContent);
    if (lines.length === 0) return [];
    const headers = parseCSVLine(lines[0]);

    const universities: University[] = [];

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
  } catch (error) {
    throw new Error(`Failed to load universities from CSV: ${errorMessage(error)}`);
  }
}

/**
 * Save universities to a CSV file
 * @param universities - Array of University objects
 * @param filePath - Path to save the CSV file
 */
export async function saveUniversitiesToCSV(universities: University[], filePath: string): Promise<void> {
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
        university.foundedYear?.toString() || '',
        escapeCSVValue(university.type || ''),
        university.studentCount?.toString() || '',
        university.coordinates?.latitude?.toString() || '',
        university.coordinates?.longitude?.toString() || '',
        escapeCSVValue(university.description || ''),
      ];
      csvLines.push(values.join(','));
    }

    await fs.writeFile(filePath, csvLines.join('\n'), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save universities to CSV: ${errorMessage(error)}`);
  }
}

/**
 * Filter universities based on criteria.
 *
 * Range filters (`foundedYearRange`, `studentCountRange`) only judge records that have the value;
 * a record with no `foundedYear` or `studentCount` is not excluded by them.
 * @param universities - Array of universities to filter
 * @param criteria - Filter criteria
 * @returns Filtered array of universities
 */
export function filterUniversities(
  universities: University[],
  criteria: {
    country?: string;
    state?: string;
    type?: string;
    foundedYearRange?: { min?: number; max?: number };
    studentCountRange?: { min?: number; max?: number };
    hasLocation?: boolean;
  }
): University[] {
  return universities.filter(university => {
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
      if (min && university.foundedYear < min) return false;
      if (max && university.foundedYear > max) return false;
    }

    if (criteria.studentCountRange && university.studentCount) {
      const { min, max } = criteria.studentCountRange;
      if (min && university.studentCount < min) return false;
      if (max && university.studentCount > max) return false;
    }

    if (criteria.hasLocation !== undefined) {
      const hasLocation = !!(university.city || university.coordinates?.latitude);
      if (criteria.hasLocation !== hasLocation) return false;
    }

    return true;
  });
}

/**
 * Search universities by name
 * @param universities - Array of universities to search
 * @param query - Search query
 * @returns Array of matching universities
 */
export function searchUniversities(universities: University[], query: string): University[] {
  const normalizedQuery = query.toLowerCase();

  return universities
    .filter(university => university.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      // Prioritize exact matches, then starts with, then contains
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      if (aName === normalizedQuery) return -1;
      if (bName === normalizedQuery) return 1;

      if (aName.startsWith(normalizedQuery) && !bName.startsWith(normalizedQuery)) return -1;
      if (bName.startsWith(normalizedQuery) && !aName.startsWith(normalizedQuery)) return 1;

      return aName.localeCompare(bName);
    });
}

/**
 * Validate and normalize university data
 * @param data - Partial university data
 * @returns Complete University object
 */
export function validateUniversityData(data: Partial<University>): University {
  if (!data.name?.trim()) {
    throw new Error('University name is required');
  }

  if (!data.country?.trim()) {
    throw new Error('University country is required');
  }

  if (!data.countryCode?.trim()) {
    throw new Error('University country code is required');
  }

  if (!data.url?.trim()) {
    throw new Error('University URL is required');
  }

  // Validate country code format
  if (!/^[A-Z]{2}$/.test(data.countryCode)) {
    throw new Error('Country code must be exactly 2 uppercase letters');
  }

  // Validate URL
  try {
    new URL(data.url);
  } catch {
    throw new Error(`Invalid URL: ${data.url}`);
  }

  return {
    id: data.id || `${data.countryCode}-${data.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: data.name.trim(),
    country: data.country.trim(),
    countryCode: data.countryCode.trim(),
    url: data.url.trim(),
    domain: data.domain?.trim(),
    city: data.city?.trim(),
    state: data.state?.trim(),
    region: data.region?.trim(),
    foundedYear: data.foundedYear,
    type: data.type,
    studentCount: data.studentCount,
    coordinates: data.coordinates,
    description: data.description?.trim(),
    lastUpdated: data.lastUpdated || new Date(),
    dataQuality: data.dataQuality || { completeness: 0.5, accuracy: 0.5, freshness: 0.5, reliability: 0.5 },
    sources: data.sources || [],
  };
}

/**
 * Message of a thrown value. Checks the shape instead of `instanceof Error`, which is false for
 * errors created in another realm (Node core errors seen from a Jest test, for example).
 */
function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error)
    return String((error as { message: unknown }).message);
  return 'Unknown error';
}

/**
 * Split CSV text into records. A line break inside a double-quoted field belongs to that field, so
 * it does not end the record. Handles \n and \r\n, and skips blank records.
 */
function splitCSVRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes; // an escaped "" toggles twice and nets out
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (current.trim()) records.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  return records;
}

/**
 * Parse a CSV line handling quoted values and commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Parse university data from CSV headers and values
 */
function parseUniversityFromCSV(headers: string[], values: string[]): University | null {
  try {
    const data: Partial<University> = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      const value = values[i]?.trim();

      if (!value) continue;

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
          if (!isNaN(year)) data.foundedYear = year;
          break;
        case 'type':
          // Unknown values are ignored rather than rejecting the whole record.
          if ((Object.values(UniversityType) as string[]).includes(value)) data.type = value as UniversityType;
          break;
        case 'studentcount':
        case 'student_count':
          const count = parseInt(value);
          if (!isNaN(count)) data.studentCount = count;
          break;
        case 'latitude':
          const lat = parseFloat(value);
          if (!isNaN(lat)) {
            if (!data.coordinates) data.coordinates = { latitude: 0, longitude: 0 };
            data.coordinates.latitude = lat;
          }
          break;
        case 'longitude':
          const lng = parseFloat(value);
          if (!isNaN(lng)) {
            if (!data.coordinates) data.coordinates = { latitude: 0, longitude: 0 };
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
    if (!data.countryCode) data.countryCode = 'XX';
    if (!data.url) data.url = `https://${data.domain || 'example.com'}`;

    return validateUniversityData(data);
  } catch {
    // Skip invalid records
    return null;
  }
}

/**
 * Escape CSV value by wrapping in quotes if necessary
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
