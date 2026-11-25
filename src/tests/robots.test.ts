import { HostThrottle, isPathAllowed, parseRobots, RobotsChecker, selectRules } from '../scraper/robots';

const BOT = 'WorldUniversitiesBot/1.0 (Educational Research)';

describe('parseRobots', () => {
  it('groups consecutive user agents and ignores comments, blank lines and unknown fields', () => {
    const groups = parseRobots(
      [
        '# comment',
        'User-agent: A',
        'User-agent: B',
        'Disallow: /x # trailing',
        '',
        'Sitemap: /s.xml',
        'User-agent: *',
        'Allow: /y',
      ].join('\n')
    );
    expect(groups).toEqual([
      { agents: ['a', 'b'], allow: [], disallow: ['/x'] },
      { agents: ['*'], allow: ['/y'], disallow: [] },
    ]);
  });

  it('treats an empty Disallow as no rule and reads Crawl-delay, ignoring bad values', () => {
    const [group] = parseRobots('User-agent: *\nDisallow:\nCrawl-delay: 2.5');
    expect(group.disallow).toEqual([]);
    expect(group.crawlDelay).toBe(2.5);
    expect(parseRobots('User-agent: *\nCrawl-delay: soon')[0].crawlDelay).toBeUndefined();
    expect(parseRobots('User-agent: *\nCrawl-delay: -1')[0].crawlDelay).toBeUndefined();
  });

  it('ignores rules that appear before any User-agent line and handles CRLF', () => {
    expect(parseRobots('Disallow: /orphan\r\nUser-agent: *\r\nDisallow: /a')).toEqual([
      { agents: ['*'], allow: [], disallow: ['/a'] },
    ]);
  });

  it('starts a new group when a User-agent line follows rules', () => {
    expect(parseRobots('User-agent: a\nDisallow: /1\nUser-agent: b\nDisallow: /2')).toHaveLength(2);
  });

  it('does not read past the 500 KiB limit', () => {
    const padding = `# ${'x'.repeat(600 * 1024)}\n`;
    expect(parseRobots(`User-agent: *\n${padding}Disallow: /late`)[0].disallow).toEqual([]);
  });
});

describe('selectRules', () => {
  const groups = parseRobots(
    [
      'User-agent: *',
      'Disallow: /all',
      'User-agent: WorldUniversitiesBot',
      'Disallow: /bot',
      'Crawl-delay: 3',
      'User-agent: worlduniversitiesbot',
      'Allow: /bot/ok',
    ].join('\n')
  );

  it('uses the groups naming the crawler, case-insensitively, instead of the * group', () => {
    const rules = selectRules(groups, BOT);
    expect(rules.disallow).toEqual(['/bot']);
    expect(rules.allow).toEqual(['/bot/ok']);
    expect(rules.crawlDelay).toBe(3);
  });

  it('falls back to the * group, and to no rules without any matching group', () => {
    expect(selectRules(groups, 'OtherBot/2.0').disallow).toEqual(['/all']);
    expect(selectRules(parseRobots('User-agent: x\nDisallow: /'), 'OtherBot')).toEqual({ allow: [], disallow: [] });
  });

  it('keeps the largest Crawl-delay when several groups apply', () => {
    const two = parseRobots('User-agent: bot\nCrawl-delay: 1\nDisallow: /a\nUser-agent: bot\nCrawl-delay: 4');
    expect(selectRules(two, 'bot').crawlDelay).toBe(4);
  });
});

describe('isPathAllowed', () => {
  it('lets the longest matching pattern win and Allow win a tie', () => {
    const rules = { allow: ['/docs/public'], disallow: ['/docs'] };
    expect(isPathAllowed(rules, '/docs/private')).toBe(false);
    expect(isPathAllowed(rules, '/docs/public/page')).toBe(true);
    expect(isPathAllowed({ allow: ['/a'], disallow: ['/a'] }, '/a')).toBe(true);
  });

  it('supports * wildcards and the $ end anchor', () => {
    const rules = { allow: [], disallow: ['/*.pdf$', '/tmp*/cache'] };
    expect(isPathAllowed(rules, '/files/report.pdf')).toBe(false);
    expect(isPathAllowed(rules, '/files/report.pdf?download=1')).toBe(true);
    expect(isPathAllowed(rules, '/tmp42/cache')).toBe(false);
    expect(isPathAllowed(rules, '/other')).toBe(true);
  });

  it('allows everything without rules, blocks everything with Disallow: /, and escapes regex characters', () => {
    expect(isPathAllowed({ allow: [], disallow: [] }, '/anything')).toBe(true);
    expect(isPathAllowed({ allow: [], disallow: ['/'] }, '/anything')).toBe(false);
    expect(isPathAllowed({ allow: [], disallow: ['/a.b'] }, '/axb')).toBe(true);
    expect(isPathAllowed({ allow: [], disallow: ['/q?x'] }, '/q?x=1')).toBe(false);
  });

  it('prefixes a missing leading slash', () => {
    expect(isPathAllowed({ allow: [], disallow: ['/p'] }, 'p')).toBe(false);
  });
});

