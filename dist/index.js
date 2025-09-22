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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SCRAPING_OPTIONS = exports.NetworkError = exports.ValidationError = exports.ScrapingError = exports.validateUniversityData = exports.searchUniversities = exports.filterUniversities = exports.saveUniversitiesToCSV = exports.loadUniversitiesFromCSV = exports.UniversityRepository = exports.DEFAULT_SCRAPING_CONFIG = exports.UniversityScraper = exports.countryNameFromCode = exports.toPartialUniversity = exports.loadBaseUniversities = void 0;
// Core exports
__exportStar(require("./types/University"), exports);
var loadBase_1 = require("./data/loadBase");
Object.defineProperty(exports, "loadBaseUniversities", { enumerable: true, get: function () { return loadBase_1.loadBaseUniversities; } });
Object.defineProperty(exports, "toPartialUniversity", { enumerable: true, get: function () { return loadBase_1.toPartialUniversity; } });
Object.defineProperty(exports, "countryNameFromCode", { enumerable: true, get: function () { return loadBase_1.countryNameFromCode; } });
var UniversityScraper_1 = require("./scraper/UniversityScraper");
Object.defineProperty(exports, "UniversityScraper", { enumerable: true, get: function () { return UniversityScraper_1.UniversityScraper; } });
Object.defineProperty(exports, "DEFAULT_SCRAPING_CONFIG", { enumerable: true, get: function () { return UniversityScraper_1.DEFAULT_SCRAPING_CONFIG; } });
var UniversityRepository_1 = require("./repository/UniversityRepository");
Object.defineProperty(exports, "UniversityRepository", { enumerable: true, get: function () { return UniversityRepository_1.UniversityRepository; } });
// Data processing utilities
var dataProcessing_1 = require("./utils/dataProcessing");
Object.defineProperty(exports, "loadUniversitiesFromCSV", { enumerable: true, get: function () { return dataProcessing_1.loadUniversitiesFromCSV; } });
Object.defineProperty(exports, "saveUniversitiesToCSV", { enumerable: true, get: function () { return dataProcessing_1.saveUniversitiesToCSV; } });
Object.defineProperty(exports, "filterUniversities", { enumerable: true, get: function () { return dataProcessing_1.filterUniversities; } });
Object.defineProperty(exports, "searchUniversities", { enumerable: true, get: function () { return dataProcessing_1.searchUniversities; } });
Object.defineProperty(exports, "validateUniversityData", { enumerable: true, get: function () { return dataProcessing_1.validateUniversityData; } });
// Error classes
var ScrapingErrors_1 = require("./errors/ScrapingErrors");
Object.defineProperty(exports, "ScrapingError", { enumerable: true, get: function () { return ScrapingErrors_1.ScrapingError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return ScrapingErrors_1.ValidationError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return ScrapingErrors_1.NetworkError; } });
// Constants and configurations
var constants_1 = require("./config/constants");
Object.defineProperty(exports, "DEFAULT_SCRAPING_OPTIONS", { enumerable: true, get: function () { return constants_1.DEFAULT_SCRAPING_OPTIONS; } });
//# sourceMappingURL=index.js.map