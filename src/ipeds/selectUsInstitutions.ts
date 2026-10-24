import { US_STATE_AND_DC_CODES } from './constants';
import { IpedsInstitution } from './types';

/**
 * Keep the institutions that belong in the US block of world-universities.csv:
 * currently active, degree-granting, located in one of the 50 states or DC.
 *
 * Non-degree-granting schools (cosmetology, truck driving, ...), closed institutions and US
 * territories are intentionally excluded.
 */
export function selectUsInstitutions(institutions: readonly IpedsInstitution[]): IpedsInstitution[] {
  const states = new Set(US_STATE_AND_DC_CODES);
  return institutions.filter(i => i.isActive && i.isDegreeGranting && states.has(i.stateCode));
}
