import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  IssueLog,
  ObservedGraph,
  SessionRecorder,
  buildAppContext,
  classifyParty,
  defaultIsProductUrl,
  deriveAppProfile,
  hashState,
  loadCoverageHints,
  registrableDomain,
  renderReport,
  resolveIntent,
  writeArtifacts,
  type FetchText,
  type Observation,
} from '../../src/exploration/index.js';

/**
 * Increment 1 acceptance (plan §6): fixture observations produce deterministic
 * hashes, graph nodes/edges, correlated signals, and a report — no browser.
 */

function obs(
  url: string,
  aria: string,
  actions: Observation['actions'] = [],
): Observation {
  return { url, aria, actions };
}

const home = obs('https://shop.test/', 'heading Home\nlink Shop\nlink Search', [
  {
    id: 'link:Shop',
    role: 'link',
    name: 'Shop',
    kind: 'navigate',
    href: '/shop',
  },
]);
const pdp = obs(
  'https://shop.test/shop/jeans-1234',
  'heading Jeans\nbutton Add to bag',
  [
    {
      id: 'button:Add to bag',
      role: 'button',
      name: 'Add to bag',
      kind: 'click',
    },
  ],
);

test.describe('hashing', () => {
  test('normalized ARIA hashes are deterministic and whitespace-insensitive', () => {
    expect(hashState('link  Shop\n\n')).toBe(hashState('link Shop'));
    expect(hashState('a')).not.toBe(hashState('b'));
  });

  test('graph deduplicates identical states into one node', () => {
    const g = new ObservedGraph();
    const a = g.observe(home, 0);
    const b = g.observe(
      obs(
        'https://shop.test/',
        '  heading Home \n\nlink  Shop\nlink   Search  ',
      ),
      1,
    );
    expect(b.id).toBe(a.id);
    expect(g.stats().nodeCount).toBe(1);
  });
});

test.describe('intent resolution', () => {
  test('maps semantic targets to entry strategies', () => {
    expect(resolveIntent('explore pdp').strategy.kind).toBe('sitemapProduct');
    expect(resolveIntent('explore cart').strategy.kind).toBe(
      'addToCartThenCart',
    );
    expect(resolveIntent('explore guest checkout').strategy.kind).toBe(
      'cartThenCheckoutGuest',
    );
    expect(resolveIntent('explore search flows').strategy.kind).toBe(
      'homeSearch',
    );
  });

  test('unknown targets fall back to homepage biased by keywords', () => {
    const r = resolveIntent('explore wishlist gifting');
    expect(r.strategy.kind).toBe('homepageBiased');
    expect(r.keywords).toEqual(['wishlist', 'gifting']);
  });
});

test.describe('app profile', () => {
  test('derives page families from homepage links + sitemap', () => {
    const root = obs('https://shop.test/en', 'heading Home', [
      {
        id: 'a',
        role: 'link',
        name: 'Men',
        kind: 'navigate',
        href: '/shop/men',
      },
      {
        id: 'b',
        role: 'link',
        name: 'Jeans',
        kind: 'navigate',
        href: '/shop/men/jeans',
      },
      {
        id: 'c',
        role: 'link',
        name: 'Help',
        kind: 'navigate',
        href: '/customer-service',
      },
      {
        id: 'd',
        role: 'link',
        name: 'IG',
        kind: 'navigate',
        href: 'https://instagram.com/x',
      },
    ]);
    const profile = deriveAppProfile('https://shop.test/en', root);
    expect(profile).toContain('Site origin: https://shop.test');
    expect(profile).toContain('/shop/men');
    expect(profile).toContain('/customer-service');
    expect(profile).not.toContain('instagram'); // off-origin excluded
  });

  test('buildAppContext merges authored notes ahead of derived structure', () => {
    const merged = buildAppContext(
      'AUTHORED RULES',
      '# Auto-derived structure',
    );
    expect(merged.indexOf('AUTHORED RULES')).toBeLessThan(
      merged.indexOf('Auto-derived'),
    );
    expect(buildAppContext(undefined, 'D')).toBe('D');
  });
});

