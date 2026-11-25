import { Continent, UniversitySize } from '../types/University';

/** Geography inferred for one country. */
export interface Geography {
  continent: Continent;
  subregion: string;
}

/**
 * UN geoscheme sub-regions (M49) and the ISO 3166-1 alpha-2 codes in them. `AN` (Netherlands Antilles) and
 * `XK` (Kosovo) are not current ISO codes but appear in older datasets, so they are listed on purpose.
 */
const SUBREGIONS: ReadonlyArray<readonly [Continent, string, string]> = [
  [Continent.AFRICA, 'Northern Africa', 'DZ EG LY MA SD TN EH'],
  [Continent.AFRICA, 'Eastern Africa', 'BI DJ ER ET KE KM MG MW MU MZ RE RW SC SO SS TZ UG ZM ZW YT'],
  [Continent.AFRICA, 'Middle Africa', 'AO CM CF TD CG CD GQ GA ST'],
  [Continent.AFRICA, 'Southern Africa', 'BW LS NA ZA SZ'],
  [Continent.AFRICA, 'Western Africa', 'BJ BF CV CI GM GH GN GW LR ML MR NE NG SH SN SL TG'],
  [
    Continent.NORTH_AMERICA,
    'Caribbean',
    'AI AG AN AW BS BB BQ CU CW DM DO GD GP HT JM KY KN LC MF MQ MS PR SX TC TT VC VG VI',
  ],
  [Continent.NORTH_AMERICA, 'Central America', 'BZ CR SV GT HN MX NI PA'],
  [Continent.NORTH_AMERICA, 'Northern America', 'BM CA GL PM US'],
  [Continent.SOUTH_AMERICA, 'South America', 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE'],
  [Continent.ASIA, 'Central Asia', 'KZ KG TJ TM UZ'],
  [Continent.ASIA, 'Eastern Asia', 'CN HK MO JP KP KR MN TW'],
  [Continent.ASIA, 'South-eastern Asia', 'BN KH ID LA MY MM PH SG TH TL VN'],
  [Continent.ASIA, 'Southern Asia', 'AF BD BT IN IR LK MV NP PK'],
  [Continent.ASIA, 'Western Asia', 'AE AM AZ BH CY GE IL IQ JO KW LB OM PS QA SA SY TR YE'],
  [Continent.EUROPE, 'Eastern Europe', 'BG BY CZ HU MD PL RO RU SK UA'],
  [Continent.EUROPE, 'Northern Europe', 'AX DK EE FI FO GB GG IE IM IS JE LT LV NO SE SJ'],
  [Continent.EUROPE, 'Southern Europe', 'AD AL BA ES GI GR HR IT ME MK MT PT RS SI SM VA XK'],
  [Continent.EUROPE, 'Western Europe', 'AT BE CH DE FR LI LU MC NL'],
  [Continent.OCEANIA, 'Australia and New Zealand', 'AU NF NZ'],
  [Continent.OCEANIA, 'Melanesia', 'FJ NC PG SB VU'],
  [Continent.OCEANIA, 'Micronesia', 'FM GU KI MH MP NR PW'],
  [Continent.OCEANIA, 'Polynesia', 'AS CK NU PF PN TK TO TV WF WS'],
];

const GEOGRAPHY_BY_CODE: ReadonlyMap<string, Geography> = new Map(
  SUBREGIONS.flatMap(([continent, subregion, codes]) =>
    codes.split(' ').map(code => [code, { continent, subregion }] as const)
  )
);

/**
 * Infer the continent and UN sub-region of a country from its ISO alpha-2 code.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code, any case. Whitespace is ignored.
 * @returns The geography, or `undefined` when the code is not known.
 */
export const inferGeography = (countryCode: string | undefined): Geography | undefined =>
  countryCode ? GEOGRAPHY_BY_CODE.get(countryCode.trim().toUpperCase()) : undefined;

/**
 * Estimate the size class of a university from its student count, using the thresholds documented on
 * {@link UniversitySize}: under 1,000, 1,000-5,000, 5,000-15,000, 15,000-30,000 and over 30,000.
 *
 * @param studentCount - Total enrolment.
 * @returns The size class, or `undefined` for a missing, negative or non-finite count.
 */
export const estimateSize = (studentCount: number | undefined): UniversitySize | undefined => {
  if (studentCount === undefined || !Number.isFinite(studentCount) || studentCount < 0) return undefined;
  if (studentCount < 1000) return UniversitySize.VERY_SMALL;
  if (studentCount < 5000) return UniversitySize.SMALL;
  if (studentCount < 15000) return UniversitySize.MEDIUM;
  if (studentCount <= 30000) return UniversitySize.LARGE;
  return UniversitySize.VERY_LARGE;
};
