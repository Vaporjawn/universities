import fs from 'fs';
import path from 'path';
import { estimateSize, inferGeography } from '../data/regions';
import { buildBaseUniversities } from '../data/baseUniversities';
import { Continent, UniversitySize } from '../types/University';

const csvCodes = [
  ...new Set(
    fs
      .readFileSync(path.join(__dirname, '..', '..', 'world-universities.csv'), 'utf8')
      .split('\n')
      .map(line => line.split(',')[0])
      .filter(Boolean)
  ),
];

describe('inferGeography', () => {
  it('knows every country code used by the dataset', () => {
    expect(csvCodes.length).toBeGreaterThan(150);
    expect(csvCodes.filter(code => !inferGeography(code))).toEqual([]);
  });

  it.each([
    ['US', Continent.NORTH_AMERICA, 'Northern America'],
    ['MX', Continent.NORTH_AMERICA, 'Central America'],
    ['JM', Continent.NORTH_AMERICA, 'Caribbean'],
    ['BR', Continent.SOUTH_AMERICA, 'South America'],
    ['GB', Continent.EUROPE, 'Northern Europe'],
    ['DE', Continent.EUROPE, 'Western Europe'],
    ['RU', Continent.EUROPE, 'Eastern Europe'],
    ['TR', Continent.ASIA, 'Western Asia'],
    ['JP', Continent.ASIA, 'Eastern Asia'],
    ['EG', Continent.AFRICA, 'Northern Africa'],
    ['ZA', Continent.AFRICA, 'Southern Africa'],
    ['AU', Continent.OCEANIA, 'Australia and New Zealand'],
    ['FJ', Continent.OCEANIA, 'Melanesia'],
  ])('puts %s in %s / %s', (code, continent, subregion) => {
    expect(inferGeography(code)).toEqual({ continent, subregion });
  });

  it('ignores case and whitespace and returns undefined for unknown or missing codes', () => {
    expect(inferGeography(' gb ')).toEqual(inferGeography('GB'));
    expect(inferGeography('ZZ')).toBeUndefined();
    expect(inferGeography('')).toBeUndefined();
    expect(inferGeography(undefined)).toBeUndefined();
  });

  it('lists no code twice', () => {
    // Re-derive the table through the public function: a code listed in two sub-regions would be silently shadowed,
    // so check a few that are easy to confuse.
    expect(inferGeography('CY')?.subregion).toBe('Western Asia');
    expect(inferGeography('BM')?.subregion).toBe('Northern America');
    expect(inferGeography('GL')?.subregion).toBe('Northern America');
  });
});

describe('estimateSize', () => {
  it.each([
    [0, UniversitySize.VERY_SMALL],
    [999, UniversitySize.VERY_SMALL],
    [1000, UniversitySize.SMALL],
    [4999, UniversitySize.SMALL],
    [5000, UniversitySize.MEDIUM],
    [14999, UniversitySize.MEDIUM],
    [15000, UniversitySize.LARGE],
    [30000, UniversitySize.LARGE],
    [30001, UniversitySize.VERY_LARGE],
  ])('classifies %d students as %s', (count, size) => {
    expect(estimateSize(count)).toBe(size);
  });

  it('returns undefined for missing, negative and non-finite counts', () => {
    expect(estimateSize(undefined)).toBeUndefined();
    expect(estimateSize(-1)).toBeUndefined();
    expect(estimateSize(NaN)).toBeUndefined();
    expect(estimateSize(Infinity)).toBeUndefined();
  });
});

describe('buildBaseUniversities', () => {
  it('derives country, domain, geography and a unique id per row', () => {
    const rows = [
      { countryCode: 'GB', name: 'Same Name', url: 'https://www.same.ac.uk/' },
      { countryCode: 'GB', name: 'Same Name', url: 'https://www.same.ac.uk/other' },
      { countryCode: 'ZZ', name: 'Odd', url: 'not a url' },
    ];
    const [first, second, odd] = buildBaseUniversities(rows);
    expect(first).toMatchObject({
      id: 'gb-same-name-www-same-ac-uk',
      country: 'United Kingdom',
      domain: 'www.same.ac.uk',
      continent: Continent.EUROPE,
      subregion: 'Northern Europe',
    });
    expect(second.id).toBe('gb-same-name-www-same-ac-uk-2');
    expect(odd).toMatchObject({ domain: '', continent: undefined });
  });
});
