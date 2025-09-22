/**
 * Comprehensive University interface representing all available data about a university
 */
export interface University {
    id: string;
    name: string;
    country: string;
    countryCode: string;
    url: string;
    domain?: string;
    city?: string;
    state?: string;
    region?: string;
    address?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    description?: string;
    foundedYear?: number;
    type?: UniversityType;
    size?: UniversitySize;
    studentCount?: number;
    facultyCount?: number;
    programs?: Program[];
    faculties?: Faculty[];
    degrees?: DegreeLevel[];
    languages?: string[];
    contact?: {
        phone?: string;
        email?: string;
        fax?: string;
        socialMedia?: SocialMediaLinks;
    };
    rankings?: Ranking[];
    accreditation?: string[];
    motto?: string;
    logo?: string;
    colors?: string[];
    mascot?: string;
    lastUpdated: Date;
    dataQuality: DataQuality;
    sources: string[];
}
/**
 * University type classification
 */
export declare enum UniversityType {
    PUBLIC = "public",
    PRIVATE = "private",
    PRIVATE_NON_PROFIT = "private-non-profit",
    PRIVATE_FOR_PROFIT = "private-for-profit",
    RELIGIOUS = "religious",
    MILITARY = "military",
    TECHNICAL = "technical",
    COMMUNITY_COLLEGE = "community-college",
    LIBERAL_ARTS = "liberal-arts",
    RESEARCH = "research",
    TEACHING = "teaching",
    ONLINE = "online",
    SPECIALIZED = "specialized"
}
/**
 * University size classification
 */
export declare enum UniversitySize {
    VERY_SMALL = "very-small",// < 1,000 students
    SMALL = "small",// 1,000 - 5,000 students
    MEDIUM = "medium",// 5,000 - 15,000 students
    LARGE = "large",// 15,000 - 30,000 students
    VERY_LARGE = "very-large"
}
/**
 * Academic degree levels offered
 */
export declare enum DegreeLevel {
    CERTIFICATE = "certificate",
    ASSOCIATE = "associate",
    BACHELOR = "bachelor",
    MASTER = "master",
    DOCTORAL = "doctoral",
    PROFESSIONAL = "professional",
    POSTDOCTORAL = "postdoctoral"
}
/**
 * Academic program information
 */
export interface Program {
    name: string;
    department?: string;
    faculty?: string;
    degreeLevel: DegreeLevel;
    duration?: string;
    description?: string;
    url?: string;
}
/**
 * Faculty/School information
 */
export interface Faculty {
    name: string;
    description?: string;
    departments?: string[];
    dean?: string;
    url?: string;
}
/**
 * University ranking information
 */
export interface Ranking {
    source: string;
    rank: number;
    category?: string;
    year: number;
    url?: string;
}
/**
 * Social media links
 */
export interface SocialMediaLinks {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    website?: string;
}
/**
 * Data quality assessment
 */
export interface DataQuality {
    completeness: number;
    accuracy: number;
    freshness: number;
    reliability: number;
}
/**
 * Search and filter interfaces
 */
export interface UniversitySearchOptions {
    name?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    state?: string;
    type?: UniversityType | UniversityType[];
    size?: UniversitySize | UniversitySize[];
    degreeLevel?: DegreeLevel | DegreeLevel[];
    foundedAfter?: number;
    foundedBefore?: number;
    hasProgram?: string;
    minStudentCount?: number;
    maxStudentCount?: number;
    languages?: string[];
    accreditation?: string[];
    limit?: number;
    offset?: number;
    sortBy?: SortOption;
    sortOrder?: 'asc' | 'desc';
}
export declare enum SortOption {
    NAME = "name",
    COUNTRY = "country",
    FOUNDED_YEAR = "foundedYear",
    STUDENT_COUNT = "studentCount",
    DATA_QUALITY = "dataQuality"
}
/**
 * University statistics and aggregations
 */
export interface UniversityStats {
    totalCount: number;
    countByCountry: Record<string, number>;
    countByType: Record<UniversityType, number>;
    countBySize: Record<UniversitySize, number>;
    averageStudentCount: number;
    oldestUniversity?: University;
    newestUniversity?: University;
    largestUniversity?: University;
    smallestUniversity?: University;
}
/**
 * CLI command interfaces
 */
export interface CLISearchResult {
    universities: University[];
    total: number;
    page: number;
    totalPages: number;
    stats: UniversityStats;
}
export interface CLIOptions {
    search?: string;
    country?: string;
    type?: string;
    size?: string;
    limit?: number;
    page?: number;
    output?: 'json' | 'table' | 'csv';
    verbose?: boolean;
}
//# sourceMappingURL=University.d.ts.map