test.describe('signal party classification', () => {
  const base = 'https://www.g-star.com/en_nl';

  test('same registrable domain (incl. subdomains) is first-party', () => {
    expect(classifyParty('https://www.g-star.com/x', base)).toBe('first');
    expect(classifyParty('https://al.g-star.com/1/indexes', base)).toBe(
      'first',
    );
  });

  test('other domains are third-party; missing/unparseable → third', () => {
    expect(classifyParty('https://eu-data.kameleoon.io/visit', base)).toBe(
      'third',
    );
    expect(classifyParty(undefined, base)).toBe('third');
    expect(classifyParty('not-a-url', base)).toBe('third');
  });

  test('registrableDomain handles multi-label suffixes', () => {
    expect(registrableDomain('www.beaverbrooks.co.uk')).toBe(
      'beaverbrooks.co.uk',
    );
    expect(registrableDomain('shop.example.com')).toBe('example.com');
  });

  test('report separates site issues from third-party noise', () => {
    const rec = new SessionRecorder({
      target: 'explore pdp',
      baseUrl: base,
      runId: 'test-run',
    });
    const root = rec.start(
      obs(base, 'heading Home', [
        {
          id: 'a',
          role: 'link',
          name: 'Shop',
          kind: 'navigate',
          href: '/shop',
        },
      ]),
    );
    rec.recordTransition(
      root.id,
      { actionId: 'a', label: 'Shop', kind: 'navigate' },
      {
        outcome: {
          ...obs(`${base}/shop`, 'heading Shop'),
          signals: [
            { kind: 'pageError', message: 'site broke', party: 'first' },
            { kind: 'httpError', message: '403 kameleoon', party: 'third' },
          ],
        },
      },
    );

    const md = renderReport({
      manifest: rec.buildManifest(),
      nodes: rec.graph.nodes(),
      edges: rec.graph.edges(),
      issues: rec.issues.allIssues(),
      signalEvents: rec.issues.allEvents(),
    });
    expect(md).toContain('Site (first-party): **1** · third-party: **1**');
    expect(md).toContain('### Third-party (external vendors)');
  });
});

test.describe('issue correlation', () => {
  test('bug-worthy signals promote on first sight; repeats increment count', () => {
    const log = new IssueLog();
    const at = { fromNode: 'n1', toNode: 'n2', actionId: 'a1', step: 1 };
    const first = log.record({ kind: 'consoleError', message: 'boom' }, at);
    expect(first.potentialBug).toBe(true);
    const second = log.record({ kind: 'consoleError', message: 'boom' }, at);
    expect(second.count).toBe(2);
    expect(log.allIssues()).toHaveLength(1);
    expect(log.allEvents()).toHaveLength(2);
  });

  test('same message on different transitions collapses to one issue', () => {
    const log = new IssueLog();
    const sig = { kind: 'httpError' as const, message: '503 /hub' };
    log.record(sig, { fromNode: 'n1', toNode: 'n2', step: 1 });
    log.record(sig, { fromNode: 'n2', toNode: 'n3', step: 2 });
    log.record(sig, { fromNode: 'n2', toNode: 'n3', step: 3 }); // same transition

    const issues = log.allIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].count).toBe(3); // total occurrences
    expect(issues[0].transitions).toBe(2); // distinct transitions
    expect(log.allEvents()).toHaveLength(3); // raw stream keeps every event
  });

  test('a visible error (errorShown) is a potential bug on first sight', () => {
    const log = new IssueLog();
    const issue = log.record(
      { kind: 'errorShown', message: 'Something went wrong', party: 'first' },
      { fromNode: 'pdp', toNode: 'pdp', actionId: 'add-to-bag', step: 1 },
    );
    expect(issue.potentialBug).toBe(true);
    expect(log.potentialBugs()).toHaveLength(1);
  });

  test('field validation is never a potential bug, even reproduced', () => {
    const log = new IssueLog();
    const sig = {
      kind: 'validation' as const,
      message: 'invalid field: email — Please enter your E-mail',
      party: 'first' as const,
    };
    log.record(sig, { fromNode: 'checkout', toNode: 'checkout', step: 1 });
    const again = log.record(sig, {
      fromNode: 'checkout',
      toNode: 'checkout',
      step: 2,
    });
    expect(again.count).toBe(2); // reproduced...
    expect(again.potentialBug).toBe(false); // ...but still not a defect
    expect(log.potentialBugs()).toHaveLength(0);
  });

  test('non-bug signals promote only after reproducing', () => {
    const log = new IssueLog();
    const at = { fromNode: 'n1', step: 1 };
    expect(
      log.record({ kind: 'noChange', message: 'stuck' }, at).potentialBug,
    ).toBe(false);
    expect(
      log.record({ kind: 'noChange', message: 'stuck' }, at).potentialBug,
    ).toBe(true);
  });
});

test.describe('recorder', () => {
  test('records a multi-state graph with correlated signals', () => {
    const rec = new SessionRecorder({
      target: 'explore pdp',
      baseUrl: 'https://shop.test/',
      runId: 'test-run',
    });
    const root = rec.start(home);
    const { edge, toNode } = rec.recordTransition(
      root.id,
      {
        actionId: 'link:Shop',
        label: 'Shop',
        kind: 'navigate',
      },
      {
        outcome: {
          ...pdp,
          signals: [
            {
              kind: 'httpError',
              message: '500 on /api/price',
              detail: { status: 500 },
            },
          ],
        },
      },
    );

    expect(toNode?.id).toBe(hashState(pdp.aria));
    expect(edge.from).toBe(root.id);
    expect(edge.signalKinds).toContain('httpError');

    const manifest = rec.buildManifest();
    expect(manifest.nodeCount).toBe(2);
    expect(manifest.edgeCount).toBe(1);
    expect(rec.issues.potentialBugs()).toHaveLength(1);
  });

  test('skipped consequential action records a boundary edge, no new node', () => {
    const rec = new SessionRecorder({
      target: 'explore guest checkout',
      baseUrl: 'https://shop.test/',
      runId: 'test-run',
    });
    const root = rec.start(pdp);
    const { edge } = rec.recordTransition(
      root.id,
      {
        actionId: 'button:Place order',
        label: 'Place order',
        kind: 'submit',
        skipped: true,
        skipReason: 'order placement',
      },
      {},
    );

    expect(edge.skipped).toBe(true);
    expect(edge.to).toBeNull();
    expect(rec.graph.stats()).toMatchObject({ nodeCount: 1, skippedCount: 1 });
  });
});

