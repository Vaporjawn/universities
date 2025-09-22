"use strict";
/**
 * Custom error classes for scraping operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkError = exports.ValidationError = exports.ScrapingError = void 0;
class ScrapingError extends Error {
    constructor(message, code = 'SCRAPING_ERROR', url) {
        super(message);
        this.name = 'ScrapingError';
        this.code = code;
        this.url = url;
    }
}
exports.ScrapingError = ScrapingError;
class ValidationError extends Error {
    constructor(message, data) {
        super(message);
        this.name = 'ValidationError';
        this.data = data;
    }
}
exports.ValidationError = ValidationError;
class NetworkError extends Error {
    constructor(message, url, statusCode) {
        super(message);
        this.name = 'NetworkError';
        this.url = url;
        this.statusCode = statusCode;
    }
}
exports.NetworkError = NetworkError;
//# sourceMappingURL=ScrapingErrors.js.map