import type { EventObject } from 'xstate';
import type { AdjacencyMap, StatePath } from 'xstate/graph';
import { getSnapshotStateValue } from './path-label.js';

type TransitionKey = string; // "${sourceState}:${eventType}"

export type CoverageGap = {
  sourceState: string;
  event: string;
  targetState: string;
};

export type CoverageReport = {
  totalStates: number;
  visitedStates: number;
  totalEdges: number;
  visitedEdges: number;
  statesPct: number;
  edgesPct: number;
};

export type CoverageTarget = {
  nodeMinPct?: number;
  edgeMinPct?: number;
};

export type Weights = {
  /**
   * Per-edge minimum visit count AND sort priority.
   * Key format: "sourceState:eventType" (e.g. "login:SUBMIT").
   * Higher value → edge is addressed before lower-weight edges AND must be
   * traversed that many times before it is no longer a gap.
   * Default: 1.
   */
  edges?: Record<string, number>;
  /**
   * Priority boost for gaps whose targetState matches.
   * Does not affect minimum visit count — only sort order.
   * Higher value → gaps leading to this state are addressed sooner.
   */
  states?: Record<string, number>;
};

export class CoverageTracker {
  private readonly stateVisits = new Map<string, number>();
  private readonly edgeVisits = new Map<TransitionKey, number>();
  private readonly knownEdges: CoverageGap[];
  private readonly knownStates: Set<string>;

  constructor(adjacency: AdjacencyMap<unknown, EventObject>) {
    const states = new Set<string>();
    const edges: CoverageGap[] = [];
    const edgeSeen = new Set<TransitionKey>();

    for (const node of Object.values(adjacency)) {
      const src = getSnapshotStateValue(node.state);
      states.add(src);
      for (const { event, state: targetSnapshot } of Object.values(
        node.transitions,
      )) {
        if (event.type.startsWith('xstate.')) continue;
        const key: TransitionKey = `${src}:${event.type}`;
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key);
          edges.push({
            sourceState: src,
            event: event.type,
            targetState: getSnapshotStateValue(targetSnapshot),
          });
        }
      }
    }

    this.knownStates = states;
    this.knownEdges = edges;
  }

  record(path: StatePath<unknown, EventObject>, initialStateValue: string): void {
    if (path.steps.length === 0) {
      this.stateVisits.set(
        initialStateValue,
        (this.stateVisits.get(initialStateValue) ?? 0) + 1,
      );
      return;
    }

    let prevState = initialStateValue;
    for (const step of path.steps) {
      if (!step.event.type.startsWith('xstate.')) {
        const key: TransitionKey = `${prevState}:${step.event.type}`;
        this.edgeVisits.set(key, (this.edgeVisits.get(key) ?? 0) + 1);
      }
      prevState = getSnapshotStateValue(step.state);
      this.stateVisits.set(prevState, (this.stateVisits.get(prevState) ?? 0) + 1);
    }
  }

  edgeVisitCount(sourceState: string, event: string): number {
    return this.edgeVisits.get(`${sourceState}:${event}`) ?? 0;
  }

  gaps(weights?: Weights): CoverageGap[] {
    const edgeW = weights?.edges ?? {};
    const stateW = weights?.states ?? {};

    return this.knownEdges
      .filter(({ sourceState, event }) => {
        const minVisits = edgeW[`${sourceState}:${event}`] ?? 1;
        return (this.edgeVisits.get(`${sourceState}:${event}`) ?? 0) < minVisits;
      })
      .sort((a, b) => {
        const scoreA =
          (edgeW[`${a.sourceState}:${a.event}`] ?? 1) +
          (stateW[a.targetState] ?? 0);
        const scoreB =
          (edgeW[`${b.sourceState}:${b.event}`] ?? 1) +
          (stateW[b.targetState] ?? 0);
        return scoreB - scoreA; // higher score first
      });
  }

  /**
   * Returns coverage metrics. When weights are provided, visitedEdges counts
   * only edges that have met their weighted minimum visit threshold.
   */
  coverage(weights?: Weights): CoverageReport {
    const edgeW = weights?.edges ?? {};
    const totalStates = this.knownStates.size;
    const visitedStates = this.stateVisits.size;
    const totalEdges = this.knownEdges.length;
    const visitedEdges = this.knownEdges.filter(({ sourceState, event }) => {
      const key = `${sourceState}:${event}`;
      const minVisits = edgeW[key] ?? 1;
      return (this.edgeVisits.get(key) ?? 0) >= minVisits;
    }).length;

    return {
      totalStates,
      visitedStates,
      totalEdges,
      visitedEdges,
      statesPct:
        totalStates === 0
          ? 100
          : Math.round((visitedStates / totalStates) * 100),
      edgesPct:
        totalEdges === 0
          ? 100
          : Math.round((visitedEdges / totalEdges) * 100),
    };
  }

  isComplete(target: CoverageTarget = {}, weights?: Weights): boolean {
    const { nodeMinPct = 100 } = target;
    const r = this.coverage(weights);
    if (r.statesPct < nodeMinPct) return false;
    // all edges must have met their weighted minimum visit count
    const edgeW = weights?.edges ?? {};
    return this.knownEdges.every(({ sourceState, event }) => {
      const key = `${sourceState}:${event}`;
      return (this.edgeVisits.get(key) ?? 0) >= (edgeW[key] ?? 1);
    });
  }
}
