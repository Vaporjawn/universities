#!/usr/bin/env ts-node
/*
 * Build the documentation site into site/ (not published to npm, not tracked in git):
 *   site/index.html    the README
 *   site/guide.html    docs/API.md
 *   site/api.html      API reference generated from the TypeScript sources and their TSDoc comments
 *   site/metrics.html  dataset metrics from world-universities.csv, plus enrichment coverage when data/ holds a run
 * Run `npm run docs`, then publish site/ with any static host (for example GitHub Pages).
 */
import fs from 'fs-extra';
import MarkdownIt from 'markdown-it';
import path from 'path';
import { countryNameFromCode, loadBaseUniversities } from '../src/data/loadBase';
import { extractApi, pageShell, renderApiHtml } from '../src/site/apiReference';
import {
  computeDatasetMetrics,
  computeEnrichmentMetrics,
  EnrichmentMetrics,
  renderMetricsHtml,
} from '../src/site/siteMetrics';
import { University } from '../src/types/University';

const root = path.resolve(__dirname, '..');
const site = path.join(root, 'site');

/** Read the latest run's manifest counts, when `data/manifest.json` exists. */
const readRun = async (): Promise<EnrichmentMetrics['run']> => {
  const file = path.join(root, 'data', 'manifest.json');
  if (!(await fs.pathExists(file))) return undefined;
  const manifest = await fs.readJSON(file);
  return { runId: manifest.runId, finishedAt: manifest.finishedAt, ...manifest.counts };
};

/** Render a markdown file as a site page. Raw HTML in the README (badges) is kept; the source is this repository's own. */
const renderMarkdownPage = async (file: string, title: string): Promise<string> => {
  const markdown = new MarkdownIt({ html: true, linkify: true });
  return pageShell(title, markdown.render(await fs.readFile(path.join(root, file), 'utf8')));
};

const main = async (): Promise<void> => {
  await fs.remove(site);
  await fs.ensureDir(site);

  const api = extractApi(path.join(root, 'src', 'index.ts'), path.join(root, 'tsconfig.build.json'));
  await fs.writeFile(path.join(site, 'api.html'), renderApiHtml(api));
  await fs.writeFile(path.join(site, 'index.html'), await renderMarkdownPage('README.md', 'universities'));
  await fs.writeFile(path.join(site, 'guide.html'), await renderMarkdownPage('docs/API.md', 'universities guide'));

  const rows = await loadBaseUniversities(path.join(root, 'world-universities.csv'));
  const dataset = computeDatasetMetrics(rows, countryNameFromCode);
  const enrichedFile = path.join(root, 'data', 'enriched-universities.json');
  const enrichment = (await fs.pathExists(enrichedFile))
    ? computeEnrichmentMetrics((await fs.readJSON(enrichedFile)) as University[], await readRun())
    : undefined;
  await fs.writeFile(path.join(site, 'metrics.html'), renderMetricsHtml(dataset, enrichment, new Date()));

  console.log(`Documentation site: ${api.length} API exports, written to ${site}`);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
