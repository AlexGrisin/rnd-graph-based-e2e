import type {
  ChosenAction,
  CompletionReason,
  GraphNode,
  Manifest,
  VisibleAction,
} from './types.js';
import { SessionRecorder } from './recorder.js';
import {
  canonicalUrl,
  isOffOrigin,
  type RankContext,
} from './action-ranker.js';
import { classifyConsequence } from './consequence-policy.js';
import { resolveIntent, type EntryStrategy } from './intent-map.js';
import { deriveAppProfile, buildAppContext } from './app-profile.js';
import {
  HeuristicDecider,
  type Decider,
  type DecisionContext,
} from './decider.js';
import type { ExplorationHost } from './host.js';
import type { CoverageHints } from './sitemap.js';
import type { RunArtifacts } from './report.js';

/** Internal exploration budget — implementation constants, not user inputs. */
export type ExploreDefaults = {
  maxSteps: number;
  maxStates: number;
  timeBudgetMs?: number;
};

export const DEFAULT_BUDGET: ExploreDefaults = {
  maxSteps: 60,
  maxStates: 25,
  timeBudgetMs: 5 * 60_000,
};

export type ExploreOptions = {
  target: string;
  baseUrl: string;
  runId: string;
  host: ExplorationHost;
  /** Chooses the next action. Defaults to the heuristic baseline. */
  decider?: Decider;
  defaults?: Partial<ExploreDefaults>;
  /** Advisory coverage hints; used only to seed the entry page. */
  hints?: CoverageHints;
  /** Authored application notes (business rules, flows, prerequisites). */
  authoredContext?: string;
  /** Injectable clock for deterministic time budgeting in tests. */
  now?: () => number;
};

export type ExploreResult = {
  recorder: SessionRecorder;
  manifest: Manifest;
  completionReason: CompletionReason;
  steps: number;
  backtracks: number;
  artifacts: RunArtifacts;
};

/** Decide the first page for a target. Hints seed it; nothing is hard-coded. */
export function resolveEntryUrl(
  strategy: EntryStrategy,
  baseUrl: string,
  hints?: CoverageHints,
): string {
  if (strategy.kind === 'sitemapProduct' && hints?.productUrls.length) {
    return hints.productUrls[0];
  }
  return baseUrl;
}

/**
 * Run one autonomous exploration: resolve intent → open entry → observe →
 * decide → consequence-check → act or skip → record → continue/backtrack → stop.
 *
 * The coordinator owns internal defaults, recording, deduplication, scope, and
 * stop conditions. Action *choice* is delegated to `options.decider` (heuristic
 * by default, an agent when supplied); the site is reached only through the
 * host. `explore(target, ...)` is the entire contract.
 */
