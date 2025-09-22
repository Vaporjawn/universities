import { University } from '../types/University';
/**
 * Load universities from a CSV file
 * @param filePath - Path to the CSV file
 * @returns Promise resolving to array of University objects
 */
export declare function loadUniversitiesFromCSV(filePath: string): Promise<University[]>;
/**
 * Save universities to a CSV file
 * @param universities - Array of University objects
 * @param filePath - Path to save the CSV file
 */
export declare function saveUniversitiesToCSV(universities: University[], filePath: string): Promise<void>;
/**
 * Filter universities based on criteria
 * @param universities - Array of universities to filter
 * @param criteria - Filter criteria
 * @returns Filtered array of universities
 */
export declare function filterUniversities(universities: University[], criteria: {
    country?: string;
    state?: string;
    type?: string;
    foundedYearRange?: {
        min?: number;
        max?: number;
    };
    studentCountRange?: {
        min?: number;
        max?: number;
    };
    hasLocation?: boolean;
}): University[];
/**
 * Search universities by name
 * @param universities - Array of universities to search
 * @param query - Search query
 * @returns Array of matching universities
 */
export declare function searchUniversities(universities: University[], query: string): University[];
/**
 * Validate and normalize university data
 * @param data - Partial university data
 * @returns Complete University object
 */
export declare function validateUniversityData(data: Partial<University>): University;
//# sourceMappingURL=dataProcessing.d.ts.map