import {
  getShortestPaths,
  getAdjacencyMap,
  getSimplePaths,
  adjacencyMapToArray,
} from 'xstate/graph';
import type { AnyActorLogic, EventObject } from 'xstate';
import { getSnapshotKey, getSnapshotStateValue } from './path-label.js';

export { getShortestPaths, getSimplePaths, getAdjacencyMap };

export function getAllSimplePaths<TLogic extends AnyActorLogic>(logic: TLogic) {
  return getSimplePaths(logic);
}

export function getAllShortestPaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
) {
  return getShortestPaths(logic);
}

/**
 * One path per transition in the graph, guaranteeing every event is fired
 * from every state that declares it — including back-edges (e.g. GO_HOME)
 * that getAllShortestPaths/getAllSimplePaths structurally exclude because
 * they return to an already-visited state. Each path walks the shortest
 * route to the transition's source state, then fires that one event.
 */
export function getAllTransitionPaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
) {
  const shortestPaths = getShortestPaths(logic);
  const prefixByState = new Map(
    shortestPaths.map((path) => [getSnapshotKey(path.state), path]),
  );

  const edges = adjacencyMapToArray(getAdjacencyMap(logic, {}));

  return edges.map(({ state, event, nextState }) => {
    const sourceKey = getSnapshotKey(state);
    const prefix = prefixByState.get(sourceKey);

    if (!prefix) {
      throw new Error(
        `No shortest path found to reach source state "${sourceKey}" for event "${event.type}"`,
      );
    }

    return {
      state: nextState,
      weight: prefix.weight + 1,
      steps: [...prefix.steps, { state: nextState, event }],
    };
  });
}

export type CyclicPathOptions = {
  /** How many times a state may reappear within one path before it's pruned. 0 = never revisit (same as getAllSimplePaths). Default 1 = loop through each cycle once. */
  maxRevisits?: number;
  /** Safety cap on total paths generated; throws if exceeded rather than silently truncating. */
  maxPaths?: number;
};

/**
 * All paths through the graph including cycles, bounded by maxRevisits since
 * unbounded cyclic enumeration is infinite (e.g. GO_HOME loops forever).
 * Unlike getAllSimplePaths, a state may reappear within a path up to
 * maxRevisits times, so loops (e.g. category -> GO_HOME -> home -> ...) are
 * actually traversed instead of pruned.
 */
export function getAllCyclicPaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
  { maxRevisits = 0, maxPaths = 500 }: CyclicPathOptions = {},
) {
  const shortestPaths = getShortestPaths(logic);
  const initialPath = shortestPaths.find((path) => path.weight === 0);

  if (!initialPath) {
    throw new Error('getAllCyclicPaths: could not determine the initial state');
  }

  const edgesByState = new Map<
    string,
    Array<{ event: EventObject; nextState: unknown }>
  >();

  for (const { state, event, nextState } of adjacencyMapToArray(
    getAdjacencyMap(logic, {}),
  )) {
    const key = getSnapshotKey(state);
    const edges = edgesByState.get(key) ?? [];
    edges.push({ event, nextState });
    edgesByState.set(key, edges);
  }

  const paths: Array<{
    state: unknown;
    weight: number;
    steps: Array<{ state: unknown; event: EventObject }>;
  }> = [];

  function dfs(
    stateKey: string,
    currentState: unknown,
    steps: Array<{ state: unknown; event: EventObject }>,
    visitCounts: Map<string, number>,
  ) {
    paths.push({
      state: currentState,
      weight: steps.length,
      steps: [...steps],
    });

    if (paths.length > maxPaths) {
      throw new Error(
        `getAllCyclicPaths: exceeded maxPaths (${maxPaths}) — lower maxRevisits or raise maxPaths explicitly`,
      );
    }

    for (const { event, nextState } of edgesByState.get(stateKey) ?? []) {
      const nextKey = getSnapshotKey(nextState);
      const count = visitCounts.get(nextKey) ?? 0;

      if (count >= maxRevisits + 1) {
        continue;
      }

      visitCounts.set(nextKey, count + 1);
      dfs(
        nextKey,
        nextState,
        [...steps, { state: nextState, event }],
        visitCounts,
      );
      visitCounts.set(nextKey, count);
    }
  }

  const initialKey = getSnapshotKey(initialPath.state);
  dfs(initialKey, initialPath.state, [], new Map([[initialKey, 1]]));

  return paths;
}

export function getTransitionCount<TLogic extends AnyActorLogic>(
  logic: TLogic,
): number {
  const adjacency = getAdjacencyMap(logic, {});
  return Object.values(adjacency).reduce(
    (count, node) => count + Object.keys(node.transitions).length,
    0,
  );
}

export function getReachableStateValues<TLogic extends AnyActorLogic>(
  logic: TLogic,
): string[] {
  const paths = getShortestPaths(logic);
  return paths.map((path) => getSnapshotStateValue(path.state));
}
