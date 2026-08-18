import type {
  ChosenAction,
  GraphEdge,
  GraphNode,
  Observation,
} from './types.js';
import { hashState } from './hash.js';

/**
 * The observed state/transition graph.
 *
 * Nodes are deduplicated by normalized-ARIA hash, so revisiting a page reuses
 * its node. `expanded` tracks (node, action) pairs already taken, letting the
 * agent avoid re-expanding the same choice (plan FR-06).
 */
export class ObservedGraph {
  private readonly nodesById = new Map<string, GraphNode>();
  private readonly edgeList: GraphEdge[] = [];
  private readonly visited = new Set<string>();
  private readonly expanded = new Set<string>();

  /** Upsert a node for an observation and mark it visited. Returns the node. */
  observe(obs: Observation, step: number): GraphNode {
    const id = hashState(obs.aria);
    const existing = this.nodesById.get(id);
    this.visited.add(id);
    if (existing) return existing;

    const node: GraphNode = {
      id,
      url: obs.url,
      screenshotRef: obs.screenshotRef,
      actionCount: obs.actions.length,
      firstSeenStep: step,
    };
    this.nodesById.set(id, node);
    return node;
  }

  private key(nodeId: string, actionId: string): string {
    return `${nodeId}::${actionId}`;
  }

  hasExpanded(nodeId: string, actionId: string): boolean {
    return this.expanded.has(this.key(nodeId, actionId));
  }

  markExpanded(nodeId: string, actionId: string): void {
    this.expanded.add(this.key(nodeId, actionId));
  }

  addEdge(edge: GraphEdge): void {
    this.edgeList.push(edge);
    this.markExpanded(edge.from, edge.actionId);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  nodes(): GraphNode[] {
    return [...this.nodesById.values()];
  }

  edges(): GraphEdge[] {
    return [...this.edgeList];
  }

  isVisited(id: string): boolean {
    return this.visited.has(id);
  }

  stats(): { nodeCount: number; edgeCount: number; skippedCount: number } {
    return {
      nodeCount: this.nodesById.size,
      edgeCount: this.edgeList.length,
      skippedCount: this.edgeList.filter((e) => e.skipped).length,
    };
  }
}

/** Build a `ChosenAction` edge label for readability. */
export function edgeLabel(chosen: ChosenAction): string {
  return chosen.label || chosen.actionId;
}
