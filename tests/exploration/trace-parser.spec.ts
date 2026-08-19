import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { renderReport } from '../../src/exploration/index.js';
import {
  extractTrace,
  normalizeHtml,
  parseTraceTrace,
  traceModelToArtifacts,
  type TraceModel,
} from '../support/exploration/trace-parser.js';

/**
 * Browser-free tests for the post-hoc trace parser (Increment 2).
 *
 * Layer B (`traceModelToArtifacts`) is a pure transform, exercised here against a
 * hand-authored `TraceModel` — deterministic, no binary fixture. Layer A
 * (`parseTraceTrace`) is checked against a raw `trace.trace` snippet.
 */

const BASE = 'https://site.test';

/** A tiny but representative session: home (console error) → PDP → Pay (skipped). */
const MODEL: TraceModel = {
  actions: [
    {
      seq: 1,
      callId: 'c1',
      method: 'goto',
      klass: 'Frame',
      params: { url: `${BASE}/home` },
    },
    {
      seq: 5,
      callId: 'c2',
      method: 'click',
      klass: 'Frame',
      params: { selector: 'internal:role=link[name="Go to PDP"]' },
    },
    {
      seq: 9,
      callId: 'c3',
      method: 'click',
      klass: 'Frame',
      params: { selector: 'internal:role=button[name="Pay now"]' },
    },
  ],
  snapshots: [
    {
      seq: 2,
      frameUrl: `${BASE}/home`,
      html: '<body><h1>Home</h1><a>Go to PDP</a></body>',
    },
    {
      seq: 6,
      frameUrl: `${BASE}/pdp`,
      html: '<body><h1>PDP</h1><button>Add to bag</button><button>Pay now</button></body>',
    },
  ],
  consoles: [
    {
      seq: 3,
      messageType: 'error',
      text: 'boom happened',
      url: `${BASE}/app.js`,
    },
    {
      seq: 7,
      messageType: 'error',
      text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
      url: `${BASE}/api/x`,
    },
    // A warning is NOT a signal — must be ignored.
    {
      seq: 8,
      messageType: 'warning',
      text: 'deprecation notice',
      url: `${BASE}/app.js`,
    },
  ],
  pageErrors: [],
};

test('traceModelToArtifacts builds a graph with a skipped consequence boundary', () => {
  const a = traceModelToArtifacts(MODEL, {
    target: 'pdp',
    baseUrl: BASE,
    runId: 'test-run',
  });

  // Two states (home, pdp), two transitions (nav + skipped Pay).
  expect(a.manifest.nodeCount).toBe(2);
  expect(a.manifest.edgeCount).toBe(2);
  expect(a.manifest.skippedCount).toBe(1);
  expect(a.manifest.completionReason).toBe('targetCovered');

  const home = a.nodes.find((n) => n.url === `${BASE}/home`);
  const pdp = a.nodes.find((n) => n.url === `${BASE}/pdp`);
  expect(home).toBeDefined();
  expect(pdp).toBeDefined();
  expect(pdp!.actionCount).toBe(2); // Add to bag + Pay now

  // The navigation edge lands on the PDP node.
  const navEdge = a.edges.find((e) => e.label.includes('Go to PDP'));
  expect(navEdge?.from).toBe(home!.id);
  expect(navEdge?.to).toBe(pdp!.id);

  // "Pay now" is recorded as a skipped payment boundary (to: null).
  const payEdge = a.edges.find((e) => e.label.includes('Pay now'));
  expect(payEdge?.skipped).toBe(true);
  expect(payEdge?.skipReason).toBe('payment');
  expect(payEdge?.to).toBeNull();
});

test('completionReason is budgetExhausted when the run reaches the step/state cap', () => {
  // 21 navigations to distinct pages → trips both the 20-step and 15-state caps.
  const actions: TraceModel['actions'] = [];
  const snapshots: TraceModel['snapshots'] = [];
  let seq = 0;
  for (let i = 0; i < 21; i += 1) {
    actions.push({
      seq: (seq += 1),
      callId: `g${i}`,
      method: 'goto',
      klass: 'Frame',
      params: { url: `${BASE}/p${i}` },
    });
    snapshots.push({
      seq: (seq += 1),
      frameUrl: `${BASE}/p${i}`,
      html: `<body><h1>P${i}</h1></body>`,
    });
  }

  const a = traceModelToArtifacts(
    { actions, snapshots, consoles: [], pageErrors: [] },
    { target: 'pdp', baseUrl: BASE, runId: 'cap-run' },
  );
  expect(a.manifest.completionReason).toBe('budgetExhausted');
});

test('signals are derived from console (network 4xx mirrors there) and party-classified', () => {
  const a = traceModelToArtifacts(MODEL, {
    target: 'pdp',
    baseUrl: BASE,
    runId: 'test-run',
  });

  const kinds = a.signalEvents.map((e) => e.kind);
  expect(kinds).toContain('consoleError'); // "boom happened"
  expect(kinds).toContain('httpError'); // 404 mirrored in console
  expect(kinds).not.toContain('validation');

  const http = a.signalEvents.find((e) => e.kind === 'httpError');
  expect(http?.message).toContain('404');
  expect(http?.party).toBe('first'); // same registrable domain as BASE

  // The warning was ignored.
  expect(a.signalEvents.some((e) => /deprecation/.test(e.message))).toBe(false);
});

