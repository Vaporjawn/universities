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
exports.UniversityRepository = exports.DEFAULT_SCRAPING_CONFIG = exports.UniversityScraper = exports.countryNameFromCode = exports.toPartialUniversity = exports.loadBaseUniversities = void 0;
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
//# sourceMappingURL=index.js.map