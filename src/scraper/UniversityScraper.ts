import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { University, UniversityType, DegreeLevel, DataQuality } from '../types/University';

/**
 * Configuration for web scraping operations
 */
export interface ScrapingConfig {
  concurrency: number;
  interval: number; // milliseconds between requests
  timeout: number; // request timeout in milliseconds
  retries: number;
  userAgent: string;
  respectRobots: boolean;
}

/**
 * Default scraping configuration - conservative to be respectful
 */
export const DEFAULT_SCRAPING_CONFIG: ScrapingConfig = {
  concurrency: 5, // Max 5 concurrent requests
  interval: 1000, // 1 second between requests
  timeout: 10000, // 10 second timeout
  retries: 3,
  userAgent: 'WorldUniversitiesBot/1.0 (Educational Research)',
  respectRobots: true,
};

/**
 * University data scraper with rate limiting and error handling
 */
export class UniversityScraper {
  private queue: PQueue;
  private config: ScrapingConfig;

  constructor(config: ScrapingConfig = DEFAULT_SCRAPING_CONFIG) {
    this.config = config;
    this.queue = new PQueue({
      concurrency: config.concurrency,
      interval: config.interval,
      intervalCap: 1,
    });
  }

  /**
   * Extract university information from a website
   */
  async scrapeUniversity(baseUniversity: Partial<University>): Promise<University> {
    if (!baseUniversity.url) {
      throw new Error('University URL is required for scraping');
    }
    return new Promise<University>(resolve => {
      this.queue.add(async () => {
        let enrichedData: Partial<University> = {};
        try {
          const response = await this.fetchWithRetry(baseUniversity.url!);
          const $ = cheerio.load(response.data);
          enrichedData = await this.extractUniversityData($, baseUniversity);
        } catch (err) {
          const msg = (err as Error)?.message || String(err);
          console.warn(`Failed to scrape ${baseUniversity.url}: ${msg}`);
        }

        const success = Object.keys(enrichedData).length > 0;
        const dataQuality = success
          ? this.assessDataQuality(enrichedData)
          : {
              completeness: 0.2,
              accuracy: 0.5,
              freshness: 1.0,
              reliability: 0.3,
            };

        resolve({
          ...baseUniversity,
          ...enrichedData,
          id: this.generateUniversityId(baseUniversity),
          lastUpdated: new Date(),
          dataQuality,
          sources: success && baseUniversity.url ? [baseUniversity.url] : [],
        } as University);
      });
    });
  }

  /**
   * Fetch URL with retry logic
   */
  private async fetchWithRetry(url: string, attempt = 1): Promise<AxiosResponse> {
    try {
      const response = await axios.get(url, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
        },
        maxRedirects: 5,
      });

