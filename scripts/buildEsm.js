#!/usr/bin/env node
/*
 * Builds the ES module entry point next to the CommonJS build that `tsc` writes to dist/.
 *
 * tsc keeps emitting CommonJS (dist/index.js, which `bin` and `main` use). This script bundles the library's own
 * modules into one dist/esm/index.mjs, leaving every dependency as a real import, and writes a matching
 * dist/esm/index.d.mts that re-exports the CommonJS typings. A bundler is used because the sources import each
 * other without file extensions, which Node's ES module loader does not accept.
 */
const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'esm');

build({
  entryPoints: [path.join(root, 'src', 'index.ts')],
  outfile: path.join(outDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: true,
  logLevel: 'warning',
})
  .then(() => {
    fs.writeFileSync(path.join(outDir, 'index.d.mts'), "export * from '../index.js';\n");
    console.log('Built dist/esm/index.mjs');
  })
  .catch(() => {
    process.exitCode = 1;
  });
