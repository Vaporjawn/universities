#!/usr/bin/env node
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
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const loadBase_1 = require("./data/loadBase");
const UniversityRepository_1 = require("./repository/UniversityRepository");
const program = new commander_1.Command();
program.name('universities').description('CLI to search and explore world universities').version('0.1.0');
program
    .command('list')
    .description('List universities with optional filters')
    .option('-c, --country <country>', 'Filter by country name')
    .option('-C, --country-code <code>', 'Filter by ISO country code')
    .option('-s, --search <term>', 'Search by name term')
    .option('-l, --limit <number>', 'Limit number of results', '20')
    .option('--json', 'Output as JSON')
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    const repo = yield loadRepository();
    const results = repo.search({
        name: opts.search,
        country: opts.country,
        countryCode: opts.countryCode,
        limit: parseInt(opts.limit, 10),
    });
    if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
    }
    else {
        for (const u of results) {
            console.log(`${u.countryCode}\t${u.name}\t${u.url}`);
        }
        console.log(`\n${results.length} universities shown.`);
    }
}));
program
    .command('enrich <url>')
    .description('Enrich a single university URL to show sample data fields')
    .action((url) => __awaiter(void 0, void 0, void 0, function* () {
    // Lazy import to avoid loading ESM-only dependencies during normal list usage
    const { UniversityScraper } = yield Promise.resolve().then(() => __importStar(require('./scraper/UniversityScraper')));
    const scraper = new UniversityScraper();
    const uni = yield scraper.scrapeUniversity({ url, name: url, countryCode: 'XX', country: 'Unknown' });
    console.log(JSON.stringify(uni, null, 2));
}));
program
    .command('stats')
    .description('Show statistics about the dataset')
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    const repo = yield loadRepository();
    const stats = repo.stats();
    console.log(JSON.stringify(stats, null, 2));
}));
function loadRepository() {
    return __awaiter(this, void 0, void 0, function* () {
        const csvPath = path_1.default.join(__dirname, '..', 'world-universities.csv');
        let resolvedCsv = csvPath;
        if (!fs_1.default.existsSync(resolvedCsv)) {
            // fallback to root
            resolvedCsv = path_1.default.join(__dirname, '..', '..', 'world-universities.csv');
        }
        const base = yield (0, loadBase_1.loadBaseUniversities)(resolvedCsv);
        const universities = base.map(r => (Object.assign(Object.assign({}, (0, loadBase_1.toPartialUniversity)(r)), { id: `${r.countryCode}-${r.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, lastUpdated: new Date(), dataQuality: { completeness: 0.1, accuracy: 0.5, freshness: 1, reliability: 0.4 }, sources: [r.url] })));
        return new UniversityRepository_1.UniversityRepository(universities);
    });
}
program.parseAsync(process.argv);
//# sourceMappingURL=cli.js.map