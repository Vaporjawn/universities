import { NetworkError, ScrapingError, ValidationError } from '../errors/ScrapingErrors';
import * as publicApi from '../index';

describe('ScrapingError', () => {
  it('carries a message, a default code and an optional url', () => {
    const error = new ScrapingError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ScrapingError);
    expect(error.name).toBe('ScrapingError');
    expect(error.message).toBe('boom');
    expect(error.code).toBe('SCRAPING_ERROR');
    expect(error.url).toBeUndefined();
  });

  it('accepts a custom code and url', () => {
    const error = new ScrapingError('blocked', 'ROBOTS_DISALLOWED', 'http://a.edu/');
    expect(error.code).toBe('ROBOTS_DISALLOWED');
    expect(error.url).toBe('http://a.edu/');
  });
});

describe('ValidationError', () => {
  it('carries the offending data', () => {
    const error = new ValidationError('bad record', { name: '' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('bad record');
    expect(error.data).toEqual({ name: '' });
  });

  it('data is optional', () => {
    expect(new ValidationError('bad').data).toBeUndefined();
  });
});

describe('NetworkError', () => {
  it('carries the url and optional status code', () => {
    const error = new NetworkError('not found', 'http://a.edu/missing', 404);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NetworkError');
    expect(error.url).toBe('http://a.edu/missing');
    expect(error.statusCode).toBe(404);
    expect(new NetworkError('timeout', 'http://a.edu/').statusCode).toBeUndefined();
  });
});

describe('public API', () => {
  it('re-exports the error classes', () => {
    expect(publicApi.ScrapingError).toBe(ScrapingError);
    expect(publicApi.ValidationError).toBe(ValidationError);
    expect(publicApi.NetworkError).toBe(NetworkError);
  });

  it('exports the documented entry points', () => {
    [
      'loadBaseUniversities',
      'toPartialUniversity',
      'countryNameFromCode',
      'UniversityScraper',
      'UniversityRepository',
      'loadUniversitiesFromCSV',
      'saveUniversitiesToCSV',
      'filterUniversities',
      'searchUniversities',
      'validateUniversityData',
      'DEFAULT_SCRAPING_OPTIONS',
      'DEFAULT_SCRAPING_CONFIG',
    ].forEach(name => expect(publicApi).toHaveProperty(name));
  });
});
