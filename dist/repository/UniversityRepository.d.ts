import { University, UniversitySearchOptions, UniversityStats } from '../types/University';
export declare class UniversityRepository {
    private universities;
    constructor(universities?: University[]);
    setData(universities: University[]): void;
    getAll(): University[];
    search(options?: UniversitySearchOptions): University[];
    stats(): UniversityStats;
}
//# sourceMappingURL=UniversityRepository.d.ts.map