import { inferGeography } from '../data/regions';
import { University } from '../types/University';

/** Counts derived from the base CSV. */
export interface DatasetMetrics {
  totalUniversities: number;
  countries: number;
  uniqueHosts: number;
  byContinent: [string, number][];
  bySubregion: [string, number][];
  topCountries: [string, number][];
  unknownCountryCodes: string[];
}

/** Coverage figures derived from an enriched dataset and its run files. */
export interface EnrichmentMetrics {
  total: number;
  withDescription: number;
  withContact: number;
  withLocation: number;
  withFoundedYear: number;
  withType: number;
  withSize: number;
  withRankings: number;
  withAccreditation: number;
  averageCompleteness: number;
  run?: {
    runId: string;
    finishedAt: string;
    fromCache: number;
    enriched: number;
    failed: number;
    blockedByRobots: number;
  };
}

/** Sort `[key, count]` pairs by count, then name. */
const sortedCounts = (counts: Map<string, number>): [string, number][] =>
  [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * Summarise the base CSV rows.
 *
 * @param rows - Rows with a country code and URL.
 * @param countryName - Resolves a country code to a display name.
 */
export const computeDatasetMetrics = (
  rows: { countryCode: string; url: string }[],
  countryName: (code: string) => string
): DatasetMetrics => {
  const continents = new Map<string, number>();
  const subregions = new Map<string, number>();
  const countries = new Map<string, number>();
  const hosts = new Set<string>();
  const unknown = new Set<string>();

  for (const row of rows) {
    const geography = inferGeography(row.countryCode);
    if (geography) {
      continents.set(geography.continent, (continents.get(geography.continent) ?? 0) + 1);
      subregions.set(geography.subregion, (subregions.get(geography.subregion) ?? 0) + 1);
    } else {
      unknown.add(row.countryCode);
    }
    const name = countryName(row.countryCode);
    countries.set(name, (countries.get(name) ?? 0) + 1);
    try {
      hosts.add(new URL(row.url).hostname.replace(/^www\./, ''));
    } catch {
      // A URL that cannot be parsed has no host to count.
    }
  }
  return {
    totalUniversities: rows.length,
    countries: countries.size,
    uniqueHosts: hosts.size,
    byContinent: sortedCounts(continents),
    bySubregion: sortedCounts(subregions),
    topCountries: sortedCounts(countries).slice(0, 25),
    unknownCountryCodes: [...unknown].sort(),
  };
};

/**
 * Summarise how complete an enriched dataset is.
 *
 * @param universities - Enriched records.
 * @param run - Counts from the run's manifest, when available.
 */
export const computeEnrichmentMetrics = (
  universities: University[],
  run?: EnrichmentMetrics['run']
): EnrichmentMetrics => {
  const count = (test: (u: University) => boolean): number => universities.filter(test).length;
  const completeness = universities.reduce((sum, u) => sum + (u.dataQuality?.completeness ?? 0), 0);
  return {
    total: universities.length,
    withDescription: count(u => Boolean(u.description)),
    withContact: count(u => Boolean(u.contact?.email || u.contact?.phone)),
    withLocation: count(u => Boolean(u.city || u.address)),
    withFoundedYear: count(u => u.foundedYear !== undefined),
    withType: count(u => Boolean(u.type)),
    withSize: count(u => Boolean(u.size)),
    withRankings: count(u => (u.rankings?.length ?? 0) > 0),
    withAccreditation: count(u => (u.accreditation?.length ?? 0) > 0),
    averageCompleteness: universities.length ? completeness / universities.length : 0,
    run,
  };
};

/** Escape text for HTML. */
export const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );

/** A table of `[label, count]` rows with a share column and a bar. */
const countTable = (title: string, rows: [string, number][], total: number): string => {
  const body = rows
    .map(([label, n]) => {
      const share = total > 0 ? (n / total) * 100 : 0;
      return `<tr><td>${escapeHtml(label)}</td><td class="n">${n.toLocaleString('en-US')}</td><td class="n">${share.toFixed(1)}%</td><td><span class="bar" style="width:${share.toFixed(1)}%"></span></td></tr>`;
    })
    .join('');
  return `<section><h2>${escapeHtml(title)}</h2><table class="counts"><thead><tr><th>Name</th><th>Universities</th><th>Share</th><th></th></tr></thead><tbody>${body}</tbody></table></section>`;
};

