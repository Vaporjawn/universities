// Core exports
export * from './types/University';
export { loadBaseUniversities, toPartialUniversity, countryNameFromCode } from './data/loadBase';
export {
  UniversityScraper,
  DEFAULT_SCRAPING_CONFIG,
  universityIdFor,
  ScrapingConfig,
  ScrapeResult,
  ScrapeStatus,
  ScraperCounters,
} from './scraper/UniversityScraper';
export {
  RobotsChecker,
  HostThrottle,
  parseRobots,
  selectRules,
  isPathAllowed,
  RobotsDecision,
  RobotsGroup,
  RobotsRules,
} from './scraper/robots';
export { inferGeography, estimateSize, Geography } from './data/regions';

// Enrichment pipeline, modules, feeds, store and provenance manifest
export * from './enrichment';
export { UniversityRepository } from './repository/UniversityRepository';

// Data processing utilities
export {
  loadUniversitiesFromCSV,
  saveUniversitiesToCSV,
  filterUniversities,
  searchUniversities,
  validateUniversityData,
} from './utils/dataProcessing';

// Error classes
export { ScrapingError, ValidationError, NetworkError } from './errors/ScrapingErrors';

// Constants and configurations
export { DEFAULT_SCRAPING_OPTIONS } from './config/constants';