test('renderReport surfaces the skipped boundary', () => {
  const a = traceModelToArtifacts(MODEL, {
    target: 'pdp',
    baseUrl: BASE,
    runId: 'test-run',
  });
  const md = renderReport(a);
  expect(md).toContain('Pay now');
  expect(md).toContain('payment');
});

test('parseTraceTrace extracts ordered actions, errors, snapshots, console', () => {
  const raw = [
    JSON.stringify({
      type: 'before',
      callId: 'x1',
      class: 'Frame',
      method: 'goto',
      params: { url: `${BASE}/a` },
    }),
    JSON.stringify({
      type: 'frame-snapshot',
      snapshot: {
        isMainFrame: true,
        frameUrl: `${BASE}/a`,
        html: '<body>A</body>',
      },
    }),
    JSON.stringify({
      type: 'frame-snapshot',
      snapshot: {
        isMainFrame: false,
        frameUrl: 'about:blank',
        html: '<i>iframe</i>',
      },
    }),
    JSON.stringify({ type: 'after', callId: 'x1', error: null }),
    JSON.stringify({
      type: 'before',
      callId: 'x2',
      class: 'Frame',
      method: 'click',
      params: { selector: '#bag' },
    }),
    JSON.stringify({
      type: 'console',
      messageType: 'error',
      text: 'oops',
      location: { url: `${BASE}/x.js` },
    }),
    JSON.stringify({
      type: 'after',
      callId: 'x2',
      error: { message: 'Timeout 30000ms exceeded.' },
    }),
    '', // blank line tolerated
    'not json', // garbage tolerated
  ].join('\n');

  const model = parseTraceTrace(raw);
  expect(model.actions).toHaveLength(2);
  expect(model.actions[1].method).toBe('click');
  expect(model.actions[1].error).toContain('Timeout'); // after-error merged by callId
  expect(model.snapshots).toHaveLength(1); // sub-frame filtered out
  expect(model.snapshots[0].frameUrl).toBe(`${BASE}/a`);
  expect(model.consoles).toHaveLength(1);
  expect(model.consoles[0].url).toBe(`${BASE}/x.js`);
});

test('frame-snapshot DOM arrays are serialized so actions are counted (not 0)', () => {
  // Playwright stores the snapshot DOM as a nested array, NOT an HTML string.
  const raw = [
    JSON.stringify({
      type: 'before',
      callId: 's1',
      class: 'Frame',
      method: 'goto',
      params: { url: `${BASE}/login` },
    }),
    JSON.stringify({
      type: 'frame-snapshot',
      snapshot: {
        isMainFrame: true,
        frameUrl: `${BASE}/login`,
        html: [
          'HTML',
          { lang: 'en' },
          ['HEAD', {}, ['TITLE', {}, 'Login']],
          [
            'BODY',
            {},
            ['H1', {}, 'Sign in'],
            ['INPUT', { type: 'email', name: 'email' }],
            ['INPUT', { type: 'password', name: 'password' }],
            ['INPUT', { type: 'hidden', name: 'csrf', value: 'abc123' }],
            ['BUTTON', {}, 'Sign in'],
            ['A', { href: '/register' }, 'Create account'],
          ],
        ],
      },
    }),
    JSON.stringify({ type: 'after', callId: 's1', error: null }),
  ].join('\n');

  const model = parseTraceTrace(raw);
  expect(model.snapshots).toHaveLength(1);
  expect(model.snapshots[0].html).toContain('<button>Sign in</button>');

  const a = traceModelToArtifacts(model, {
    target: 'sign in',
    baseUrl: BASE,
    runId: 'dom-run',
  });
  const login = a.nodes.find((n) => n.url === `${BASE}/login`);
  expect(login).toBeDefined();
  // 2 visible inputs + button + link = 4; the hidden CSRF input does NOT count.
  expect(login!.actionCount).toBe(4);
});

test('extractTrace reads a raw uncompressed .trace directly (no zip / unzip)', async () => {
  const raw = [
    JSON.stringify({
      type: 'before',
      callId: 't1',
      class: 'Frame',
      method: 'goto',
      params: { url: `${BASE}/home` },
    }),
    JSON.stringify({
      type: 'frame-snapshot',
      snapshot: {
        isMainFrame: true,
        frameUrl: `${BASE}/home`,
        html: '<body><h1>Home</h1></body>',
      },
    }),
  ].join('\n');

  const dir = await mkdtemp(join(tmpdir(), 'raw-trace-'));
  try {
    const path = join(dir, 'trace-123.trace');
    await writeFile(path, raw, 'utf8');
    const model = await extractTrace(path);
    expect(model.actions).toHaveLength(1);
    expect(model.actions[0].method).toBe('goto');
    expect(model.snapshots[0].frameUrl).toBe(`${BASE}/home`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('normalizeHtml strips head/scripts/whitespace for stable identity', () => {
  const a = normalizeHtml(
    '<head><title>x</title></head><body>  <h1>Hi</h1>\n<script>1</script></body>',
  );
  const b = normalizeHtml(
    '<head><title>DIFFERENT</title></head><body><h1>Hi</h1><script>totally other</script></body>',
  );
  expect(a).toBe(b); // head + script content excluded → same identity
  expect(a).toContain('Hi');
  expect(a).not.toContain('script');
});
