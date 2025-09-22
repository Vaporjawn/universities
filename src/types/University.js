'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SortOption = exports.DegreeLevel = exports.UniversitySize = exports.UniversityType = void 0;
/**
 * University type classification
 */
var UniversityType;
(function (UniversityType) {
  UniversityType['PUBLIC'] = 'public';
  UniversityType['PRIVATE'] = 'private';
  UniversityType['PRIVATE_NON_PROFIT'] = 'private-non-profit';
  UniversityType['PRIVATE_FOR_PROFIT'] = 'private-for-profit';
  UniversityType['RELIGIOUS'] = 'religious';
  UniversityType['MILITARY'] = 'military';
  UniversityType['TECHNICAL'] = 'technical';
  UniversityType['COMMUNITY_COLLEGE'] = 'community-college';
  UniversityType['LIBERAL_ARTS'] = 'liberal-arts';
  UniversityType['RESEARCH'] = 'research';
  UniversityType['TEACHING'] = 'teaching';
  UniversityType['ONLINE'] = 'online';
  UniversityType['SPECIALIZED'] = 'specialized';
})(UniversityType || (exports.UniversityType = UniversityType = {}));
/**
 * University size classification
 */
var UniversitySize;
(function (UniversitySize) {
  UniversitySize['VERY_SMALL'] = 'very-small';
  UniversitySize['SMALL'] = 'small';
  UniversitySize['MEDIUM'] = 'medium';
  UniversitySize['LARGE'] = 'large';
  UniversitySize['VERY_LARGE'] = 'very-large'; // > 30,000 students
})(UniversitySize || (exports.UniversitySize = UniversitySize = {}));
/**
 * Academic degree levels offered
 */
var DegreeLevel;
(function (DegreeLevel) {
  DegreeLevel['CERTIFICATE'] = 'certificate';
  DegreeLevel['ASSOCIATE'] = 'associate';
  DegreeLevel['BACHELOR'] = 'bachelor';
  DegreeLevel['MASTER'] = 'master';
  DegreeLevel['DOCTORAL'] = 'doctoral';
  DegreeLevel['PROFESSIONAL'] = 'professional';
  DegreeLevel['POSTDOCTORAL'] = 'postdoctoral';
})(DegreeLevel || (exports.DegreeLevel = DegreeLevel = {}));
var SortOption;
(function (SortOption) {
  SortOption['NAME'] = 'name';
  SortOption['COUNTRY'] = 'country';
  SortOption['FOUNDED_YEAR'] = 'foundedYear';
  SortOption['STUDENT_COUNT'] = 'studentCount';
  SortOption['DATA_QUALITY'] = 'dataQuality';
})(SortOption || (exports.SortOption = SortOption = {}));
