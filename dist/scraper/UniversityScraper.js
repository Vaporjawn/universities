"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversityScraper = exports.DEFAULT_SCRAPING_CONFIG = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const p_queue_1 = __importDefault(require("p-queue"));
const University_1 = require("../types/University");
/**
 * Default scraping configuration - conservative to be respectful
 */
exports.DEFAULT_SCRAPING_CONFIG = {
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
class UniversityScraper {
    constructor(config = exports.DEFAULT_SCRAPING_CONFIG) {
        this.config = config;
        this.queue = new p_queue_1.default({
            concurrency: config.concurrency,
            interval: config.interval,
            intervalCap: 1,
        });
    }
    /**
     * Extract university information from a website
     */
    scrapeUniversity(baseUniversity) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!baseUniversity.url) {
                throw new Error('University URL is required for scraping');
            }
            return new Promise(resolve => {
                this.queue.add(() => __awaiter(this, void 0, void 0, function* () {
                    let enrichedData = {};
                    try {
                        const response = yield this.fetchWithRetry(baseUniversity.url);
                        const $ = cheerio.load(response.data);
                        enrichedData = yield this.extractUniversityData($, baseUniversity);
                    }
                    catch (err) {
                        const msg = (err === null || err === void 0 ? void 0 : err.message) || String(err);
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
                    resolve(Object.assign(Object.assign(Object.assign({}, baseUniversity), enrichedData), { id: this.generateUniversityId(baseUniversity), lastUpdated: new Date(), dataQuality, sources: success && baseUniversity.url ? [baseUniversity.url] : [] }));
                }));
            });
        });
    }
    /**
     * Fetch URL with retry logic
     */
    fetchWithRetry(url, attempt = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(url, {
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
            }
            catch (error) {
                if (attempt < this.config.retries) {
                    yield this.delay(1000 * attempt); // Exponential backoff
                    return this.fetchWithRetry(url, attempt + 1);
                }
                throw error;
            }
        });
    }
    /**
     * Extract university data from HTML
     */
    extractUniversityData($, baseUniversity) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {};
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
        });
    }
    /**
     * Extract description from various sources
     */
    extractDescription($) {
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
    extractContactInfo($) {
        const contact = {};
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
    extractLocationInfo($) {
        const location = {};
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
    extractFoundingYear($) {
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
    classifyUniversityType($, name) {
        const content = $('body').text().toLowerCase();
        const nameLower = name.toLowerCase();
        // Classification rules
        if (nameLower.includes('community college') || content.includes('community college')) {
            return University_1.UniversityType.COMMUNITY_COLLEGE;
        }
        if (nameLower.includes('technical') || nameLower.includes('institute of technology')) {
            return University_1.UniversityType.TECHNICAL;
        }
        if (nameLower.includes('military') || nameLower.includes('naval') || nameLower.includes('air force')) {
            return University_1.UniversityType.MILITARY;
        }
        if (content.includes('liberal arts') || nameLower.includes('liberal arts')) {
            return University_1.UniversityType.LIBERAL_ARTS;
        }
        if (content.includes('research university') || content.includes('research institution')) {
            return University_1.UniversityType.RESEARCH;
        }
        // Default classification based on common patterns
        if (content.includes('private') && !content.includes('public')) {
            return University_1.UniversityType.PRIVATE;
        }
        if (content.includes('public') || content.includes('state university')) {
            return University_1.UniversityType.PUBLIC;
        }
        return undefined;
    }
    /**
     * Extract academic programs
     */
    extractPrograms($) {
        const programs = [];
        // Look for program listings
        $('.program, .course, .degree').each((_, el) => {
            const name = $(el).text().trim();
            if (name && name.length > 5 && name.length < 200) {
                // Determine degree level based on keywords
                let degreeLevel = University_1.DegreeLevel.BACHELOR; // Default
                const lowerName = name.toLowerCase();
                if (lowerName.includes('phd') || lowerName.includes('doctorate') || lowerName.includes('doctoral')) {
                    degreeLevel = University_1.DegreeLevel.DOCTORAL;
                }
                else if (lowerName.includes('master') ||
                    lowerName.includes('msc') ||
                    lowerName.includes('mba') ||
                    lowerName.includes('ma ')) {
                    degreeLevel = University_1.DegreeLevel.MASTER;
                }
                else if (lowerName.includes('certificate') || lowerName.includes('diploma')) {
                    degreeLevel = University_1.DegreeLevel.CERTIFICATE;
                }
                programs.push({ name, degreeLevel });
            }
        });
        return programs.length > 0 ? programs.slice(0, 50) : undefined; // Limit to 50 programs
    }
    /**
     * Extract faculties/schools
     */
    extractFaculties($) {
        const faculties = [];
        // Look for faculty/school listings
        $('.faculty, .school, .college').each((_, el) => {
            const name = $(el).text().trim();
            if (name &&
                name.length > 5 &&
                name.length < 200 &&
                (name.toLowerCase().includes('faculty') ||
                    name.toLowerCase().includes('school') ||
                    name.toLowerCase().includes('college'))) {
                faculties.push({ name });
            }
        });
        return faculties.length > 0 ? faculties.slice(0, 20) : undefined; // Limit to 20 faculties
    }
    /**
     * Extract social media links
     */
    extractSocialMedia($) {
        const socialMedia = {};
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
    extractMotto($) {
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
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        }
        catch (_a) {
            return url.replace(/^https?:\/\//, '').split('/')[0];
        }
    }
    /**
     * Classify degree level from program name
     */
    classifyDegreeLevel(programName) {
        const nameLower = programName.toLowerCase();
        if (nameLower.includes('phd') || nameLower.includes('doctorate') || nameLower.includes('doctoral')) {
            return University_1.DegreeLevel.DOCTORAL;
        }
        if (nameLower.includes('master') ||
            nameLower.includes('mba') ||
            nameLower.includes('msc') ||
            nameLower.includes('ma ')) {
            return University_1.DegreeLevel.MASTER;
        }
        if (nameLower.includes('bachelor') ||
            nameLower.includes('undergraduate') ||
            nameLower.includes('bsc') ||
            nameLower.includes('ba ')) {
            return University_1.DegreeLevel.BACHELOR;
        }
        if (nameLower.includes('associate')) {
            return University_1.DegreeLevel.ASSOCIATE;
        }
        if (nameLower.includes('certificate')) {
            return University_1.DegreeLevel.CERTIFICATE;
        }
        return undefined;
    }
    /**
     * Generate unique university ID
     */
    generateUniversityId(university) {
        const name = university.name || 'unknown';
        const country = university.countryCode || university.country || 'unknown';
        const domain = university.url ? this.extractDomain(university.url) : 'unknown';
        return `${country.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${domain.replace(/[^a-z0-9]/g, '-')}`;
    }
    /**
     * Assess data quality based on available information
     */
    assessDataQuality(data) {
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
        const completeness = fields.filter(field => data[field]).length / fields.length;
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
    delay(ms) {
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
exports.UniversityScraper = UniversityScraper;
//# sourceMappingURL=UniversityScraper.js.map