import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  filterUniversities,
  loadUniversitiesFromCSV,
  saveUniversitiesToCSV,
  searchUniversities,
  validateUniversityData,
} from '../utils/dataProcessing';
import { University, UniversityType } from '../types/University';

function makeUniversity(overrides: Partial<University> = {}): University {
  return {
    id: 'us-example-university',
    name: 'Example University',
    country: 'United States',
    countryCode: 'US',
    url: 'http://www.example.edu/',
    lastUpdated: new Date('2026-01-01'),
    dataQuality: { completeness: 0.5, accuracy: 0.5, freshness: 0.5, reliability: 0.5 },
    sources: [],
    ...overrides,
  };
}

describe('dataProcessing', () => {
  let dir: string;
  let counter = 0;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataprocessing-test-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const tempFile = (content?: string): string => {
    const file = path.join(dir, `file-${counter++}.csv`);
    if (content !== undefined) fs.writeFileSync(file, content);
    return file;
  };

  describe('validateUniversityData', () => {
    const valid = {
      name: 'Harvard University',
      country: 'United States',
      countryCode: 'US',
      url: 'http://www.harvard.edu/',
    };

    it('fills in id, timestamps, quality and sources when they are missing', () => {
      const result = validateUniversityData(valid);
      expect(result.id).toBe('us-harvard-university');
      expect(result.lastUpdated).toBeInstanceOf(Date);
      expect(result.dataQuality).toEqual({ completeness: 0.5, accuracy: 0.5, freshness: 0.5, reliability: 0.5 });
      expect(result.sources).toEqual([]);
    });

    it('keeps provided values and trims text fields', () => {
      const lastUpdated = new Date('2020-02-02');
      const result = validateUniversityData({
        ...valid,
        id: 'custom-id',
        name: '  Harvard University  ',
        city: ' Cambridge ',
        state: ' MA ',
        region: ' New England ',
        domain: ' harvard.edu ',
        description: ' Old ',
        foundedYear: 1636,
        studentCount: 23000,
        lastUpdated,
        sources: ['registry'],
      });
      expect(result).toMatchObject({
        id: 'custom-id',
        name: 'Harvard University',
        city: 'Cambridge',
        state: 'MA',
        region: 'New England',
        domain: 'harvard.edu',
        description: 'Old',
        foundedYear: 1636,
        studentCount: 23000,
        sources: ['registry'],
      });
      expect(result.lastUpdated).toBe(lastUpdated);
    });

    it.each([
      ['name', { name: '' }, 'University name is required'],
      ['name (whitespace only)', { name: '   ' }, 'University name is required'],
      ['country', { country: '' }, 'University country is required'],
      ['country code', { countryCode: '' }, 'University country code is required'],
      ['URL', { url: '' }, 'University URL is required'],
    ])('requires a %s', (_label, override, message) => {
      expect(() => validateUniversityData({ ...valid, ...override })).toThrow(message);
    });

    it.each(['us', 'USA', 'U1', ' US'])('rejects the country code %p', code => {
      expect(() => validateUniversityData({ ...valid, countryCode: code })).toThrow(
        /Country code must be exactly 2 uppercase letters|country code is required/
      );
    });

    it('rejects a URL that does not parse', () => {
      expect(() => validateUniversityData({ ...valid, url: 'not a url' })).toThrow('Invalid URL: not a url');
    });
  });

  describe('filterUniversities', () => {
    const universities = [
      makeUniversity({
        id: 'a',
        name: 'A',
        country: 'United States',
        state: 'MA',
        type: UniversityType.PRIVATE,
        foundedYear: 1636,
        studentCount: 23000,
        city: 'Cambridge',
      }),
      makeUniversity({
        id: 'b',
        name: 'B',
        country: 'United States',
        state: 'TX',
        type: UniversityType.PUBLIC,
        foundedYear: 1883,
        studentCount: 50000,
        coordinates: { latitude: 30.28, longitude: -97.73 },
      }),
      makeUniversity({
        id: 'c',
        name: 'C',
        country: 'Canada',
        countryCode: 'CA',
        type: UniversityType.PUBLIC,
        foundedYear: 1827,
        studentCount: 90000,
      }),
      makeUniversity({ id: 'd', name: 'D', country: 'Canada', countryCode: 'CA' }),
    ];
    const ids = (list: University[]) => list.map(u => u.id);

    it('returns everything for empty criteria', () => {
      expect(ids(filterUniversities(universities, {}))).toEqual(['a', 'b', 'c', 'd']);
    });

    it('filters by exact country, state and type', () => {
      expect(ids(filterUniversities(universities, { country: 'Canada' }))).toEqual(['c', 'd']);
      expect(ids(filterUniversities(universities, { state: 'TX' }))).toEqual(['b']);
      expect(ids(filterUniversities(universities, { type: UniversityType.PUBLIC }))).toEqual(['b', 'c']);
    });

    it('applies inclusive founded-year bounds, passing records that have no year', () => {
      expect(ids(filterUniversities(universities, { foundedYearRange: { min: 1827, max: 1883 } }))).toEqual([
        'b',
        'c',
        'd',
      ]);
      expect(ids(filterUniversities(universities, { foundedYearRange: { max: 1700 } }))).toEqual(['a', 'd']);
    });

    it('applies inclusive student-count bounds, passing records that have no count', () => {
      expect(ids(filterUniversities(universities, { studentCountRange: { min: 50000, max: 90000 } }))).toEqual([
        'b',
        'c',
        'd',
      ]);
      expect(ids(filterUniversities(universities, { studentCountRange: { max: 23000 } }))).toEqual(['a', 'd']);
    });

    it('filters by whether a location is known (city or latitude)', () => {
      expect(ids(filterUniversities(universities, { hasLocation: true }))).toEqual(['a', 'b']);
      expect(ids(filterUniversities(universities, { hasLocation: false }))).toEqual(['c', 'd']);
    });

    it('combines criteria', () => {
      expect(ids(filterUniversities(universities, { country: 'United States', type: UniversityType.PUBLIC }))).toEqual([
        'b',
      ]);
    });
  });

  describe('searchUniversities', () => {
    const universities = [
      'Technical Institute of Ohio',
      'Ohio State',
      'University of Ohio',
      'Ohio',
      'Kenyon College',
    ].map(name => makeUniversity({ id: name, name }));

    it('matches case-insensitively and excludes non-matches', () => {
      expect(searchUniversities(universities, 'KENYON').map(u => u.name)).toEqual(['Kenyon College']);
      expect(searchUniversities(universities, 'zzz')).toEqual([]);
    });

    it('ranks exact matches first, then prefix matches, then the rest alphabetically', () => {
      expect(searchUniversities(universities, 'ohio').map(u => u.name)).toEqual([
        'Ohio',
        'Ohio State',
        'Technical Institute of Ohio',
        'University of Ohio',
      ]);
    });

    it('does not modify the input array', () => {
      const before = universities.map(u => u.name);
      searchUniversities(universities, 'ohio');
      expect(universities.map(u => u.name)).toEqual(before);
    });
  });

  describe('loadUniversitiesFromCSV', () => {
    const header = 'id,name,country,countryCode,url,foundedYear,studentCount,latitude,longitude,description,type';

    it('loads rows, maps columns and builds coordinates', async () => {
      const file = tempFile(
        `${header}\nus-harvard,Harvard University,United States,US,http://www.harvard.edu/,1636,23000,42.37,-71.11,Oldest US university,private\n`
      );
      const [harvard] = await loadUniversitiesFromCSV(file);
      expect(harvard).toMatchObject({
        id: 'us-harvard',
        name: 'Harvard University',
        country: 'United States',
        countryCode: 'US',
        url: 'http://www.harvard.edu/',
        foundedYear: 1636,
        studentCount: 23000,
        coordinates: { latitude: 42.37, longitude: -71.11 },
        description: 'Oldest US university',
      });
    });

    it('accepts snake_case column names', async () => {
      const file = tempFile(
        'name,country,country_code,url,founded_year,student_count\nA,United States,US,http://a.edu/,1900,500\n'
      );
      const [uni] = await loadUniversitiesFromCSV(file);
      expect(uni).toMatchObject({ countryCode: 'US', foundedYear: 1900, studentCount: 500 });
    });

    it('handles quoted commas, CRLF line endings and blank lines', async () => {
      const file = tempFile(
        'name,country,countryCode,url\r\n"University of California, Berkeley",United States,US,http://berkeley.edu/\r\n\r\nB,Canada,CA,http://b.ca/\r\n'
      );
      const result = await loadUniversitiesFromCSV(file);
      expect(result.map(u => u.name)).toEqual(['University of California, Berkeley', 'B']);
    });

    it('skips rows with the wrong number of columns and rows that fail validation', async () => {
      const file = tempFile(
        [
          'name,country,countryCode,url',
          'Good,United States,US,http://good.edu/',
          'TooShort,United States',
          ',United States,US,http://noname.edu/',
          'NoCountry,,US,http://nocountry.edu/',
          'BadUrl,United States,US,not a url',
          'BadCode,United States,usa,http://badcode.edu/',
        ].join('\n')
      );
      expect((await loadUniversitiesFromCSV(file)).map(u => u.name)).toEqual(['Good']);
    });

    it('ignores non-numeric numbers', async () => {
      const file = tempFile(
        'name,country,countryCode,url,foundedYear,studentCount\nA,United States,US,http://a.edu/,unknown,many\n'
      );
      const [uni] = await loadUniversitiesFromCSV(file);
      expect(uni.foundedYear).toBeUndefined();
      expect(uni.studentCount).toBeUndefined();
    });

    it('returns an empty list for an empty file or a header-only file', async () => {
      expect(await loadUniversitiesFromCSV(tempFile(''))).toEqual([]);
      expect(await loadUniversitiesFromCSV(tempFile('name,country,countryCode,url\n'))).toEqual([]);
    });

    it('rejects with a descriptive error when the file is missing', async () => {
      await expect(loadUniversitiesFromCSV(tempFile())).rejects.toThrow('Failed to load universities from CSV: ENOENT');
    });
  });

  describe('saveUniversitiesToCSV', () => {
    it('writes a header and one escaped line per university', async () => {
      const file = tempFile();
      await saveUniversitiesToCSV(
        [
          makeUniversity({
            name: 'University of California, Berkeley',
            foundedYear: 1868,
            coordinates: { latitude: 37.87, longitude: -122.26 },
          }),
        ],
        file
      );
      const [header, line] = fs.readFileSync(file, 'utf8').split('\n');
      expect(header).toBe(
        'id,name,country,countryCode,url,domain,city,state,region,foundedYear,type,studentCount,latitude,longitude,description'
      );
      expect(line).toBe(
        'us-example-university,"University of California, Berkeley",United States,US,http://www.example.edu/,,,,,1868,,,37.87,-122.26,'
      );
    });

    it('rejects with a descriptive error when the target cannot be written', async () => {
      await expect(saveUniversitiesToCSV([makeUniversity()], path.join(dir, 'missing-dir', 'out.csv'))).rejects.toThrow(
        'Failed to save universities to CSV: ENOENT'
      );
    });
  });

  describe('save then load', () => {
    const roundTrip = async (university: University): Promise<University> => {
      const file = tempFile();
      await saveUniversitiesToCSV([university], file);
      const loaded = await loadUniversitiesFromCSV(file);
      expect(loaded).toHaveLength(1);
      return loaded[0];
    };

    it('preserves ordinary fields', async () => {
      const original = makeUniversity({
        city: 'Cambridge',
        state: 'MA',
        region: 'New England',
        domain: 'example.edu',
        foundedYear: 1636,
        studentCount: 23000,
        coordinates: { latitude: 42.37, longitude: -71.11 },
        description: 'A description, with a comma',
      });
      expect(await roundTrip(original)).toMatchObject({
        id: original.id,
        name: original.name,
        city: 'Cambridge',
        state: 'MA',
        region: 'New England',
        domain: 'example.edu',
        foundedYear: 1636,
        studentCount: 23000,
        coordinates: { latitude: 42.37, longitude: -71.11 },
        description: 'A description, with a comma',
      });
    });

    it('preserves double quotes inside values', async () => {
      const loaded = await roundTrip(
        makeUniversity({ name: 'School of "Arts" and Letters', description: 'He said "hello", twice' })
      );
      expect(loaded.name).toBe('School of "Arts" and Letters');
      expect(loaded.description).toBe('He said "hello", twice');
    });

    it('preserves line breaks inside values instead of dropping the record', async () => {
      const loaded = await roundTrip(makeUniversity({ description: 'First line\nSecond line' }));
      expect(loaded.description).toBe('First line\nSecond line');
    });

    it('preserves the institution type', async () => {
      expect((await roundTrip(makeUniversity({ type: UniversityType.COMMUNITY_COLLEGE }))).type).toBe(
        UniversityType.COMMUNITY_COLLEGE
      );
    });

    it('ignores a type value that is not a known UniversityType', async () => {
      const file = tempFile('name,country,countryCode,url,type\nA,United States,US,http://a.edu/,spaceship\n');
      const [uni] = await loadUniversitiesFromCSV(file);
      expect(uni.type).toBeUndefined();
    });
  });
});
