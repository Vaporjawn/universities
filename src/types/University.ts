/**
 * Comprehensive University interface representing all available data about a university
 */
export interface University {
  // Basic identification
  id: string;
  name: string;
  country: string;
  countryCode: string;
  url: string;
  domain?: string;

  // Location details
  city?: string;
  state?: string;
  region?: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  // Institution details
  description?: string;
  foundedYear?: number;
  type?: UniversityType;
  size?: UniversitySize;
  studentCount?: number;
  facultyCount?: number;

  // Academic information
  programs?: Program[];
  faculties?: Faculty[];
  degrees?: DegreeLevel[];
  languages?: string[];

  // Contact information
  contact?: {
    phone?: string;
    email?: string;
    fax?: string;
    socialMedia?: SocialMediaLinks;
  };

  // Rankings and reputation
  rankings?: Ranking[];
  accreditation?: string[];

  // Additional metadata
  motto?: string;
  logo?: string;
  colors?: string[];
  mascot?: string;

  // Data enrichment metadata
  lastUpdated: Date;
  dataQuality: DataQuality;
  sources: string[];
}

/**
 * University type classification
 */
export enum UniversityType {
  // eslint-disable-next-line no-unused-vars
  PUBLIC = 'public',
  // eslint-disable-next-line no-unused-vars
  PRIVATE = 'private',
  // eslint-disable-next-line no-unused-vars
  PRIVATE_NON_PROFIT = 'private_non_profit',
  // eslint-disable-next-line no-unused-vars
  PRIVATE_FOR_PROFIT = 'private_for_profit',
  // eslint-disable-next-line no-unused-vars
  RELIGIOUS = 'religious',
  // eslint-disable-next-line no-unused-vars
  MILITARY = 'military',
  // eslint-disable-next-line no-unused-vars
  TECHNICAL = 'technical',
  // eslint-disable-next-line no-unused-vars
  COMMUNITY_COLLEGE = 'community_college',
  // eslint-disable-next-line no-unused-vars
  LIBERAL_ARTS = 'liberal_arts',
  // eslint-disable-next-line no-unused-vars
  RESEARCH = 'research',
  // eslint-disable-next-line no-unused-vars
  TEACHING = 'teaching',
  // eslint-disable-next-line no-unused-vars
  ONLINE = 'online',
  // eslint-disable-next-line no-unused-vars
  SPECIALIZED = 'specialized',
}

/**
 * University size classification
 */
export enum UniversitySize {
  // eslint-disable-next-line no-unused-vars
  VERY_SMALL = 'very_small', // < 1,000 students
  // eslint-disable-next-line no-unused-vars
  SMALL = 'small', // 1,000 - 5,000
  // eslint-disable-next-line no-unused-vars
  MEDIUM = 'medium', // 5,000 - 15,000
  // eslint-disable-next-line no-unused-vars
  LARGE = 'large', // 15,000 - 30,000
  // eslint-disable-next-line no-unused-vars
  VERY_LARGE = 'very_large', // > 30,000
}

/**
 * Academic degree levels offered
 */
export enum DegreeLevel {
  // eslint-disable-next-line no-unused-vars
  CERTIFICATE = 'certificate',
  // eslint-disable-next-line no-unused-vars
  ASSOCIATE = 'associate',
  // eslint-disable-next-line no-unused-vars
  BACHELOR = 'bachelor',
  // eslint-disable-next-line no-unused-vars
  MASTER = 'master',
  // eslint-disable-next-line no-unused-vars
  DOCTORAL = 'doctoral',
  // eslint-disable-next-line no-unused-vars
  PROFESSIONAL = 'professional',
  // eslint-disable-next-line no-unused-vars
  POSTDOCTORAL = 'postdoctoral',
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
  completeness: number; // 0-1 scale
  accuracy: number; // 0-1 scale
  freshness: number; // 0-1 scale (how recent the data is)
  reliability: number; // 0-1 scale
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
  sortBy?: UniversitySortField;
  sortOrder?: 'asc' | 'desc';
}

export enum UniversitySortField {
  // eslint-disable-next-line no-unused-vars
  NAME = 'name',
  // eslint-disable-next-line no-unused-vars
  COUNTRY = 'country',
  // eslint-disable-next-line no-unused-vars
  FOUNDED_YEAR = 'foundedYear',
  // eslint-disable-next-line no-unused-vars
  STUDENT_COUNT = 'studentCount',
  // eslint-disable-next-line no-unused-vars
  DATA_QUALITY = 'dataQuality',
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
