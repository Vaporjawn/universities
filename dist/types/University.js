"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversitySortField = exports.DegreeLevel = exports.UniversitySize = exports.UniversityType = void 0;
/**
 * University type classification
 */
var UniversityType;
(function (UniversityType) {
    // eslint-disable-next-line no-unused-vars
    UniversityType["PUBLIC"] = "public";
    // eslint-disable-next-line no-unused-vars
    UniversityType["PRIVATE"] = "private";
    // eslint-disable-next-line no-unused-vars
    UniversityType["PRIVATE_NON_PROFIT"] = "private_non_profit";
    // eslint-disable-next-line no-unused-vars
    UniversityType["PRIVATE_FOR_PROFIT"] = "private_for_profit";
    // eslint-disable-next-line no-unused-vars
    UniversityType["RELIGIOUS"] = "religious";
    // eslint-disable-next-line no-unused-vars
    UniversityType["MILITARY"] = "military";
    // eslint-disable-next-line no-unused-vars
    UniversityType["TECHNICAL"] = "technical";
    // eslint-disable-next-line no-unused-vars
    UniversityType["COMMUNITY_COLLEGE"] = "community_college";
    // eslint-disable-next-line no-unused-vars
    UniversityType["LIBERAL_ARTS"] = "liberal_arts";
    // eslint-disable-next-line no-unused-vars
    UniversityType["RESEARCH"] = "research";
    // eslint-disable-next-line no-unused-vars
    UniversityType["TEACHING"] = "teaching";
    // eslint-disable-next-line no-unused-vars
    UniversityType["ONLINE"] = "online";
    // eslint-disable-next-line no-unused-vars
    UniversityType["SPECIALIZED"] = "specialized";
})(UniversityType || (exports.UniversityType = UniversityType = {}));
/**
 * University size classification
 */
var UniversitySize;
(function (UniversitySize) {
    // eslint-disable-next-line no-unused-vars
    UniversitySize["VERY_SMALL"] = "very_small";
    // eslint-disable-next-line no-unused-vars
    UniversitySize["SMALL"] = "small";
    // eslint-disable-next-line no-unused-vars
    UniversitySize["MEDIUM"] = "medium";
    // eslint-disable-next-line no-unused-vars
    UniversitySize["LARGE"] = "large";
    // eslint-disable-next-line no-unused-vars
    UniversitySize["VERY_LARGE"] = "very_large";
})(UniversitySize || (exports.UniversitySize = UniversitySize = {}));
/**
 * Academic degree levels offered
 */
var DegreeLevel;
(function (DegreeLevel) {
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["CERTIFICATE"] = "certificate";
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["ASSOCIATE"] = "associate";
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["BACHELOR"] = "bachelor";
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["MASTER"] = "master";
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["DOCTORAL"] = "doctoral";
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["PROFESSIONAL"] = "professional";
    // eslint-disable-next-line no-unused-vars
    DegreeLevel["POSTDOCTORAL"] = "postdoctoral";
})(DegreeLevel || (exports.DegreeLevel = DegreeLevel = {}));
var UniversitySortField;
(function (UniversitySortField) {
    // eslint-disable-next-line no-unused-vars
    UniversitySortField["NAME"] = "name";
    // eslint-disable-next-line no-unused-vars
    UniversitySortField["COUNTRY"] = "country";
    // eslint-disable-next-line no-unused-vars
    UniversitySortField["FOUNDED_YEAR"] = "foundedYear";
    // eslint-disable-next-line no-unused-vars
    UniversitySortField["STUDENT_COUNT"] = "studentCount";
    // eslint-disable-next-line no-unused-vars
    UniversitySortField["DATA_QUALITY"] = "dataQuality";
})(UniversitySortField || (exports.UniversitySortField = UniversitySortField = {}));
//# sourceMappingURL=University.js.map