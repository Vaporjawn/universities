#!/usr/bin/env ts-node
/*
 * Batch enrichment: `npm run enrich -- --limit=5 --country-code=GB --resume`.
 * A thin wrapper around the same command as `universities enrich-all`; run it with --help for the options.
 */
import path from 'path';
import { enrichMain } from '../src/enrichment/run';
import { version } from '../package.json';

const root = path.resolve(__dirname, '..');

enrichMain(process.argv.slice(2), {
  defaultCsv: path.join(root, 'world-universities.csv'),
  defaultOutDir: path.join(root, 'data'),
  toolVersion: version,
})
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
