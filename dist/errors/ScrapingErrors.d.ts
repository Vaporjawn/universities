/**
 * Custom error classes for scraping operations
 */
export declare class ScrapingError extends Error {
    code: string;
    url?: string;
    constructor(message: string, code?: string, url?: string);
}
export declare class ValidationError extends Error {
    data?: Record<string, unknown>;
    constructor(message: string, data?: Record<string, unknown>);
}
export declare class NetworkError extends Error {
    url: string;
    statusCode?: number;
    constructor(message: string, url: string, statusCode?: number);
}
//# sourceMappingURL=ScrapingErrors.d.ts.map