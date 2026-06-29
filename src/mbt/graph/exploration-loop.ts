import { createActor } from 'xstate';
import type { AnyActorLogic, EventObject } from 'xstate';
import {
  getAdjacencyMap,
  getPathsFromEvents,
  getShortestPaths,
} from 'xstate/graph';
import type { StatePath } from 'xstate/graph';
import { CoverageTracker } from './coverage-tracker.js';
import type {
  CoverageGap,
  CoverageReport,
  CoverageTarget,
  Weights,
} from './coverage-tracker.js';
import { describePath, getSnapshotStateValue } from './path-label.js';
import { testPath } from './test-model-factory.js';
import type { ActionMap, MbtContext, StateVerifier } from '../types.js';

export type { CoverageReport, CoverageTarget, Weights };

export type PersonaConfig = {
  name: string;
  credentials?: { email: string; password: string };
  viewport?: { width: number; height: number };
  /** When set, only paths whose steps all belong to this event set are eligible. */
  allowedEvents?: string[];
};

export type ExplorationBudget = {
  /** Maximum number of path executions before stopping. */
  maxIterations: number;
  targetEdgePct?: number;
  targetNodePct?: number;
};

export type ExplorationOptions = {
  actions: ActionMap;
  verifyState?: StateVerifier;
  personas?: PersonaConfig[];
  budget: ExplorationBudget;
  weights?: Weights;
};

function getInitialStateValue(machine: AnyActorLogic): string {
  return getSnapshotStateValue(createActor(machine).getSnapshot());
}

/**
 * Builds a path that exercises a specific gap edge by:
 * 1. Finding the shortest path to the gap's sourceState
 * 2. Appending the gap event to that event sequence
 * 3. Resolving via getPathsFromEvents (handles back-edges / cycles)
 */
function buildPathForGap(
  machine: AnyActorLogic,
  gap: CoverageGap,
): StatePath<unknown, EventObject> | null {
  const pathsToSource = getShortestPaths(
    machine as Parameters<typeof getShortestPaths>[0],
    {
      toState: (s: unknown) => getSnapshotStateValue(s) === gap.sourceState,
    },
  );

  if (pathsToSource.length === 0) return null;

  const events: EventObject[] = [
    ...pathsToSource[0].steps.map((step) => step.event as EventObject),
    { type: gap.event },
  ];

  const paths = getPathsFromEvents(
    machine as Parameters<typeof getPathsFromEvents>[0],
    events,
  );
  return paths.length > 0
    ? (paths[0] as StatePath<unknown, EventObject>)
    : null;
}

function isPersonaCompatible(
  path: StatePath<unknown, EventObject>,
  persona: PersonaConfig,
): boolean {
  if (!persona.allowedEvents) return true;
  return path.steps.every(
    (step) =>
      (step.event as EventObject).type.startsWith('xstate.') ||
      persona.allowedEvents!.includes((step.event as EventObject).type),
  );
}

/**
 * Runs a coverage-driven exploration loop against a machine.
 *
 * Each iteration selects the first uncovered edge, builds the shortest path
 * that exercises it, executes that path, and updates the coverage tracker.
 * Repeats until the budget is exhausted or all edges are covered.
 *
 * When multiple personas are provided, each iteration cycles through them,
 * skipping paths incompatible with a persona's allowedEvents.
 */
export async function runCoverageLoop(
  machine: AnyActorLogic,
  ctx: MbtContext,
  options: ExplorationOptions,
): Promise<CoverageReport> {
  const { actions, verifyState, budget, personas, weights } = options;

  const adjacency = getAdjacencyMap(
    machine as Parameters<typeof getAdjacencyMap>[0],
    {},
  );
  const tracker = new CoverageTracker(adjacency);
  const initialState = getInitialStateValue(machine);
  const coverageTarget: CoverageTarget = {
    edgeMinPct: budget.targetEdgePct ?? 100,
    nodeMinPct: budget.targetNodePct ?? 100,
  };

  const effectivePersonas: PersonaConfig[] = personas ?? [{ name: 'default' }];

  for (let iteration = 0; iteration < budget.maxIterations; iteration++) {
    if (tracker.isComplete(coverageTarget, weights)) break;

    let progressed = false;

    for (const persona of effectivePersonas) {
      if (tracker.isComplete(coverageTarget, weights)) break;

      const gaps = tracker.gaps(weights);
      if (gaps.length === 0) break;

      for (const gap of gaps) {
        const path = buildPathForGap(machine, gap);
        if (!path) continue;
        if (!isPersonaCompatible(path, persona)) continue;

        const { edgesPct } = tracker.coverage(weights);
        const edgeKey = `${gap.sourceState}:${gap.event}`;
        const minVisits = weights?.edges?.[edgeKey] ?? 1;
        const currentVisits = tracker.edgeVisitCount(gap.sourceState, gap.event);
        ctx.log(
          `[iteration ${iteration + 1}] persona="${persona.name}" gap="${edgeKey}" visits=${currentVisits}/${minVisits} path="${describePath(path)}" coverage=${edgesPct}%`,
        );
        await testPath(path, ctx, { actions, verifyState });
        tracker.record(path, initialState);
        progressed = true;
        break; // one gap covered per persona per iteration
      }
    }

    if (!progressed) break; // no persona could make progress — stop early
  }

  return tracker.coverage();
}
