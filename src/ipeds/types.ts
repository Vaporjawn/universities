/**
 * One row of the NCES IPEDS "Institutional Characteristics: Directory information" file (HDYYYY.csv),
 * reduced to the columns the sync needs.
 */
export interface IpedsInstitution {
  /** IPEDS UNITID, the stable federal identifier. */
  unitId: string;
  /** INSTNM, the institution name. */
  name: string;
  /** STABBR, the USPS state or territory abbreviation. */
  stateCode: string;
  /** WEBADDR exactly as reported (may lack a scheme). */
  webAddress: string;
  /** CYACTIVE === '1': the institution is currently active. */
  isActive: boolean;
  /** DEGGRANT === '1': the institution grants associate's degrees or higher. */
  isDegreeGranting: boolean;
}

/** One data row of world-universities.csv. */
export interface UniversityCsvRow {
  countryCode: string;
  name: string;
  url: string;
}
