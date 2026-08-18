import type {
  ActionResult,
  ChosenAction,
  CompletionReason,
  GraphEdge,
  GraphNode,
  Manifest,
  Observation,
  Signal,
} from './types.js';
import { ObservedGraph, edgeLabel } from './graph.js';
import { IssueLog } from './issues.js';
import { assert } from './assert.js';

export type RecorderOptions = {
  target: string;
  baseUrl: string;
  runId: string;
};

export type TransitionResult = {
  edge: GraphEdge;
  toNode?: GraphNode;
};

/**
 * SessionRecorder — the browser-independent heart of the exploration loop.
 *
 * The future Playwright MCP loop drives it: `start()` with the root observation,
 * then `recordTransition()` for each chosen action + its result. The recorder
 * owns state identity (via the graph), dedup, signal correlation, and step
 * counting. It knows nothing about how observations were captured.
 */
export class SessionRecorder {
  readonly graph = new ObservedGraph();
  readonly issues = new IssueLog();

  private readonly opts: RecorderOptions;
  private step = 0;
  private startStep = 0;
  private rootNodeId?: string;
  private completion?: CompletionReason;

  constructor(opts: RecorderOptions) {
    assert(opts.target.trim().length > 0, 'target must be non-empty');
    assert(opts.baseUrl.trim().length > 0, 'baseUrl must be non-empty');
    assert(opts.runId.trim().length > 0, 'runId must be non-empty');
    this.opts = opts;
  }

  /** Record the entry observation. Must be called exactly once, first. */
  start(root: Observation): GraphNode {
    assert(this.rootNodeId === undefined, 'start() called more than once');
    this.startStep = this.step;
    const node = this.graph.observe(root, this.step);
    this.rootNodeId = node.id;
    this.correlateSignals(node.id, node.id, undefined, root.signals);
    return node;
  }

  /**
   * Record a chosen action and its result as a graph transition.
   * Skipped (consequential) actions record a boundary edge with `to: null`.
   */
  recordTransition(
    fromNodeId: string,
    chosen: ChosenAction,
    result: ActionResult,
  ): TransitionResult {
    assert(this.rootNodeId !== undefined, 'recordTransition() before start()');
    assert(
      this.graph.getNode(fromNodeId) !== undefined,
      `unknown source node "${fromNodeId}"`,
    );
    this.step += 1;

    // Consequence boundary — recorded, not executed.
    if (chosen.skipped) {
      const edge: GraphEdge = {
        from: fromNodeId,
        to: null,
        actionId: chosen.actionId,
        label: edgeLabel(chosen),
        kind: chosen.kind,
        skipped: true,
        skipReason: chosen.skipReason,
        rationale: chosen.rationale,
        signalKinds: [],
        step: this.step,
      };
      this.graph.addEdge(edge);
      return { edge };
    }

    let toNode: GraphNode | undefined;
    if (result.outcome) {
      toNode = this.graph.observe(result.outcome, this.step);
    }

    const signals = [
      ...(result.signals ?? []),
      ...(result.outcome?.signals ?? []),
    ];
    const edge: GraphEdge = {
      from: fromNodeId,
      to: toNode?.id ?? null,
      actionId: chosen.actionId,
      label: edgeLabel(chosen),
      kind: chosen.kind,
      skipped: false,
      rationale: chosen.rationale,
      signalKinds: [...new Set(signals.map((s) => s.kind))],
      step: this.step,
    };
    this.graph.addEdge(edge);
    this.correlateSignals(fromNodeId, toNode?.id, chosen.actionId, signals);

    if (result.failed && signals.length === 0) {
      // A failure with no explicit signal still deserves correlation.
      this.issues.record(
        { kind: 'noChange', message: `action "${chosen.label}" failed` },
        {
          fromNode: fromNodeId,
          toNode: toNode?.id,
          actionId: chosen.actionId,
          step: this.step,
        },
      );
    }

    return { edge, toNode };
  }

  private correlateSignals(
    fromNode: string,
    toNode: string | undefined,
    actionId: string | undefined,
    signals?: Signal[],
  ): void {
    for (const signal of signals ?? []) {
      this.issues.record(signal, {
        fromNode,
        toNode,
        actionId,
        step: this.step,
      });
    }
  }

  complete(reason: CompletionReason): void {
    this.completion = reason;
  }

  buildManifest(): Manifest {
    const { nodeCount, edgeCount, skippedCount } = this.graph.stats();
    return {
      runId: this.opts.runId,
      target: this.opts.target,
      baseUrl: this.opts.baseUrl,
      startedStep: this.startStep,
      totalSteps: this.step,
      nodeCount,
      edgeCount,
      skippedCount,
      issueCount: this.issues.allIssues().length,
      completionReason: this.completion,
    };
  }

  get currentStep(): number {
    return this.step;
  }
}