/**
 * Render the metrics page as one self-contained HTML document (no scripts, no external requests).
 *
 * @param dataset - Output of {@link computeDatasetMetrics}.
 * @param enrichment - Output of {@link computeEnrichmentMetrics}, when an enriched dataset exists.
 * @param generatedAt - Timestamp shown in the footer.
 */
export const renderMetricsHtml = (
  dataset: DatasetMetrics,
  enrichment: EnrichmentMetrics | undefined,
  generatedAt: Date
): string => {
  const percent = (n: number, total: number): string => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0.0%');
  const enrichmentSection = enrichment
    ? `<section><h2>Enrichment coverage</h2>
<p>${enrichment.total.toLocaleString('en-US')} enriched universities, average completeness ${(enrichment.averageCompleteness * 100).toFixed(1)}%.${
        enrichment.run
          ? ` Last run <code>${escapeHtml(enrichment.run.runId)}</code> finished ${escapeHtml(enrichment.run.finishedAt)}: ${enrichment.run.enriched} enriched, ${enrichment.run.fromCache} from cache, ${enrichment.run.failed} failed, ${enrichment.run.blockedByRobots} blocked by robots.txt.`
          : ''
      }</p>
<table><thead><tr><th>Field</th><th>Universities</th><th>Coverage</th></tr></thead><tbody>${[
        ['Description', enrichment.withDescription],
        ['Email or phone', enrichment.withContact],
        ['City or address', enrichment.withLocation],
        ['Founded year', enrichment.withFoundedYear],
        ['Type', enrichment.withType],
        ['Size class', enrichment.withSize],
        ['Rankings', enrichment.withRankings],
        ['Accreditation', enrichment.withAccreditation],
      ]
        .map(
          ([label, n]) =>
            `<tr><td>${label}</td><td class="n">${(n as number).toLocaleString('en-US')}</td><td class="n">${percent(n as number, enrichment.total)}</td></tr>`
        )
        .join('')}</tbody></table></section>`
    : '<section><h2>Enrichment coverage</h2><p>No enriched dataset was found. Run <code>npm run enrich</code>, then rebuild this site with <code>npm run docs</code>.</p></section>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>universities: dataset metrics</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1c1e;--muted:#666;--line:#ddd;--accent:#2b6cb0}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#eee;--muted:#9a9a9f;--line:#333;--accent:#63a4e8}}
body{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);max-width:60rem;margin:0 auto;padding:1rem}
table{border-collapse:collapse;width:100%}th,td{padding:.35rem .6rem;border-bottom:1px solid var(--line);text-align:left}
.n{text-align:right;font-variant-numeric:tabular-nums}.counts td:last-child,.counts th:last-child{width:40%}.bar{display:block;height:.6rem;background:var(--accent);border-radius:2px}
.stats{display:flex;flex-wrap:wrap;gap:1rem}.stats div{flex:1 1 10rem;border:1px solid var(--line);border-radius:6px;padding:.75rem}
.stats b{display:block;font-size:1.6rem}footer{color:var(--muted);margin-top:2rem;font-size:.9rem}a{color:var(--accent)}
</style></head><body>
<h1>universities: dataset metrics</h1>
<p><a href="index.html">Home</a> · <a href="api.html">API reference</a> · <a href="guide.html">Guide</a> · <a href="https://github.com/Vaporjawn/universities">GitHub</a></p>
<div class="stats">
<div><b>${dataset.totalUniversities.toLocaleString('en-US')}</b>universities</div>
<div><b>${dataset.countries.toLocaleString('en-US')}</b>countries and territories</div>
<div><b>${dataset.uniqueHosts.toLocaleString('en-US')}</b>distinct websites</div>
</div>
${countTable('By continent', dataset.byContinent, dataset.totalUniversities)}
${countTable('By sub-region', dataset.bySubregion, dataset.totalUniversities)}
${countTable('Top 25 countries', dataset.topCountries, dataset.totalUniversities)}
${enrichmentSection}
<footer>Generated ${escapeHtml(generatedAt.toISOString())}${dataset.unknownCountryCodes.length ? ` · no continent known for: ${escapeHtml(dataset.unknownCountryCodes.join(', '))}` : ''}</footer>
</body></html>
`;
};
