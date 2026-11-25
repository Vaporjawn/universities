#!/usr/bin/env node
/*
 * Checks the built package from both module systems: `require` and `import` must load, expose the same exports, and
 * the functions that need no network must work. Run after `npm run build:tsc`; `build:publish` does.
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

const exercise = (lib, label) => {
  assert.strictEqual(typeof lib.UniversityScraper, 'function', `${label}: UniversityScraper`);
  assert.strictEqual(typeof lib.runEnrichment, 'function', `${label}: runEnrichment`);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(lib.inferGeography('gb'))),
    { continent: 'Europe', subregion: 'Northern Europe' },
    `${label}: inferGeography`
  );
  assert.strictEqual(lib.estimateSize(20000), 'large', `${label}: estimateSize`);
  const rules = lib.selectRules(lib.parseRobots('User-agent: *\nDisallow: /private'), 'TestBot/1.0');
  assert.strictEqual(lib.isPathAllowed(rules, '/private/x'), false, `${label}: robots disallow`);
  assert.strictEqual(lib.isPathAllowed(rules, '/public'), true, `${label}: robots allow`);
  const scraper = new lib.UniversityScraper({ respectRobots: true });
  assert.strictEqual(scraper.settings.respectRobots, true, `${label}: scraper construction`);
};

const main = async () => {
  const cjs = require(path.join(root, 'dist', 'index.js'));
  const esm = await import(pathToFileURL(path.join(root, 'dist', 'esm', 'index.mjs')).href);
  exercise(cjs, 'require');
  exercise(esm, 'import');

  const cjsNames = Object.keys(cjs)
    .filter(name => name !== '__esModule')
    .sort();
  const esmNames = Object.keys(esm)
    .filter(name => name !== 'default')
    .sort();
  assert.deepStrictEqual(esmNames, cjsNames, 'the ESM and CommonJS builds must export the same names');

  // The package's own name must resolve through "exports" for both conditions.
  const self = path.join(root, 'package.json');
  const manifest = require(self);
  assert.ok(manifest.exports['.'].import && manifest.exports['.'].require, 'exports needs import and require');

  const version = execFileSync(process.execPath, [path.join(root, 'dist', 'cli.js'), '--version'], {
    encoding: 'utf8',
  }).trim();
  assert.strictEqual(version, manifest.version, 'CLI version');
  console.log(`dist OK: ${cjsNames.length} exports from both require() and import()`);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
