import fs from 'fs';
import os from 'os';
import path from 'path';
import { countryNameFromCode, isKnownCountryCode } from '../data/loadBase';
import { RawCsvRow, readRawCsvRows, validateDatasetRows } from '../data/validation';

const row = (line: number, ...fields: string[]): RawCsvRow => ({ line, fields });
const rulesOf = (rows: RawCsvRow[], reviewed: string[] = []) =>
  validateDatasetRows(rows, { reviewedDuplicates: new Set(reviewed) })
    .issues.map(i => i.rule)
    .sort();

describe('validateDatasetRows', () => {
  it('accepts a clean file', () => {
    const report = validateDatasetRows([
      row(1, 'US', 'Harvard University', 'http://www.harvard.edu/'),
      row(2, 'GB', 'University of Oxford', 'https://www.ox.ac.uk/'),
    ]);
    expect(report.issues).toEqual([]);
    expect(report.rowCount).toBe(2);
  });

  it('flags rows that do not have exactly three fields', () => {
    expect(rulesOf([row(1, 'US', 'Only Two')])).toEqual(['field-count']);
    expect(rulesOf([row(1, 'US', 'A', 'http://a.edu/', 'extra')])).toEqual(['field-count']);
  });

  it('flags malformed and unknown country codes separately', () => {
    expect(rulesOf([row(1, 'usa', 'A', 'http://a.edu/')])).toEqual(['country-code-format']);
    expect(rulesOf([row(1, 'ZZ', 'A', 'http://a.edu/')])).toEqual(['unknown-country-code']);
  });

  it('flags empty names', () => {
    expect(rulesOf([row(1, 'US', '', 'http://a.edu/')])).toContain('empty-name');
  });

  it('flags leading and trailing whitespace in any field', () => {
    expect(rulesOf([row(1, 'US', 'Name ', 'http://a.edu/')])).toEqual(['surrounding-whitespace']);
    expect(rulesOf([row(1, 'US', 'Name', ' http://a.edu/')]).includes('surrounding-whitespace')).toBe(true);
  });

  it.each(['www.a.edu', 'ftp://a.edu/', 'http://a.edu/page#frag', 'http://', 'http://a b.edu/', 'http://localhost/'])(
    'flags the URL %p',
    url => {
      expect(rulesOf([row(1, 'US', 'A', url)])).toContain('invalid-url');
    }
  );

  it('flags duplicate rows case-insensitively, reporting the second line', () => {
    const report = validateDatasetRows([
      row(1, 'US', 'A College', 'http://a.edu/'),
      row(2, 'US', 'a college', 'http://A.edu/'),
    ]);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ rule: 'duplicate-row', severity: 'error', line: 2 });
  });

  it('accepts a duplicate that was reviewed', () => {
    const rows = [row(1, 'US', 'A College', 'http://a.edu/'), row(2, 'US', 'A College', 'http://a.edu/')];
    expect(rulesOf(rows, ['US|a college|http://a.edu/'])).toEqual([]);
  });

  it('does not treat the same name in different countries or with different URLs as duplicate rows', () => {
    const report = validateDatasetRows([
      row(1, 'US', 'Columbia College', 'http://a.edu/'),
      row(2, 'US', 'Columbia College', 'http://b.edu/'),
      row(3, 'CA', 'Columbia College', 'http://a.edu/'),
    ]);
    expect(report.issues).toEqual([]);
    expect(report.sameNameDifferentUrlGroups).toBe(1);
  });

  it('counts shared websites without failing', () => {
    const report = validateDatasetRows([
      row(1, 'US', 'Campus One', 'http://www.example.edu/one'),
      row(2, 'US', 'Campus Two', 'https://example.edu/two'),
      row(3, 'US', 'Elsewhere', 'http://other.edu/'),
    ]);
    expect(report.issues).toEqual([]);
    expect(report.sharedWebsiteGroups).toBe(1);
  });

  it('keeps checking the remaining rows after a malformed one', () => {
    expect(rulesOf([row(1, 'US'), row(2, 'US', 'A ', 'http://a.edu/')])).toEqual([
      'field-count',
      'surrounding-whitespace',
    ]);
  });
});

describe('readRawCsvRows', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataset-test-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns untrimmed fields with 1-based line numbers and keeps short rows visible', async () => {
    const file = path.join(dir, 'raw.csv');
    fs.writeFileSync(file, 'US,"Name, With Comma ",http://a.edu/\nUS,Only Two\n');
    const rows = await readRawCsvRows(file);
    expect(rows).toEqual([
      { line: 1, fields: ['US', 'Name, With Comma ', 'http://a.edu/'] },
      { line: 2, fields: ['US', 'Only Two'] },
    ]);
  });

  it('rejects instead of hanging when the file does not exist', async () => {
    await expect(readRawCsvRows(path.join(dir, 'missing.csv'))).rejects.toThrow('ENOENT');
  });
});

describe('country names', () => {
  it.each([
    ['AN', 'Netherlands Antilles'],
    ['GU', 'Guam'],
    ['ME', 'Montenegro'],
    ['NU', 'Niue'],
    ['SB', 'Solomon Islands'],
    ['SM', 'San Marino'],
    ['SS', 'South Sudan'],
    ['VA', 'Holy See (Vatican City State)'],
  ])('maps %s to %s', (code, name) => {
    expect(isKnownCountryCode(code)).toBe(true);
    expect(countryNameFromCode(code)).toBe(name);
  });

  it('does not treat inherited object keys as country codes', () => {
    expect(isKnownCountryCode('constructor')).toBe(false);
    expect(isKnownCountryCode('ZZ')).toBe(false);
  });
});

describe('world-universities.csv', () => {
  it('passes every validation rule (duplicates must be listed in scripts/data/reviewed-duplicates.json)', async () => {
    const reviewed = new Set<string>(
      JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'scripts', 'data', 'reviewed-duplicates.json'), 'utf8')
      ).reviewed
    );
    const report = validateDatasetRows(await readRawCsvRows(path.join(process.cwd(), 'world-universities.csv')), {
      reviewedDuplicates: reviewed,
    });
    expect(report.issues.map(i => `line ${i.line}: [${i.rule}] ${i.message}`)).toEqual([]);
    expect(report.rowCount).toBeGreaterThan(11000);
  });
});
