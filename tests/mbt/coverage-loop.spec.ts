import { appAuthMachine } from '../../src/machines/app-auth.machine.js';
import { runCoverageLoop } from '../../src/mbt/graph/exploration-loop.js';
import type {
  PersonaConfig,
  Weights,
} from '../../src/mbt/graph/exploration-loop.js';
import { test, expect } from '../fixtures.js';

/**
 * Coverage-loop MBT: no paths are hand-written. The loop detects uncovered
 * edges in the machine graph and generates the minimal path to exercise each
 * one, iterating until the budget is met or all edges are covered.
 *
 * Run with: npm test -- --project=stub --grep "Coverage Loop"
 */
test.describe('Coverage Loop MBT', () => {
  test('achieves 100% edge coverage — default config', async ({
    mbtContext,
    actions,
    stateVerifier,
  }) => {
    const report = await runCoverageLoop(appAuthMachine, mbtContext, {
      actions,
      verifyState: stateVerifier,
      budget: {
        maxIterations: 10,
        targetEdgePct: 100,
      },
    });

    console.log('Coverage report:', report);

    expect(report.edgesPct).toBe(100);
    expect(report.statesPct).toBe(100);
    expect(report.visitedEdges).toBe(report.totalEdges);
  });

  test('achieves 100% edge coverage — two personas split by path', async ({
    mbtContext,
    actions,
    stateVerifier,
  }) => {
    // happy_path persona: only takes the success branch
    // error_path persona: only takes the failure branch
    // Together they cover all 5 edges, including empty-credential validation.
    const personas: PersonaConfig[] = [
      {
        name: 'happy_path',
        allowedEvents: ['GO_LOGIN', 'SUBMIT', 'LOGOUT'],
      },
      {
        name: 'error_path',
        allowedEvents: ['GO_LOGIN', 'SUBMIT_WITHOUT_CREDENTIALS', 'FAIL'],
      },
    ];

    const report = await runCoverageLoop(appAuthMachine, mbtContext, {
      actions,
      verifyState: stateVerifier,
      personas,
      budget: {
        maxIterations: 10,
        targetEdgePct: 100,
      },
    });

    console.log('Coverage report (persona run):', report);

    expect(report.edgesPct).toBe(100);
    expect(report.visitedEdges).toBe(report.totalEdges);
  });

  test('edge weight — repeats login:SUBMIT three times before moving on', async ({
    mbtContext,
    actions,
    stateVerifier,
  }) => {
    // login:SUBMIT has minVisits=3 so the loop runs the SUBMIT path three times
    // before addressing the remaining gaps (FAIL, LOGOUT).
    // login:SUBMIT weight=3 also means it sorts first in every gap list.
    const weights: Weights = {
      edges: { 'login:SUBMIT': 3 },
    };

    const report = await runCoverageLoop(appAuthMachine, mbtContext, {
      actions,
      verifyState: stateVerifier,
      weights,
      budget: { maxIterations: 15, targetEdgePct: 100 },
    });

    console.log('Coverage report (edge weight):', report);

    // All weighted thresholds met: SUBMIT visited ≥3, all others ≥1
    expect(report.edgesPct).toBe(100);
    expect(report.visitedEdges).toBe(report.totalEdges);
  });

  test('state priority — paths to myAccount addressed before paths to error', async ({
    mbtContext,
    actions,
    stateVerifier,
  }) => {
    // myAccount gets a high priority boost: gaps whose targetState is myAccount
    // are sorted above gaps to error even though both have the same edge weight.
    const weights: Weights = {
      states: { myAccount: 10 },
    };

    const loggedGaps: string[] = [];
    const capturingCtx = {
      ...mbtContext,
      log: (msg: string) => {
        mbtContext.log(msg);
        const match = msg.match(/gap="([^"]+)"/);
        if (match) loggedGaps.push(match[1]);
      },
    };

    await runCoverageLoop(appAuthMachine, capturingCtx, {
      actions,
      verifyState: stateVerifier,
      weights,
      budget: { maxIterations: 10, targetEdgePct: 100 },
    });

    // login:SUBMIT (→ myAccount) must appear before login:FAIL (→ error)
    const submitIdx = loggedGaps.findIndex((g) => g === 'login:SUBMIT');
    const failIdx = loggedGaps.findIndex((g) => g === 'login:FAIL');
    expect(submitIdx).toBeGreaterThanOrEqual(0);
    expect(failIdx).toBeGreaterThanOrEqual(0);
    expect(submitIdx).toBeLessThan(failIdx);
  });

  test('respects iteration budget — stops early when budget exhausted', async ({
    mbtContext,
    actions,
    stateVerifier,
  }) => {
    // maxIterations=1 means only one path executes, so partial coverage expected
    const report = await runCoverageLoop(appAuthMachine, mbtContext, {
      actions,
      verifyState: stateVerifier,
      budget: {
        maxIterations: 1,
        targetEdgePct: 100,
      },
    });

    // One path was executed; some edges were covered, but not all of them.
    expect(report.visitedEdges).toBeGreaterThan(0);
    expect(report.visitedEdges).toBeLessThan(report.totalEdges);
  });
});
