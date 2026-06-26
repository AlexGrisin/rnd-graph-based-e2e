import { getShortestPaths, getAdjacencyMap } from 'xstate/graph';
import type { AnyActorLogic } from 'xstate';

export { getShortestPaths, getAdjacencyMap };

export function getAllShortestPaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
) {
  return getShortestPaths(logic);
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
  return paths.map((path) => serializeSnapshotValue(path.state));
}

function serializeSnapshotValue(snapshot: unknown): string {
  const value = (snapshot as { value: string | Record<string, string> }).value;
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}