describe('RobotsChecker', () => {
  const make = (responses: Record<string, { status: number; body?: string } | Error>, extra: object = {}) => {
    const fetchText = jest.fn(async (url: string) => {
      const response = responses[url];
      if (!response) throw new Error(`unexpected ${url}`);
      if (response instanceof Error) throw response;
      return { status: response.status, body: response.body ?? '' };
    });
    return { fetchText, checker: new RobotsChecker({ userAgent: BOT, fetchText, ...extra }) };
  };

  it('allows a path robots.txt does not disallow and blocks one it does', async () => {
    const { checker } = make({ 'https://a.edu/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /admin' } });
    expect(await checker.check('https://a.edu/')).toEqual({ allowed: true, crawlDelayMs: undefined });
    const blocked = await checker.check('https://a.edu/admin/users?x=1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('https://a.edu/robots.txt');
  });

  it('treats a 404 or any 4xx as no restrictions', async () => {
    for (const status of [404, 401, 403]) {
      const { checker } = make({ 'https://a.edu/robots.txt': { status } });
      expect((await checker.check('https://a.edu/anything')).allowed).toBe(true);
    }
  });

  it('treats a 5xx response and a network error as a full disallow, with a reason', async () => {
    const server = make({ 'https://a.edu/robots.txt': { status: 503 } });
    const failed = await server.checker.check('https://a.edu/');
    expect(failed).toEqual({ allowed: false, reason: 'https://a.edu/robots.txt returned HTTP 503' });
    const network = make({ 'https://a.edu/robots.txt': new Error('ETIMEDOUT') });
    expect((await network.checker.check('https://a.edu/')).reason).toContain('ETIMEDOUT');
    const thrownString = new RobotsChecker({
      userAgent: BOT,
      fetchText: async () => {
        throw 'boom';
      },
    });
    expect((await thrownString.check('https://a.edu/')).reason).toContain('boom');
  });

  it('fetches each origin once, even for concurrent checks, and keeps origins apart', async () => {
    const { checker, fetchText } = make({
      'https://a.edu/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /x' },
      'https://b.edu/robots.txt': { status: 404 },
      'http://a.edu/robots.txt': { status: 404 },
    });
    const results = await Promise.all([
      checker.check('https://a.edu/1'),
      checker.check('https://a.edu/x'),
      checker.check('https://b.edu/x'),
      checker.check('http://a.edu/x'),
    ]);
    expect(results.map(r => r.allowed)).toEqual([true, false, true, true]);
    expect(fetchText).toHaveBeenCalledTimes(3);
    expect(checker.cachedOrigins).toBe(3);
  });

  it('refetches after the cache entry expires, once even for concurrent callers', async () => {
    let now = 0;
    const { checker, fetchText } = make(
      { 'https://a.edu/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /x' } },
      { ttlMs: 1000, now: () => now }
    );
    await checker.check('https://a.edu/');
    now = 999;
    await checker.check('https://a.edu/');
    expect(fetchText).toHaveBeenCalledTimes(1);
    now = 1001;
    await Promise.all([checker.check('https://a.edu/'), checker.check('https://a.edu/')]);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it('reports the Crawl-delay in milliseconds and refuses a delay above the limit', async () => {
    const { checker } = make({ 'https://a.edu/robots.txt': { status: 200, body: 'User-agent: *\nCrawl-delay: 5' } });
    expect((await checker.check('https://a.edu/')).crawlDelayMs).toBe(5000);

    const slow = make({ 'https://a.edu/robots.txt': { status: 200, body: 'User-agent: *\nCrawl-delay: 120' } });
    const decision = await slow.checker.check('https://a.edu/');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Crawl-delay of 120s exceeds the 30s limit');
  });

  it('rejects URLs it cannot interpret without fetching anything', async () => {
    const { checker, fetchText } = make({});
    expect((await checker.check('not a url')).reason).toContain('invalid URL');
    expect((await checker.check('ftp://a.edu/file')).reason).toContain('unsupported protocol');
    expect(fetchText).not.toHaveBeenCalled();
  });
});

describe('HostThrottle', () => {
  it('spaces requests to one host and does not delay other hosts', async () => {
    let now = 1000;
    const sleeps: number[] = [];
    const throttle = new HostThrottle(
      () => now,
      async ms => {
        sleeps.push(ms);
      }
    );
    await throttle.wait('A.edu', 500); // first request starts at once
    await throttle.wait('a.edu', 500); // the host name is case-insensitive
    await throttle.wait('a.edu', 500);
    await throttle.wait('b.edu', 500);
    expect(sleeps).toEqual([500, 1000]);
    now = 5000;
    await throttle.wait('a.edu', 500);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('does not wait when the gap is zero and works with the real clock', async () => {
    const throttle = new HostThrottle();
    const started = Date.now();
    await throttle.wait('c.edu', 0);
    await throttle.wait('c.edu', 0);
    await throttle.wait('c.edu', 25);
    await throttle.wait('c.edu', 0);
    expect(Date.now() - started).toBeGreaterThanOrEqual(20);
  });
});