      return response;
    } catch (error) {
      if (attempt < this.config.retries) {
        await this.delay(1000 * attempt); // Exponential backoff
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Extract university data from HTML
   */
  private async extractUniversityData(
    $: cheerio.CheerioAPI,
    baseUniversity: Partial<University>
  ): Promise<Partial<University>> {
    const data: Partial<University> = {};

    // Extract description from meta tags or about sections
    data.description = this.extractDescription($);

    // Extract contact information
    data.contact = this.extractContactInfo($);

    // Extract location information
    const locationInfo = this.extractLocationInfo($);
    data.city = locationInfo.city;
    data.state = locationInfo.state;
    data.address = locationInfo.address;

    // Extract founding year
    data.foundedYear = this.extractFoundingYear($);

    // Extract university type
    data.type = this.classifyUniversityType($, baseUniversity.name || '');

    // Extract programs/faculties
    data.programs = this.extractPrograms($);
    data.faculties = this.extractFaculties($);

    // Extract social media links
    if (data.contact) {
      data.contact.socialMedia = this.extractSocialMedia($);
    }

    // Extract motto
    data.motto = this.extractMotto($);

    // Extract domain from URL
    if (baseUniversity.url) {
      data.domain = this.extractDomain(baseUniversity.url);
    }

    return data;
  }

  /**
   * Extract description from various sources
   */
  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    // Try meta description first
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.length > 50) {
      return metaDesc.trim();
    }

    // Try Open Graph description
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.length > 50) {
      return ogDesc.trim();
    }

    // Look for about section
    const aboutSelectors = [
      '.about p:first-of-type',
      '#about p:first-of-type',
      '.description p:first-of-type',
      '.intro p:first-of-type',
      '.overview p:first-of-type',
      'main p:first-of-type',
    ];

    for (const selector of aboutSelectors) {
      const text = $(selector).text().trim();
      if (text && text.length > 100 && text.length < 1000) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * Extract contact information
   */
  private extractContactInfo($: cheerio.CheerioAPI) {
    const contact: Record<string, string> = {};

    // Extract phone numbers
    const phonePatterns = [/\+?[\d\s\-()]{10,}/g, /tel:[+\d\-()s]+/gi];

    $('a[href^="tel:"], .phone, .contact-phone').each((_, el) => {
      const text = $(el).text() || $(el).attr('href') || '';
      for (const pattern of phonePatterns) {
        const matches = text.match(pattern);
        if (matches && matches[0].replace(/\D/g, '').length >= 10) {
          contact.phone = matches[0].trim();
          return false; // Break out of each loop
        }
      }
    });

    // Extract email
    $('a[href^="mailto:"], .email, .contact-email').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();

      if (href && href.startsWith('mailto:')) {
        contact.email = href.replace('mailto:', '').trim();
        return false;
      }

      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        const [email] = emailMatch;
        contact.email = email;
        return false;
      }
    });

    return Object.keys(contact).length > 0 ? contact : undefined;
  }

  /**
   * Extract location information
   */
  private extractLocationInfo($: cheerio.CheerioAPI) {
    const location: Record<string, string> = {};

    // Look for address in various places
    const addressSelectors = [
      '.address',
      '.location',
      '.contact-address',
      '[itemtype="http://schema.org/PostalAddress"]',
      '.footer address',
    ];

    for (const selector of addressSelectors) {
      const addressText = $(selector).text().trim();
      if (addressText && addressText.length > 10) {
        location.address = addressText;

        // Try to extract city and state from address
        const cityStateMatch = addressText.match(/([A-Za-z\s]+),\s*([A-Z]{2}|\w+)/);
        if (cityStateMatch) {
          location.city = cityStateMatch[1].trim();
          location.state = cityStateMatch[2].trim();
        }
        break;
      }
    }

    return location;
  }

  /**
   * Extract founding year
   */
  private extractFoundingYear($: cheerio.CheerioAPI): number | undefined {
    const yearPatterns = [
      /founded.{0,20}(\d{4})/i,
      /established.{0,20}(\d{4})/i,
      /since.{0,20}(\d{4})/i,
      /(\d{4}).{0,20}founded/i,
      /(\d{4}).{0,20}established/i,
    ];

    const text = $('body').text();

    for (const pattern of yearPatterns) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        if (year >= 1000 && year <= new Date().getFullYear()) {
          return year;
        }
      }
    }

    return undefined;
  }

  /**
   * Classify university type based on content
   */
  private classifyUniversityType($: cheerio.CheerioAPI, name: string): UniversityType | undefined {
    const content = $('body').text().toLowerCase();
    const nameLower = name.toLowerCase();

    // Classification rules
    if (nameLower.includes('community college') || content.includes('community college')) {
      return UniversityType.COMMUNITY_COLLEGE;
    }

    if (nameLower.includes('technical') || nameLower.includes('institute of technology')) {
      return UniversityType.TECHNICAL;
    }

    if (nameLower.includes('military') || nameLower.includes('naval') || nameLower.includes('air force')) {
      return UniversityType.MILITARY;
    }

    if (content.includes('liberal arts') || nameLower.includes('liberal arts')) {
      return UniversityType.LIBERAL_ARTS;
    }

    if (content.includes('research university') || content.includes('research institution')) {
      return UniversityType.RESEARCH;
    }

    // Default classification based on common patterns
    if (content.includes('private') && !content.includes('public')) {
      return UniversityType.PRIVATE;
    }

    if (content.includes('public') || content.includes('state university')) {
      return UniversityType.PUBLIC;
    }

    return undefined;
  }

  /**
   * Extract academic programs
   */
  private extractPrograms($: cheerio.CheerioAPI) {
    const programs: { name: string; degreeLevel: DegreeLevel }[] = [];

    // Look for program listings
    $('.program, .course, .degree').each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 5 && name.length < 200) {
        // Determine degree level based on keywords
        let degreeLevel: DegreeLevel = DegreeLevel.BACHELOR; // Default

        const lowerName = name.toLowerCase();
        if (lowerName.includes('phd') || lowerName.includes('doctorate') || lowerName.includes('doctoral')) {
          degreeLevel = DegreeLevel.DOCTORAL;
        } else if (
          lowerName.includes('master') ||
          lowerName.includes('msc') ||
          lowerName.includes('mba') ||
          lowerName.includes('ma ')
        ) {
          degreeLevel = DegreeLevel.MASTER;
        } else if (lowerName.includes('certificate') || lowerName.includes('diploma')) {
          degreeLevel = DegreeLevel.CERTIFICATE;
        }

        programs.push({ name, degreeLevel });
      }
    });

    return programs.length > 0 ? programs.slice(0, 50) : undefined; // Limit to 50 programs
  }

  /**
   * Extract faculties/schools
   */
  private extractFaculties($: cheerio.CheerioAPI) {
    const faculties: { name: string }[] = [];

    // Look for faculty/school listings
    $('.faculty, .school, .college').each((_, el) => {
      const name = $(el).text().trim();
      if (
        name &&
        name.length > 5 &&
        name.length < 200 &&
        (name.toLowerCase().includes('faculty') ||
          name.toLowerCase().includes('school') ||
          name.toLowerCase().includes('college'))
      ) {
        faculties.push({ name });
      }
    });

    return faculties.length > 0 ? faculties.slice(0, 20) : undefined; // Limit to 20 faculties
  }

  /**
   * Extract social media links
   */
  private extractSocialMedia($: cheerio.CheerioAPI) {
    const socialMedia: Record<string, string> = {};

    // Facebook
    $('a[href*="facebook.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('facebook.com/')) {
        socialMedia.facebook = href;
        return false;
      }
    });

    // Twitter
    $('a[href*="twitter.com"], a[href*="x.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('twitter.com/') || href.includes('x.com/'))) {
        socialMedia.twitter = href;
        return false;
      }
    });

    // Instagram
    $('a[href*="instagram.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('instagram.com/')) {
        socialMedia.instagram = href;
        return false;
      }
    });

    // LinkedIn
    $('a[href*="linkedin.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('linkedin.com/')) {
        socialMedia.linkedin = href;
        return false;
      }
    });

    // YouTube
    $('a[href*="youtube.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('youtube.com/')) {
        socialMedia.youtube = href;
        return false;
      }
    });

    return Object.keys(socialMedia).length > 0 ? socialMedia : undefined;
  }

  /**
   * Extract university motto
   */
  private extractMotto($: cheerio.CheerioAPI): string | undefined {
    const mottoSelectors = ['.motto', '.tagline', '.slogan', '[class*="motto"]'];

    for (const selector of mottoSelectors) {
      const motto = $(selector).text().trim();
      if (motto && motto.length > 5 && motto.length < 200) {
        return motto;
      }
    }

    return undefined;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0];
    }
  }

  /**
   * Classify degree level from program name
   */
  private classifyDegreeLevel(programName: string): DegreeLevel | undefined {
    const nameLower = programName.toLowerCase();

    if (nameLower.includes('phd') || nameLower.includes('doctorate') || nameLower.includes('doctoral')) {
      return DegreeLevel.DOCTORAL;
    }
    if (
      nameLower.includes('master') ||
      nameLower.includes('mba') ||
      nameLower.includes('msc') ||
      nameLower.includes('ma ')
    ) {
      return DegreeLevel.MASTER;
    }
    if (
      nameLower.includes('bachelor') ||
      nameLower.includes('undergraduate') ||
      nameLower.includes('bsc') ||
      nameLower.includes('ba ')
    ) {
      return DegreeLevel.BACHELOR;
    }
    if (nameLower.includes('associate')) {
      return DegreeLevel.ASSOCIATE;
    }
    if (nameLower.includes('certificate')) {
      return DegreeLevel.CERTIFICATE;
    }

    return undefined;
  }

  /**
   * Generate unique university ID
   */
  private generateUniversityId(university: Partial<University>): string {
    const name = university.name || 'unknown';
    const country = university.countryCode || university.country || 'unknown';
    const domain = university.url ? this.extractDomain(university.url) : 'unknown';

    return `${country.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${domain.replace(
      /[^a-z0-9]/g,
      '-'
    )}`;
  }

  /**
   * Assess data quality based on available information
   */
  private assessDataQuality(data: Partial<University>): DataQuality {
    const fields = [
      'description',
      'foundedYear',
      'type',
      'contact',
      'city',
      'programs',
      'faculties',
      'motto',
      'domain',
    ];

    const completeness = fields.filter(field => data[field as keyof University]).length / fields.length;

    return {
      completeness,
      accuracy: 0.8, // Assume good accuracy from source websites
      freshness: 1.0, // Data is fresh since we just scraped it
      reliability: completeness * 0.9, // Reliability correlates with completeness
    };
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      pending: this.queue.pending,
      size: this.queue.size,
      isPaused: this.queue.isPaused,
    };
  }

  /**
   * Pause scraping queue
   */
  pause() {
    this.queue.pause();
  }

  /**
   * Resume scraping queue
   */
  resume() {
    this.queue.start();
  }

  /**
   * Clear scraping queue
   */
  clear() {
    this.queue.clear();
  }
}
