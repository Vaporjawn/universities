# Changelog

## [0.1.0] - 2026-10-24

### Data

- **US block rebuilt from NCES IPEDS 2024**: 3,968 active, degree-granting institutions in the 50 states and DC (was 2,074 rows from an old snapshot, with community colleges largely missing and many pre-rename names and dead URLs). US territories and other countries are unchanged. The 1,167 old US rows whose name is not in IPEDS are listed in `scripts/data/us-rows-dropped-ipeds-2024.csv`. Anyone matching on old US names or URLs should expect differences.
- Trimmed whitespace in 94 rows and removed 5 exact duplicate rows.
- `countryNameFromCode` now knows AN, GU, ME, NU, SB, SM, SS and VA, which the CSV used but the loader could only answer with the raw code.

### Added

- `npm run sync:us` (`scripts/syncUsFromIpeds.ts`) rebuilds the US block from an IPEDS directory file; `--check` reports whether the CSV is current.
- `npm run validate:data` (`scripts/validateData.ts`) validates the CSV. The same rules run in the test suite. Intentional duplicates are listed in `scripts/data/reviewed-duplicates.json`.
- `universities list --name` (the README documented it; only `--search` existed). `--search` still works.
- `UniversitySearchOptions` fields that were declared but ignored now work: `city`, `state`, `size`, `accreditation`, and `UniversitySortField.DATA_QUALITY`.
- `scripts/enrich.ts` accepts `--csv=PATH`.
- Tests grew from 21 to 215. Statement coverage went from 30% to 97.5% and branch coverage from 12% to 91.9%, with thresholds raised to match.

### Changed

- `search({ limit: 0 })` returns no results (it returned everything). Numeric filters now treat `0` as a value, and `foundedAfter` or `minStudentCount` of `0` still apply.
- `UniversityRepository.stats()` computes `averageStudentCount` and the oldest, newest, largest and smallest universities from records that have the data (it returned placeholders).
- The CLI reports the version from `package.json` (it said 0.1.0 regardless) and gives every university a unique id.
- The published package no longer contains compiled tests. `ts-node` moved to `devDependencies`, and `exports` lists `types` first.
- `dist/`, `*.tgz` and `src/**/*.js` are no longer tracked in git.
- Removed all GitHub Actions workflows and their README badges. Releases are made manually.

### Fixed

- `npm run enrich` could not start (`import.meta` under CommonJS). `--limit=0` now means zero rows.
- Jest imported stale compiled `.js` copies of three source files, so the TypeScript was not being tested.
- `loadBaseUniversities` never settled when the CSV file was missing.
- `loadUniversitiesFromCSV` dropped records whose values contained line breaks, stripped double quotes from values, ignored the `type` column, crashed on an empty file, and reported "Unknown error" for file-system errors.
- The scraper never found a phone number on a `tel:` link that had text, and dropped social media links on pages without a phone or email.

### Known issues

- `ScrapingConfig.respectRobots` is accepted but the scraper does not read `robots.txt` yet (listed on the roadmap).

## [0.0.2] - 2025-01-19

### Added

- **Comprehensive API Documentation**: Created detailed `docs/API.md` with installation guides, usage examples, error handling patterns, and best practices
- **Data Processing Utilities**: Implemented CSV import/export, filtering, search, and validation functions in `src/utils/dataProcessing.ts`
- **Custom Error Handling**: Added specialized error classes (`ScrapingError`, `ValidationError`, `NetworkError`) in `src/errors/ScrapingErrors.ts`
- **Configuration Constants**: Centralized constants and default options in `src/config/constants.ts`
- **Build Automation**: Created comprehensive build script (`scripts/build.sh`) with linting, testing, and compilation
- **CI/CD Pipeline**: Implemented GitHub Actions workflow (`.github/workflows/ci.yml`) with multi-node testing, build artifacts, and NPM publishing
- **Enhanced Package Metadata**: Improved `package.json` with comprehensive keywords, file inclusions, and npm scripts

### Enhanced

- **Module Organization**: Implemented barrel export pattern in `src/index.ts` for clean API surface
- **Package Structure**: Organized codebase with proper directory structure (`utils/`, `errors/`, `config/`)
- **Test Infrastructure**: Maintained 100% test pass rate (21/21 tests) with enhanced ES module support
- **Code Quality**: Integrated ESLint and Prettier for consistent formatting and code standards

### Technical Improvements

- **TypeScript Integration**: Enhanced type safety with proper interface compliance
- **Error Handling**: Comprehensive error management with context-aware error classes
- **Performance**: Efficient CSV processing with proper memory management
- **Maintainability**: Clear separation of concerns with modular architecture
- **Documentation**: Production-ready documentation supporting professional usage
- **Build Pipeline**: Automated quality gates with linting, testing, and validation

### Fixes

- **ES Module Compatibility**: Resolved module conflicts in test environment
- **Interface Compliance**: Fixed University interface property mismatches in data processing
- **TypeScript Compilation**: Ensured all modules compile without errors
- **Code Formatting**: Applied consistent formatting across all source files

### Package Enhancements

- **Keywords**: Added comprehensive keywords for better discoverability (universities, education, csv, typescript, api, cli, data-processing, research, global)
- **File Inclusion**: Properly configured `files` array to include necessary assets
- **Scripts**: Enhanced npm scripts with build automation, formatting, linting, and testing
- **Dependencies**: Maintained clean dependency tree with proper dev/production separation
- **Node.js Support**: Specified minimum Node.js version (18.0.0) for compatibility

## Summary

This release transforms the universities package into a production-ready, professionally organized library with comprehensive documentation, robust error handling, automated build processes, and clean API design. The package now provides a complete solution for university data management with TypeScript support, CLI tools, and extensible architecture.
