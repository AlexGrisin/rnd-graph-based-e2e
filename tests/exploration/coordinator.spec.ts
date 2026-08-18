import { expect, test } from '@playwright/test';
import {
  AgentDecider,
  classifyConsequence,
  explore,
  rankActions,
  resolveEntryUrl,
  type Decision,
  type DecisionContext,
  type VisibleAction,
} from '../../src/exploration/index.js';
import { FixtureHost } from './fixture-site.js';

/**
 * Increment 2 acceptance (plan §6): against a controlled local site, the agent
 * discovers an unprescribed multi-page path, records a backtrack, skips a
 * consequential boundary without prompting, and stops with an explicit reason.
 * `explore(target, ...)` is the only contract.
 */

const BASE = 'https://shop.test/';

function run(target: string, defaults = { maxSteps: 100, maxStates: 50 }) {
  return explore({
    target,
    baseUrl: BASE,
    runId: 'test-run',
    host: new FixtureHost(),
    defaults,
  });
}

test.describe('consequence policy', () => {
  test('flags order/payment/account controls, allows benign ones', () => {
    const c = (name: string): VisibleAction => ({
      id: name,
      role: 'button',
      name,
      kind: 'click',
    });
    expect(classifyConsequence(c('Place order')).consequential).toBe(true);
    expect(classifyConsequence(c('Pay now')).consequential).toBe(true);
    expect(classifyConsequence(c('Create account')).consequential).toBe(true);
    expect(classifyConsequence(c('Add to bag')).consequential).toBe(false);
    expect(classifyConsequence(c('Checkout')).consequential).toBe(false);
  });

  test('skips send-communication and publish-content actions', () => {
    const c = (name: string): VisibleAction => ({
      id: name,
      role: 'button',
      name,
      kind: 'click',
    });
    // Communication send.
    expect(classifyConsequence(c('Send message')).reason).toBe(
      'communication send',
    );
    expect(classifyConsequence(c('Send')).consequential).toBe(true);
    // Content publish.
    expect(classifyConsequence(c('Submit review')).reason).toBe(
      'content publish',
    );
    expect(classifyConsequence(c('Write a review')).consequential).toBe(true);
    // False positives that must stay allowed.
    expect(classifyConsequence(c('Resend code')).consequential).toBe(false);
    expect(classifyConsequence(c('Postal code')).consequential).toBe(false);
    expect(classifyConsequence(c('View posts')).consequential).toBe(false);
  });
});

test.describe('action ranker', () => {
  test('prefers unvisited on-origin actions; deprioritizes off-origin', () => {
    const actions: VisibleAction[] = [
      {
        id: 'x',
        role: 'link',
        name: 'External',
        kind: 'navigate',
        href: 'https://other.test/',
      },
      {
        id: 'y',
        role: 'link',
        name: 'Products',
        kind: 'navigate',
        href: '/shop',
      },
    ];
    const ranked = rankActions(actions, {
      keywords: [],
      baseOrigin: 'https://shop.test',
      visitedUrls: new Set(),
    });
    expect(ranked[0].id).toBe('y');
    expect(ranked[1].id).toBe('x');
  });

  test('keyword bias promotes matching targets (name or path)', () => {
    const actions: VisibleAction[] = [
      {
        id: 'a',
        role: 'link',
        name: 'About',
        kind: 'navigate',
        href: '/about',
      },
      {
        id: 'b',
        role: 'button',
        name: 'Add to bag',
        kind: 'click',
        href: '/cart',
      },
    ];
    const ranked = rankActions(actions, {
      keywords: ['cart'],
      baseOrigin: 'https://shop.test',
      visitedUrls: new Set(),
    });
    expect(ranked[0].id).toBe('b'); // href '/cart' matches keyword
  });
});

test.describe('entry resolution', () => {
  test('sitemapProduct uses first product hint; others use baseUrl', () => {
    const hints = {
      robotsUrl: '',
      sitemapUrls: [],
      urls: [],
      productUrls: ['https://shop.test/p/blue-1234'],
      truncated: false,
      errors: [],
    };
    expect(resolveEntryUrl({ kind: 'sitemapProduct' }, BASE, hints)).toBe(
      'https://shop.test/p/blue-1234',
    );
    expect(resolveEntryUrl({ kind: 'homeSearch' }, BASE, hints)).toBe(BASE);
  });
});

