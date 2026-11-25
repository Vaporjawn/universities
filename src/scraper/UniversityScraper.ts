import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { University, UniversityType, DegreeLevel, DataQuality } from '../types/University';
import { HostThrottle, RobotsChecker } from './robots';

/**
 * Configuration for web scraping operations
 */
export interface ScrapingConfig {
  concurrency: number;
  interval: number; // milliseconds between requests
  timeout: number; // request timeout in milliseconds
  retries: number;
  userAgent: string;
  /** Read robots.txt before fetching a page and skip pages it disallows. Default `true`. */
  respectRobots: boolean;
  /** Minimum milliseconds between requests to the same host. A larger robots.txt `Crawl-delay` wins. Default 1000. */
  hostInterval?: number;
  /** A robots.txt `Crawl-delay` above this many milliseconds makes the scraper skip the site. Default 30000. */
  maxCrawlDelay?: number;
  /** How long a fetched robots.txt is reused, in milliseconds. Default one hour. */
  robotsTtl?: number;
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
  hostInterval: 1000,
  maxCrawlDelay: 30000,
  robotsTtl: 60 * 60 * 1000,
};

/** How one scrape ended. */
export type ScrapeStatus = 'enriched' | 'failed' | 'blocked-by-robots';

/** A scraped university together with how the scrape went. */
export interface ScrapeResult {
  university: University;
  status: ScrapeStatus;
  /** Why the scrape did not enrich the record. Not set when `status` is `enriched`. */
  reason?: string;
}

/** Running totals for one scraper instance. */
export interface ScraperCounters {
  enriched: number;
  failed: number;
  blockedByRobots: number;
  /** HTTP requests sent for pages, including retries. */
  pageRequests: number;
  retries: number;
}

/**
 * Build the id used for cache files and enriched records: `<country>-<name>-<domain>`, lower-case, with every
 * character outside a-z and 0-9 replaced by a hyphen. It does not guarantee uniqueness; the enrichment pipeline
 * adds the CSV row number when two rows collide.
 */
