import path from 'path';
import { extractApi, pageShell, renderApiHtml } from '../site/apiReference';
import { computeDatasetMetrics, computeEnrichmentMetrics, escapeHtml, renderMetricsHtml } from '../site/siteMetrics';
import { University } from '../types/University';

describe('computeDatasetMetrics', () => {
  const rows = [
    { countryCode: 'GB', url: 'https://www.a.ac.uk/' },
    { countryCode: 'GB', url: 'https://a.ac.uk/other' },
    { countryCode: 'FR', url: 'https://b.fr' },
    { countryCode: 'ZZ', url: 'broken' },
  ];
  const metrics = computeDatasetMetrics(rows, code => ({ GB: 'United Kingdom', FR: 'France' })[code] ?? code);

  it('counts universities, countries, distinct sites and geography, sorted by size', () => {
    expect(metrics).toMatchObject({ totalUniversities: 4, countries: 3, uniqueHosts: 2, unknownCountryCodes: ['ZZ'] });
    expect(metrics.byContinent).toEqual([['Europe', 3]]);
    expect(metrics.bySubregion).toEqual([
      ['Northern Europe', 2],
      ['Western Europe', 1],
    ]);
    expect(metrics.topCountries[0]).toEqual(['United Kingdom', 2]);
  });
});

describe('computeEnrichmentMetrics', () => {
  const u = (extra: Partial<University>): University =>
    ({ id: 'x', name: 'x', dataQuality: { completeness: 0.5 }, ...extra }) as University;

  it('measures field coverage and average completeness', () => {
    const m = computeEnrichmentMetrics([
      u({
        description: 'd',
        contact: { email: 'e@x.edu' },
        city: 'c',
        foundedYear: 1900,
        type: 'public' as University['type'],
        rankings: [{ source: 'QS', rank: 1, year: 2026 }],
      }),
      u({ accreditation: ['A'], dataQuality: { completeness: 1 } as University['dataQuality'] }),
    ]);
    expect(m).toMatchObject({
      total: 2,
      withDescription: 1,
      withContact: 1,
      withLocation: 1,
      withFoundedYear: 1,
      withType: 1,
      withRankings: 1,
      withAccreditation: 1,
      withSize: 0,
      averageCompleteness: 0.75,
    });
  });

  it('handles an empty dataset', () => {
    expect(computeEnrichmentMetrics([])).toMatchObject({ total: 0, averageCompleteness: 0 });
  });
});

describe('renderMetricsHtml', () => {
  const dataset = computeDatasetMetrics([{ countryCode: 'GB', url: 'https://a.ac.uk' }], () => '<Evil & "Co">');
  const at = new Date('2026-11-24T00:00:00Z');

  it('escapes text, shows the figures, and reports a missing enriched dataset', () => {
    const html = renderMetricsHtml(dataset, undefined, at);
    expect(html).toContain('&lt;Evil &amp; &quot;Co&quot;&gt;');
    expect(html).not.toContain('<Evil');
    expect(html).toContain('No enriched dataset was found');
    expect(html).toContain('2026-11-24T00:00:00.000Z');
    expect(html).not.toContain('<script');
  });

  it('shows enrichment coverage and the last run', () => {
    const enrichment = computeEnrichmentMetrics([], {
      runId: 'r<1>',
      finishedAt: 'now',
      fromCache: 1,
      enriched: 2,
      failed: 3,
      blockedByRobots: 4,
    });
    const html = renderMetricsHtml(
      dataset,
      { ...enrichment, total: 10, withDescription: 5, averageCompleteness: 0.5 },
      at
    );
    expect(html).toContain('Enrichment coverage');
    expect(html).toContain('50.0%');
    expect(html).toContain('r&lt;1&gt;');
    expect(html).toContain('4 blocked by robots.txt');
  });

  it('lists country codes with no known continent', () => {
    const odd = computeDatasetMetrics([{ countryCode: 'ZZ', url: 'x' }], c => c);
    expect(renderMetricsHtml(odd, undefined, at)).toContain('no continent known for: ZZ');
  });

  it('escapes every special character', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('API reference', () => {
  const root = path.join(__dirname, '..', '..');
  const items = extractApi(path.join(root, 'src', 'index.ts'), path.join(root, 'tsconfig.build.json'));
  const byName = (name: string) => items.find(i => i.name === name);

  it('lists the public exports with their kinds, docs and members', () => {
    expect(items.length).toBeGreaterThan(60);
    expect(byName('UniversityScraper')?.kind).toBe('class');
    expect(byName('runEnrichment')).toMatchObject({
      kind: 'function',
      doc: expect.stringContaining('Run the enrichment pipeline'),
    });
    expect(byName('University')?.kind).toBe('interface');
    expect(byName('UniversityType')?.members.map(m => m.name)).toContain('PUBLIC');
    expect(byName('ScrapeStatus')).toMatchObject({
      kind: 'type',
      signature: expect.stringContaining('blocked-by-robots'),
    });
    expect(byName('DEFAULT_SCRAPING_CONFIG')?.kind).toBe('constant');
    expect(byName('estimateSize')?.doc).toContain('student count');
  });

  it('leaves private members out and marks optional ones', () => {
    const scraper = byName('UniversityScraper');
    expect(scraper?.members.map(m => m.name)).toEqual(expect.arrayContaining(['scrapeUniversityDetailed', 'stats']));
    expect(scraper?.members.map(m => m.name)).not.toContain('fetchWithRetry');
    expect(byName('ScrapingConfig')?.members.find(m => m.name === 'hostInterval')?.optional).toBe(true);
  });

  it('renders every export with an anchor, escaped, inside the shared page', () => {
    const html = renderApiHtml(items);
    expect(html).toContain('<section id="runEnrichment">');
    expect(html).toContain('<a href="metrics.html">Metrics</a>');
    expect(html.match(/<section id=/g)).toHaveLength(items.length);
    expect(pageShell('<t>', '').includes('<title>&lt;t&gt;</title>')).toBe(true);
  });

  it('fails clearly for an entry that is not a module', () => {
    expect(() => extractApi(path.join(root, 'package.json'), path.join(root, 'tsconfig.build.json'))).toThrow();
  });
});