test.describe('report', () => {
  test('renders coverage, issues, and skipped boundaries', () => {
    const rec = new SessionRecorder({
      target: 'explore pdp',
      baseUrl: 'https://shop.test/',
      runId: 'test-run',
    });
    const root = rec.start(home);
    rec.recordTransition(
      root.id,
      { actionId: 'link:Shop', label: 'Shop', kind: 'navigate' },
      {
        outcome: {
          ...pdp,
          signals: [{ kind: 'pageError', message: 'TypeError x' }],
        },
      },
    );
    rec.complete('targetCovered');

    const md = renderReport({
      manifest: rec.buildManifest(),
      nodes: rec.graph.nodes(),
      edges: rec.graph.edges(),
      issues: rec.issues.allIssues(),
      signalEvents: rec.issues.allEvents(),
    });

    expect(md).toContain('# Exploration report — explore pdp');
    expect(md).toContain('States discovered: **2**');
    expect(md).toContain('pageError');
    expect(md).toContain('targetCovered');
  });

  test('writeArtifacts emits the full artifact set', async () => {
    const rec = new SessionRecorder({
      target: 'explore pdp',
      baseUrl: 'https://shop.test/',
      runId: 'test-run',
    });
    rec.start(home);
    rec.complete('noUsefulAction');

    const dir = await mkdtemp(join(tmpdir(), 'expl-'));
    try {
      const written = await writeArtifacts(dir, {
        manifest: rec.buildManifest(),
        nodes: rec.graph.nodes(),
        edges: rec.graph.edges(),
        issues: rec.issues.allIssues(),
        signalEvents: rec.issues.allEvents(),
      });
      expect(written.map((p) => p.split('/').pop())).toEqual(
        expect.arrayContaining([
          'manifest.json',
          'graph.json',
          'issues.json',
          'errors.json',
          'report.md',
        ]),
      );
      const manifest = JSON.parse(
        await readFile(join(dir, 'manifest.json'), 'utf8'),
      );
      expect(manifest.target).toBe('explore pdp');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test.describe('sitemap hints (injected fetch, offline)', () => {
  test('parses robots + sitemap and classifies product URLs', async () => {
    const fixtures: Record<string, string> = {
      'https://shop.test/robots.txt':
        'User-agent: *\nSitemap: https://shop.test/sitemap.xml',
      'https://shop.test/sitemap.xml': `
        <urlset>
          <url><loc>https://shop.test/shop/jeans-1234</loc></url>
          <url><loc>https://shop.test/about</loc></url>
        </urlset>`,
    };
    const fetchText: FetchText = async (url) => {
      const body = fixtures[url];
      if (body === undefined) throw new Error(`404 ${url}`);
      return body;
    };

    const hints = await loadCoverageHints('https://shop.test/', { fetchText });
    expect(hints.urls).toContain('https://shop.test/shop/jeans-1234');
    expect(hints.productUrls).toEqual(['https://shop.test/shop/jeans-1234']);
    expect(hints.errors).toHaveLength(0);
  });

  test('product-URL heuristic matches /p-suffix and id-segment PDPs', () => {
    // Beaverbrooks PDP shape: /<id>/<name>/p
    expect(
      defaultIsProductUrl(
        'https://www.beaverbrooks.co.uk/0149753/18ct-Gold-Ring/p',
      ),
    ).toBe(true);
    // g-star shape: /shop/.../<code>
    expect(
      defaultIsProductUrl('https://www.g-star.com/en_nl/shop/men/jeans-1234'),
    ).toBe(true);
    // Category / listing pages are not products.
    expect(
      defaultIsProductUrl(
        'https://www.beaverbrooks.co.uk/watches/gold-watches/mens-watches',
      ),
    ).toBe(false);
  });

  test('missing robots/sitemap degrades without throwing', async () => {
    const fetchText: FetchText = async (url) => {
      throw new Error(`unreachable ${url}`);
    };
    const hints = await loadCoverageHints('https://shop.test/', { fetchText });
    expect(hints.urls).toHaveLength(0);
    expect(hints.errors.length).toBeGreaterThan(0);
  });
});
