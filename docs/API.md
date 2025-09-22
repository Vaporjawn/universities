# Universities API Documentation

## Overview

The Universities package provides TypeScript/JavaScript utilities for scraping and processing university data from various sources. It includes robust error handling, rate limiting, and comprehensive data validation.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [UniversityScraper](#universityscraper)
  - [University Interface](#university-interface)
  - [Data Processing](#data-processing)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Installation

```bash
npm install universities
```

## Quick Start

```typescript
import { UniversityScraper } from 'universities';

// Initialize the scraper
const scraper = new UniversityScraper();

// Scrape university data
const universities = await scraper.scrapeUniversities(['https://example-university.edu']);

console.log(universities);
```

## API Reference

### UniversityScraper

The main class for scraping university data from web sources.

#### Constructor

```typescript
new UniversityScraper(options?: ScrapingOptions)
```

**Parameters:**

- `options` (optional): Configuration options for the scraper

**Options:**

```typescript
interface ScrapingOptions {
  concurrency?: number; // Number of concurrent requests (default: 3)
  retryAttempts?: number; // Number of retry attempts (default: 3)
  timeout?: number; // Request timeout in milliseconds (default: 10000)
  userAgent?: string; // Custom user agent string
}
```

#### Methods

##### `scrapeUniversities(urls: string[]): Promise<University[]>`

Scrapes university data from the provided URLs.

**Parameters:**

- `urls`: Array of university website URLs to scrape

**Returns:**

- Promise that resolves to an array of `University` objects

**Example:**

```typescript
const scraper = new UniversityScraper({
  concurrency: 5,
  timeout: 15000,
});

const universities = await scraper.scrapeUniversities([
  'https://harvard.edu',
  'https://mit.edu',
  'https://stanford.edu',
]);
```

##### `scrapeUniversity(url: string): Promise<University>`

Scrapes data from a single university website.

**Parameters:**

- `url`: University website URL

**Returns:**

- Promise that resolves to a `University` object

**Example:**

```typescript
const university = await scraper.scrapeUniversity('https://harvard.edu');
```

##### `validateUniversityData(data: Partial<University>): University`

Validates and normalizes university data.

**Parameters:**

- `data`: Partial university data object

**Returns:**

- Complete `University` object with validated data

**Throws:**

- `ValidationError` if required fields are missing or invalid

### University Interface

The core data structure representing a university.

```typescript
interface University {
  name: string; // University name (required)
  domain: string; // Primary domain (required)
  country: string; // Country name (required)
  stateProvince?: string; // State or province (optional)
  alphaTwoCode: string; // ISO 3166-1 alpha-2 country code (required)
  webPages: string[]; // Array of web page URLs (required)
  foundingYear?: number; // Year founded (optional)
  type?: UniversityType; // Type of institution (optional)
  studentCount?: number; // Number of students (optional)
  location?: {
    // Geographic location (optional)
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}
```

#### UniversityType Enum

```typescript
enum UniversityType {
  PUBLIC = 'public',
  PRIVATE = 'private',
  COMMUNITY = 'community',
  TECHNICAL = 'technical',
  RELIGIOUS = 'religious',
  MILITARY = 'military',
  ONLINE = 'online',
}
```

### Data Processing

#### CSV Operations

```typescript
import { loadUniversitiesFromCSV, saveUniversitiesToCSV } from 'universities';

// Load universities from CSV file
const universities = await loadUniversitiesFromCSV('world-universities.csv');

// Save universities to CSV file
await saveUniversitiesToCSV(universities, 'output.csv');
```

#### Filtering and Search

```typescript
import { filterUniversities, searchUniversities } from 'universities';

// Filter by country
const usUniversities = filterUniversities(universities, {
  country: 'United States',
});

// Filter by founding year range
const oldUniversities = filterUniversities(universities, {
  foundingYearRange: { min: 1600, max: 1800 },
});

// Search by name
const searchResults = searchUniversities(universities, 'Harvard');
```

## Examples

### Basic University Scraping

```typescript
import { UniversityScraper } from 'universities';

async function scrapeTopUniversities() {
  const scraper = new UniversityScraper({
    concurrency: 3,
    timeout: 10000,
  });

  const urls = ['https://harvard.edu', 'https://mit.edu', 'https://stanford.edu', 'https://caltech.edu'];

  try {
    const universities = await scraper.scrapeUniversities(urls);

    universities.forEach(university => {
      console.log(`${university.name} - ${university.country}`);
      console.log(`Founded: ${university.foundingYear || 'Unknown'}`);
      console.log(`Type: ${university.type || 'Unknown'}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Scraping failed:', error.message);
  }
}

scrapeTopUniversities();
```

### Data Processing and Export

```typescript
import { UniversityScraper, loadUniversitiesFromCSV, saveUniversitiesToCSV, filterUniversities } from 'universities';

async function processUniversityData() {
  // Load existing data
  const existingUniversities = await loadUniversitiesFromCSV('world-universities.csv');

  // Scrape additional universities
  const scraper = new UniversityScraper();
  const newUniversities = await scraper.scrapeUniversities([
    'https://new-university1.edu',
    'https://new-university2.edu',
  ]);

  // Combine datasets
  const allUniversities = [...existingUniversities, ...newUniversities];

  // Filter US universities founded after 1900
  const modernUSUniversities = filterUniversities(allUniversities, {
    country: 'United States',
    foundingYearRange: { min: 1900 },
  });

  // Export filtered data
  await saveUniversitiesToCSV(modernUSUniversities, 'modern-us-universities.csv');

  console.log(`Processed ${allUniversities.length} total universities`);
  console.log(`Found ${modernUSUniversities.length} modern US universities`);
}

processUniversityData();
```

### Advanced Configuration

```typescript
import { UniversityScraper } from 'universities';

async function advancedScraping() {
  const scraper = new UniversityScraper({
    concurrency: 5, // Higher concurrency for faster scraping
    retryAttempts: 5, // More retries for reliability
    timeout: 20000, // Longer timeout for slow sites
    userAgent: 'UniversityBot/1.0 (+https://example.com/bot)',
  });

  // Handle progress updates
  scraper.on('progress', (completed, total) => {
    console.log(`Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
  });

  // Handle individual results
  scraper.on('university', university => {
    console.log(`Scraped: ${university.name}`);
  });

  // Handle errors
  scraper.on('error', (error, url) => {
    console.error(`Failed to scrape ${url}:`, error.message);
  });

  const urls = [
    // ... large list of university URLs
  ];

  const universities = await scraper.scrapeUniversities(urls);
  return universities;
}
```

## Error Handling

The Universities package includes comprehensive error handling:

### Error Types

```typescript
import { ScrapingError, ValidationError, NetworkError } from 'universities';

try {
  const universities = await scraper.scrapeUniversities(urls);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
    console.error('Failed URL:', error.url);
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
    console.error('Invalid data:', error.data);
  } else if (error instanceof ScrapingError) {
    console.error('Scraping error:', error.message);
    console.error('Error code:', error.code);
  }
}
```

### Retry Logic

The scraper automatically retries failed requests with exponential backoff:

```typescript
const scraper = new UniversityScraper({
  retryAttempts: 3, // Retry up to 3 times
  retryDelay: 1000, // Start with 1 second delay
  retryMultiplier: 2, // Double delay each retry
});
```

## Best Practices

### 1. Rate Limiting

Always use appropriate concurrency settings to avoid overwhelming target servers:

```typescript
const scraper = new UniversityScraper({
  concurrency: 3, // Conservative concurrency
  timeout: 10000, // Reasonable timeout
});
```

### 2. Error Handling

Implement comprehensive error handling for production applications:

```typescript
async function safeScraping(urls: string[]) {
  const scraper = new UniversityScraper();
  const results: University[] = [];
  const errors: Array<{ url: string; error: Error }> = [];

  for (const url of urls) {
    try {
      const university = await scraper.scrapeUniversity(url);
      results.push(university);
    } catch (error) {
      errors.push({ url, error });
    }
  }

  return { results, errors };
}
```

### 3. Data Validation

Always validate scraped data before using it:

```typescript
const universities = await scraper.scrapeUniversities(urls);

const validUniversities = universities.filter(uni => {
  return uni.name && uni.domain && uni.country && uni.alphaTwoCode;
});
```

### 4. Caching

Implement caching for repeated requests:

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

async function cachedScraping(url: string) {
  const cached = cache.get(url);
  if (cached) {
    return cached;
  }

  const university = await scraper.scrapeUniversity(url);
  cache.set(url, university);
  return university;
}
```

### 5. Monitoring

Monitor scraping performance and errors:

```typescript
const scraper = new UniversityScraper();

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;

scraper.on('university', () => successfulRequests++);
scraper.on('error', () => failedRequests++);
scraper.on('request', () => totalRequests++);

// Log statistics periodically
setInterval(() => {
  console.log(`Stats: ${successfulRequests}/${totalRequests} successful, ${failedRequests} failed`);
}, 30000);
```

## Support

For issues, feature requests, or questions:

- GitHub Issues: [https://github.com/username/universities/issues](https://github.com/username/universities/issues)
- Documentation: [https://github.com/username/universities/docs](https://github.com/username/universities/docs)
- Examples: [https://github.com/username/universities/examples](https://github.com/username/universities/examples)

## License

MIT License - see LICENSE file for details.