export async function explore(options: ExploreOptions): Promise<ExploreResult> {
  const { target, baseUrl, runId, host } = options;
  const budget = { ...DEFAULT_BUDGET, ...options.defaults };
  const decider = options.decider ?? new HeuristicDecider();
  const now = options.now ?? Date.now;
  const startedAt = now();

  const intent = resolveIntent(target);
  const baseOrigin = new URL(baseUrl).origin;
  const recorder = new SessionRecorder({ target, baseUrl, runId });

  /** Untried candidate actions per node id. Presence ⇒ node is a frontier. */
  const untriedByNode = new Map<string, VisibleAction[]>();
  const visitedUrls = new Set<string>();

  const rankContextFor = (): RankContext => ({
    keywords: intent.keywords,
    baseOrigin,
    visitedUrls,
  });

  const registerNode = (node: GraphNode, actions: VisibleAction[]) => {
    visitedUrls.add(canonicalUrl(node.url, baseUrl) ?? node.url);
    if (!untriedByNode.has(node.id)) {
      untriedByNode.set(node.id, dedupeActions(actions));
    }
  };

  const entryUrl = resolveEntryUrl(intent.strategy, baseUrl, options.hints);
  const rootObs = await host.open(entryUrl);
  const rootNode = recorder.start(rootObs);
  registerNode(rootNode, rootObs.actions);

  // Ground the decider in the app's shape + authored rules (static all run).
  const appContext = buildAppContext(
    options.authoredContext,
    deriveAppProfile(baseUrl, rootObs, options.hints),
  );

  let currentId = rootNode.id;
  let backtracks = 0;
  let completion: CompletionReason = 'noUsefulAction';
  let lastAction: DecisionContext['lastAction'];

  const budgetExhausted = () =>
    recorder.currentStep >= budget.maxSteps ||
    recorder.graph.stats().nodeCount >= budget.maxStates ||
    (budget.timeBudgetMs !== undefined &&
      now() - startedAt >= budget.timeBudgetMs);

  while (true) {
    if (budgetExhausted()) {
      completion = 'budgetExhausted';
      break;
    }

    const untried = untriedByNode.get(currentId) ?? [];

    // Current state exhausted → backtrack to any frontier node.
    if (untried.length === 0) {
      const next = pickFrontier(untriedByNode);
      if (!next) {
        completion = 'noUsefulAction';
        break;
      }
      backtracks += 1;
      const node = recorder.graph.getNode(next)!;
      await host.open(node.url); // re-observe deduplicates back to `next`
      currentId = next;
      continue;
    }

    const currentNode = recorder.graph.getNode(currentId)!;
    const context: DecisionContext = {
      target,
      keywords: intent.keywords,
      appContext,
      current: { url: currentNode.url, aria: '' },
      candidates: untried,
      history: {
        stepsTaken: recorder.currentStep,
        visitedUrls: [...visitedUrls],
      },
      budgetRemaining: {
        steps: budget.maxSteps - recorder.currentStep,
        states: budget.maxStates - recorder.graph.stats().nodeCount,
      },
      rank: rankContextFor(),
      lastAction,
    };

    const decision = await decider.choose(context);
    if (decision.kind === 'stop') {
      completion = decision.reason;
      break;
    }

    // The decider names an action id; fall back to the first candidate if it
    // returns an unknown id (an agent should not, but must not wedge the loop).
    const index = untried.findIndex((a) => a.id === decision.actionId);
    const action = index >= 0 ? untried.splice(index, 1)[0] : untried.shift()!;

    // Safety gate — enforced regardless of what the decider chose (FR-05).
    const skip = preActGate(action, baseOrigin);
    if (skip) {
      recorder.recordTransition(
        currentId,
        toChosen(action, decision.rationale, skip.reason),
        {},
      );
      lastAction = { label: action.name, changedState: false, signals: [] };
      continue;
    }

    const result = await host.act(action);
    const { edge, toNode } = recorder.recordTransition(
      currentId,
      toChosen(action, decision.rationale),
      result,
    );

    // Did the action actually move us somewhere new? An add-to-bag that leaves
    // the same state usually means a prerequisite (size/variant) is unmet.
    const changedState = toNode !== undefined && toNode.id !== currentId;
    lastAction = {
      label: action.name,
      changedState,
      signals: edge.signalKinds,
    };

    if (toNode) {
      registerNode(toNode, result.outcome?.actions ?? []);
      currentId = toNode.id; // advance into the newly reached state
    }
    // On failure/no-change we stay on the current node with one fewer untried.
  }

  recorder.complete(completion);
  const artifacts: RunArtifacts = {
    manifest: recorder.buildManifest(),
    nodes: recorder.graph.nodes(),
    edges: recorder.graph.edges(),
    issues: recorder.issues.allIssues(),
    signalEvents: recorder.issues.allEvents(),
    hints: options.hints,
  };
  return {
    recorder,
    manifest: artifacts.manifest,
    completionReason: completion,
    steps: recorder.currentStep,
    backtracks,
    artifacts,
  };
}

/** Deduplicate actions by id, preserving first-seen order. */
function dedupeActions(actions: VisibleAction[]): VisibleAction[] {
  const seen = new Set<string>();
  const out: VisibleAction[] = [];
  for (const a of actions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

function pickFrontier(
  untriedByNode: Map<string, VisibleAction[]>,
): string | undefined {
  for (const [nodeId, actions] of untriedByNode) {
    if (actions.length > 0) return nodeId;
  }
  return undefined;
}

function preActGate(
  action: VisibleAction,
  baseOrigin: string,
): { reason: string } | null {
  const consequence = classifyConsequence(action);
  if (consequence.consequential)
    return { reason: consequence.reason ?? 'consequential' };
  if (action.href && isOffOrigin(action.href, baseOrigin)) {
    return { reason: 'external scope exit' };
  }
  return null;
}

function toChosen(
  action: VisibleAction,
  rationale?: string,
  skipReason?: string,
): ChosenAction {
  return {
    actionId: action.id,
    label: action.name || action.id,
    kind: action.kind,
    skipped: skipReason !== undefined,
    skipReason,
    rationale,
  };
}
