/**
 * Custom error classes for scraping operations
 */

export class ScrapingError extends Error {
  public code: string;
  public url?: string;

  constructor(message: string, code: string = 'SCRAPING_ERROR', url?: string) {
    super(message);
    this.name = 'ScrapingError';
    this.code = code;
    this.url = url;
  }
}

export class ValidationError extends Error {
  public data?: Record<string, unknown>;

  constructor(message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ValidationError';
    this.data = data;
  }
}

export class NetworkError extends Error {
  public url: string;
  public statusCode?: number;

  constructor(message: string, url: string, statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
  }
}
