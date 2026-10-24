import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  IpedsInstitution,
  US_STATE_AND_DC_CODES,
  formatCsvLine,
  normalizeWebAddress,
  parseIpedsDirectory,
  replaceCountryBlock,
  selectUsInstitutions,
  toUsCsvRows,
} from '../ipeds';
import { loadBaseUniversities } from '../data/loadBase';

function institution(overrides: Partial<IpedsInstitution>): IpedsInstitution {
  return {
    unitId: '1',
    name: 'Example University',
    stateCode: 'CA',
    webAddress: 'www.example.edu/',
    isActive: true,
    isDegreeGranting: true,
    ...overrides,
  };
}

describe('normalizeWebAddress', () => {
  it.each([
    ['www.example.edu/', 'http://www.example.edu/'],
    ['https://www.example.edu/', 'https://www.example.edu/'],
    ['  http://example.edu  ', 'http://example.edu'],
    ['example.edu/admissions', 'http://example.edu/admissions'],
  ])('keeps or completes %p as %p', (raw, expected) => {
    expect(normalizeWebAddress(raw)).toBe(expected);
  });

  it('drops URL fragments such as IPEDS location anchors', () => {
    expect(normalizeWebAddress('www.southuniversity.edu/tampa#location=Tampa, FL')).toBe(
      'http://www.southuniversity.edu/tampa'
    );
  });

  it.each([undefined, '', '   ', 'not a url', 'localhost', 'ftp://example.edu/', 'http://', '#only-a-fragment'])(
    'rejects %p',
    raw => {
      expect(normalizeWebAddress(raw)).toBeUndefined();
    }
  );
});

describe('formatCsvLine', () => {
  it('leaves plain fields unquoted', () => {
    expect(formatCsvLine({ countryCode: 'US', name: 'Harvard University', url: 'http://www.harvard.edu/' })).toBe(
      'US,Harvard University,http://www.harvard.edu/'
    );
  });

  it('quotes fields containing commas and doubles embedded quotes', () => {
    expect(formatCsvLine({ countryCode: 'US', name: 'School of "Arts", Letters', url: 'http://a.edu/' })).toBe(
      'US,"School of ""Arts"", Letters",http://a.edu/'
    );
  });
});

describe('selectUsInstitutions', () => {
  it('keeps active degree-granting institutions in the 50 states and DC', () => {
    const kept = selectUsInstitutions([
      institution({ unitId: 'ok', stateCode: 'DC' }),
      institution({ unitId: 'closed', isActive: false }),
      institution({ unitId: 'non-degree', isDegreeGranting: false }),
      institution({ unitId: 'territory', stateCode: 'PR' }),
      institution({ unitId: 'unknown-state', stateCode: '' }),
    ]);
    expect(kept.map(i => i.unitId)).toEqual(['ok']);
  });

  it('knows exactly 51 state-level codes', () => {
    expect(new Set(US_STATE_AND_DC_CODES).size).toBe(51);
  });
});

describe('toUsCsvRows', () => {
  it('sorts by name case-insensitively and reports institutions without a website', () => {
    const { rows, skippedWithoutWebsite } = toUsCsvRows([
      institution({ unitId: '1', name: 'beta College', webAddress: 'beta.edu' }),
      institution({ unitId: '2', name: 'Alpha College', webAddress: 'alpha.edu' }),
      institution({ unitId: '3', name: 'Gamma College', webAddress: '' }),
    ]);
    expect(rows.map(r => r.name)).toEqual(['Alpha College', 'beta College']);
    expect(rows.every(r => r.countryCode === 'US')).toBe(true);
    expect(skippedWithoutWebsite.map(i => i.unitId)).toEqual(['3']);
  });

  it('keeps same-named institutions in different states as separate rows', () => {
    const { rows } = toUsCsvRows([
      institution({ unitId: '1', name: 'Glendale Community College', stateCode: 'AZ', webAddress: 'gccaz.edu' }),
      institution({ unitId: '2', name: 'Glendale Community College', stateCode: 'CA', webAddress: 'glendale.edu' }),
    ]);
    expect(rows.map(r => r.url)).toEqual(['http://gccaz.edu', 'http://glendale.edu']);
  });
});