export const universityIdFor = (university: Partial<University>): string => {
  const name = university.name || 'unknown';
  const country = university.countryCode || university.country || 'unknown';
  let domain = 'unknown';
  if (university.url) {
    try {
      domain = new URL(university.url).hostname;
    } catch {
      [domain] = university.url.replace(/^https?:\/\//, '').split('/');
    }
  }
  return `${country.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${domain.replace(/[^a-z0-9]/g, '-')}`;
};

/**
 * University data scraper with rate limiting and error handling
 */
export class UniversityScraper {
  private queue: PQueue;
  private config: ScrapingConfig;
  private readonly robots?: RobotsChecker;
  private readonly throttle = new HostThrottle();
  private readonly counters: ScraperCounters = {
    enriched: 0,
    failed: 0,
    blockedByRobots: 0,
    pageRequests: 0,
    retries: 0,
  };

  constructor(config: Partial<ScrapingConfig> = DEFAULT_SCRAPING_CONFIG) {
    this.config = { ...DEFAULT_SCRAPING_CONFIG, ...config };
    this.queue = new PQueue({
      concurrency: this.config.concurrency,
      interval: this.config.interval,
      intervalCap: 1,
    });
    if (this.config.respectRobots) {
      this.robots = new RobotsChecker({
        userAgent: this.config.userAgent,
        ttlMs: this.config.robotsTtl,
        maxCrawlDelayMs: this.config.maxCrawlDelay,
        fetchText: url => this.fetchRobotsText(url),
      });
    }
  }

  /** The effective configuration, with defaults filled in. */
  get settings(): Readonly<ScrapingConfig> {
    return this.config;
  }

  /** Running totals since this scraper was created. */
  get stats(): Readonly<ScraperCounters> {
    return { ...this.counters };
  }

  /** Maximum number of requests the scraper runs at once. */
  get concurrency(): number {
    return this.config.concurrency;
  }

  /**
   * Extract university information from a website. Failures and robots.txt refusals do not throw: the base
   * record is returned with a low data-quality score. Use {@link scrapeUniversityDetailed} to learn which happened.
   */
  async scrapeUniversity(baseUniversity: Partial<University>): Promise<University> {
    return (await this.scrapeUniversityDetailed(baseUniversity)).university;
  }

  /**
   * Like {@link scrapeUniversity}, but also reports whether the page was enriched, failed, or was skipped because
   * robots.txt disallows it.
   */
  async scrapeUniversityDetailed(baseUniversity: Partial<University>): Promise<ScrapeResult> {
    if (!baseUniversity.url) {
      throw new Error('University URL is required for scraping');
    }
    return new Promise<ScrapeResult>(resolve => {
      this.queue.add(async () => {
        let enrichedData: Partial<University> = {};
        let status: ScrapeStatus = 'enriched';
        let reason: string | undefined;
        try {
          const decision = this.robots ? await this.robots.check(baseUniversity.url!) : { allowed: true };
          if (!decision.allowed) {
            status = 'blocked-by-robots';
            ({ reason } = decision);
            this.counters.blockedByRobots++;
            console.warn(`Skipped ${baseUniversity.url}: ${reason}`);
          } else {
            const response = await this.fetchWithRetry(baseUniversity.url!, decision.crawlDelayMs);
            const $ = cheerio.load(response.data);
            enrichedData = await this.extractUniversityData($, baseUniversity);
          }
        } catch (err) {
          const msg = (err as Error)?.message || String(err);
          status = 'failed';
          reason = msg;
          this.counters.failed++;
          console.warn(`Failed to scrape ${baseUniversity.url}: ${msg}`);
        }

        const success = Object.keys(enrichedData).length > 0;
        if (status === 'enriched') this.counters.enriched++;
        const dataQuality = success
          ? this.assessDataQuality(enrichedData)
          : {
              completeness: 0.2,
              accuracy: 0.5,
              freshness: 1.0,
              reliability: 0.3,
            };

        resolve({
          university: {
            ...baseUniversity,
            ...enrichedData,
            id: this.generateUniversityId(baseUniversity),
            lastUpdated: new Date(),
            dataQuality,
            sources: success && baseUniversity.url ? [baseUniversity.url] : [],
          } as University,
          status,
          reason,
        });
      });
    });
  }

  /** Fetch `<origin>/robots.txt` for the robots checker. Any HTTP status is returned, not thrown. */
  private async fetchRobotsText(url: string): Promise<{ status: number; body: string }> {
    const response = await axios.get(url, {
      timeout: this.config.timeout,
      headers: { 'User-Agent': this.config.userAgent, Accept: 'text/plain,*/*;q=0.5' },
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: () => true,
    });
    return { status: response.status, body: typeof response.data === 'string' ? response.data : '' };
  }

  /**
   * Fetch URL with retry logic
   */
  private async fetchWithRetry(url: string, crawlDelayMs = 0, attempt = 1): Promise<AxiosResponse> {
    try {
      await this.throttle.wait(this.extractDomain(url), Math.max(this.config.hostInterval ?? 0, crawlDelayMs));
      this.counters.pageRequests++;
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
        this.counters.retries++;
        await this.delay(1000 * attempt); // Linear backoff
        return this.fetchWithRetry(url, crawlDelayMs, attempt + 1);
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

    // Extract enrolment, used to estimate the size class
    data.studentCount = this.extractStudentCount($);

    // Extract university type
    data.type = this.classifyUniversityType($, baseUniversity.name || '');

    // Extract programs/faculties
    data.programs = this.extractPrograms($);
    data.faculties = this.extractFaculties($);

    // Extract social media links (kept even when the page has no phone or email)
    const socialMedia = this.extractSocialMedia($);
    if (socialMedia) {
      data.contact = { ...data.contact, socialMedia };
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
      // A tel: link is often labelled "Call us", so look at the href as well as the visible text.
      for (const text of [$(el).text(), $(el).attr('href') || '']) {
        for (const pattern of phonePatterns) {
          const matches = text.match(pattern);
          if (matches && matches[0].replace(/\D/g, '').length >= 10) {
            contact.phone = matches[0].trim();
            return false; // Break out of each loop
          }
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
   * Extract enrolment from phrases such as "45,000 students" or "enrolment of 12,500". Counts below 100 or above
   * 1,000,000 are ignored as page noise ("3 students per lab").
   */
  private extractStudentCount($: cheerio.CheerioAPI): number | undefined {
    const text = $('body').text();
    const patterns = [
      /([\d]{1,3}(?:[,.\s]\d{3})+|\d{3,7})\s+(?:enrolled\s+)?(?:students|undergraduates)/i,
      /(?:enrol(?:l)?ment|student\s+body)(?:\s+(?:of|is|was))?\s*:?\s*([\d]{1,3}(?:[,.\s]\d{3})+|\d{3,7})/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1].replace(/[,.\s]/g, ''), 10);
        if (count >= 100 && count <= 1_000_000) return count;
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
  generateUniversityId(university: Partial<University>): string {
    return universityIdFor(university);
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
