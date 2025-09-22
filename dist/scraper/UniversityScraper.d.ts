import { University } from '../types/University';
/**
 * Configuration for web scraping operations
 */
export interface ScrapingConfig {
    concurrency: number;
    interval: number;
    timeout: number;
    retries: number;
    userAgent: string;
    respectRobots: boolean;
}
/**
 * Default scraping configuration - conservative to be respectful
 */
export declare const DEFAULT_SCRAPING_CONFIG: ScrapingConfig;
/**
 * University data scraper with rate limiting and error handling
 */
export declare class UniversityScraper {
    private queue;
    private config;
    constructor(config?: ScrapingConfig);
    /**
     * Extract university information from a website
     */
    scrapeUniversity(baseUniversity: Partial<University>): Promise<University>;
    /**
     * Fetch URL with retry logic
     */
    private fetchWithRetry;
    /**
     * Extract university data from HTML
     */
    private extractUniversityData;
    /**
     * Extract description from various sources
     */
    private extractDescription;
    /**
     * Extract contact information
     */
    private extractContactInfo;
    /**
     * Extract location information
     */
    private extractLocationInfo;
    /**
     * Extract founding year
     */
    private extractFoundingYear;
    /**
     * Classify university type based on content
     */
    private classifyUniversityType;
    /**
     * Extract academic programs
     */
    private extractPrograms;
    /**
     * Extract faculties/schools
     */
    private extractFaculties;
    /**
     * Extract social media links
     */
    private extractSocialMedia;
    /**
     * Extract university motto
     */
    private extractMotto;
    /**
     * Extract domain from URL
     */
    private extractDomain;
    /**
     * Classify degree level from program name
     */
    private classifyDegreeLevel;
    /**
     * Generate unique university ID
     */
    private generateUniversityId;
    /**
     * Assess data quality based on available information
     */
    private assessDataQuality;
    /**
     * Delay utility for rate limiting
     */
    private delay;
    /**
     * Get queue status
     */
    getQueueStatus(): {
        pending: number;
        size: number;
        isPaused: boolean;
    };
    /**
     * Pause scraping queue
     */
    pause(): void;
    /**
     * Resume scraping queue
     */
    resume(): void;
    /**
     * Clear scraping queue
     */
    clear(): void;
}
//# sourceMappingURL=UniversityScraper.d.ts.map