describe('replaceCountryBlock', () => {
  const csv =
    'AD,Andorra U,http://a.ad/\nUS,Old One,http://old1.edu/\nUS,Old Two,http://old2.edu/\nZW,Zim U,http://z.zw/\n';

  it('replaces only the target country block, in place, preserving everything else', () => {
    const result = replaceCountryBlock(csv, 'US', [{ countryCode: 'US', name: 'New, One', url: 'http://new.edu/' }]);
    expect(result).toBe('AD,Andorra U,http://a.ad/\nUS,"New, One",http://new.edu/\nZW,Zim U,http://z.zw/\n');
  });

  it('can empty a country block', () => {
    expect(replaceCountryBlock(csv, 'US', [])).toBe('AD,Andorra U,http://a.ad/\nZW,Zim U,http://z.zw/\n');
  });

  it('throws when the country has no rows to anchor on', () => {
    expect(() => replaceCountryBlock(csv, 'FR', [])).toThrow('No existing rows for country FR');
  });
});

describe('parseIpedsDirectory', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipeds-test-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads a BOM-prefixed IPEDS file and maps the columns', async () => {
    const file = path.join(dir, 'HD.csv');
    fs.writeFileSync(
      file,
      '﻿UNITID,INSTNM,STABBR,WEBADDR,CYACTIVE,DEGGRANT\n' +
        '100654,"Alabama A & M University",AL,www.aamu.edu/,1,1\n' +
        '100001,"Closed, College",ca,,3,2\n' +
        ',Missing Id,CA,x.edu,1,1\n'
    );
    const parsed = await parseIpedsDirectory(file);
    expect(parsed).toEqual([
      {
        unitId: '100654',
        name: 'Alabama A & M University',
        stateCode: 'AL',
        webAddress: 'www.aamu.edu/',
        isActive: true,
        isDegreeGranting: true,
      },
      {
        unitId: '100001',
        name: 'Closed, College',
        stateCode: 'CA',
        webAddress: '',
        isActive: false,
        isDegreeGranting: false,
      },
    ]);
  });

  it('rejects when the file does not exist', async () => {
    await expect(parseIpedsDirectory(path.join(dir, 'missing.csv'))).rejects.toThrow();
  });
});

describe('the US block of world-universities.csv', () => {
  let us: { name: string; url: string }[];

  beforeAll(async () => {
    const all = await loadBaseUniversities(path.join(process.cwd(), 'world-universities.csv'));
    us = all.filter(r => r.countryCode === 'US');
  });

  it('covers the IPEDS universe (4,000-ish active degree-granting institutions), not a partial sample', () => {
    expect(us.length).toBeGreaterThanOrEqual(3900);
  });

  it.each([
    'Harvard University',
    'Massachusetts Institute of Technology',
    'Stanford University',
    'University of California-Berkeley',
    'City College of San Francisco',
    'Hawkeye Community College',
    'Howard University',
  ])('includes %s', name => {
    expect(us.some(r => r.name === name)).toBe(true);
  });

  it('has no duplicate name and URL pair beyond the reviewed ones', () => {
    const reviewed = new Set<string>(
      JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'scripts', 'data', 'reviewed-duplicates.json'), 'utf8')
      ).reviewed
    );
    const counts = new Map<string, number>();
    us.forEach(r => {
      const key = `US|${r.name.toLowerCase()}|${r.url.toLowerCase()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const unreviewed = [...counts].filter(([key, count]) => count > 1 && !reviewed.has(key)).map(([key]) => key);
    expect(unreviewed).toEqual([]);
  });

  it('has only http(s) URLs without fragments', () => {
    us.forEach(r => {
      expect(r.url).toMatch(/^https?:\/\/[^\s#]+$/);
    });
  });
});
