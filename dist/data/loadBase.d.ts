import { University } from '../types/University';
export interface BaseUniversityRecord {
    countryCode: string;
    name: string;
    url: string;
}
export declare function loadBaseUniversities(csvPath: string): Promise<BaseUniversityRecord[]>;
export declare function toPartialUniversity(record: BaseUniversityRecord): Partial<University>;
export declare function countryNameFromCode(code: string): string;
//# sourceMappingURL=loadBase.d.ts.map