test.describe('autonomous loop (controlled site)', () => {
  test('discovers a multi-page path, skips consequences, backtracks, stops', async () => {
    const result = await run('explore cart');

    // Unprescribed multi-page discovery: home → shop → pdp → cart at least.
    expect(result.manifest.nodeCount).toBeGreaterThanOrEqual(4);
    const urls = result.recorder.graph.nodes().map((n) => n.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://shop.test/',
        'https://shop.test/shop',
        'https://shop.test/cart',
      ]),
    );

    // Consequence boundaries (Place order / Pay now) skipped without prompting.
    expect(result.manifest.skippedCount).toBeGreaterThanOrEqual(1);
    const skipped = result.recorder.graph.edges().filter((e) => e.skipped);
    expect(skipped.some((e) => /place order|pay/i.test(e.label))).toBe(true);

    // At least one backtrack to a prior frontier state.
    expect(result.backtracks).toBeGreaterThanOrEqual(1);

    // Correlated PDP console error surfaced as a potential bug.
    expect(
      result.recorder.issues.potentialBugs().length,
    ).toBeGreaterThanOrEqual(1);

    // Explicit completion reason; frontier exhausted within budget.
    expect(['noUsefulAction', 'targetCovered', 'budgetExhausted']).toContain(
      result.completionReason,
    );
  });

  test('never navigates off-origin (scope exit is skipped, not followed)', async () => {
    const host = new FixtureHost();
    const result = await explore({
      target: 'explore products',
      baseUrl: BASE,
      runId: 'test-run',
      host,
      defaults: { maxSteps: 100, maxStates: 50 },
    });
    expect(host.opened.every((u) => u.startsWith('https://shop.test'))).toBe(
      true,
    );
    const scopeExit = result.recorder.graph
      .edges()
      .find((e) => e.skipReason === 'external scope exit');
    expect(scopeExit).toBeTruthy();
  });

  test('honors the step budget with an explicit reason', async () => {
    const result = await run('explore cart', { maxSteps: 3, maxStates: 50 });
    expect(result.completionReason).toBe('budgetExhausted');
    expect(result.steps).toBeLessThanOrEqual(3);
  });
});

test.describe('agent-driven decisions', () => {
  test('the coordinator follows the agent choice and records its rationale', async () => {
    // Agent: always take the first candidate, with a rationale.
    const decisions: string[] = [];
    const decider = new AgentDecider((ctx: DecisionContext): Decision => {
      const pick = ctx.candidates[0];
      decisions.push(pick.name);
      return {
        kind: 'act',
        actionId: pick.id,
        rationale: `agent chose ${pick.name}`,
      };
    });

    const result = await explore({
      target: 'explore anything',
      baseUrl: BASE,
      runId: 'test-run',
      host: new FixtureHost(),
      decider,
      defaults: { maxSteps: 100, maxStates: 50 },
    });

    expect(decisions.length).toBeGreaterThan(0);
    const withRationale = result.recorder.graph
      .edges()
      .filter((e) => e.rationale?.startsWith('agent chose'));
    expect(withRationale.length).toBeGreaterThan(0);
  });

  test('an agent that stops ends the run with its chosen reason', async () => {
    const decider = new AgentDecider(
      (): Decision => ({
        kind: 'stop',
        reason: 'targetCovered',
        rationale: 'seen enough',
      }),
    );
    const result = await explore({
      target: 'explore cart',
      baseUrl: BASE,
      runId: 'test-run',
      host: new FixtureHost(),
      decider,
    });
    expect(result.completionReason).toBe('targetCovered');
  });

  test('safety overrides the agent: a chosen consequential action is skipped, not executed', async () => {
    // Adversarial agent: always tries to pick "Place order" / "Pay" if offered.
    const decider = new AgentDecider((ctx: DecisionContext): Decision => {
      const danger = ctx.candidates.find((c) =>
        /place order|pay/i.test(c.name),
      );
      const pick = danger ?? ctx.candidates[0];
      return { kind: 'act', actionId: pick.id, rationale: 'agent insisted' };
    });

    const result = await explore({
      target: 'explore checkout',
      baseUrl: BASE,
      runId: 'test-run',
      host: new FixtureHost(),
      decider,
      defaults: { maxSteps: 100, maxStates: 50 },
    });

    // Every dangerous action the agent picked was recorded as a SKIP (to: null),
    // never executed as a real transition.
    const dangerEdges = result.recorder.graph
      .edges()
      .filter((e) => /place order|pay/i.test(e.label));
    expect(dangerEdges.length).toBeGreaterThan(0);
    expect(dangerEdges.every((e) => e.skipped && e.to === null)).toBe(true);
  });
});
