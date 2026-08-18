import type { CompletionReason, SignalKind, VisibleAction } from './types.js';
import { rankActions, type RankContext } from './action-ranker.js';

/**
 * The "decide" step, as a pluggable seam (plan FR-03).
 *
 * The coordinator hands the decider the current observation and the untried,
 * *unranked* candidate actions; the decider returns which one to take (or to
 * stop). This is where an LLM agent plugs in — see `AgentDecider`. Safety is
 * NOT the decider's job: whatever it picks, the coordinator still runs the
 * consequence/scope gate, so a decider can never bypass a boundary.
 */
export type DecisionContext = {
  target: string;
  keywords: string[];
  /**
   * A concise profile of the application (auto-derived structure + optional
   * authored notes) so the agent can navigate efficiently and knows key flows
   * and prerequisites. Static across the run.
   */
  appContext?: string;
  current: { url: string; aria: string };
  /** Untried actions on the current state, unranked. */
  candidates: VisibleAction[];
  history: { stepsTaken: number; visitedUrls: string[] };
  budgetRemaining: { steps: number; states: number };
  /** Heuristic ranking context, so an agent may consult scores if it wants. */
  rank: RankContext;
  /**
   * Outcome of the previous action, so the agent can tell whether it did
   * anything — e.g. an "add to bag" that left the page unchanged usually means a
   * prerequisite (select a size/variant) is still needed.
   */
  lastAction?: {
    label: string;
    /** True if the action moved to a different state than it started on. */
    changedState: boolean;
    signals: SignalKind[];
  };
};

export type Decision =
  | { kind: 'act'; actionId: string; rationale?: string }
  | { kind: 'stop'; reason: CompletionReason; rationale?: string };

export interface Decider {
  choose(ctx: DecisionContext): Promise<Decision> | Decision;
}

/**
 * Deterministic baseline: pick the highest-ranked candidate. Keeps exploration
 * fully autonomous with no agent, and backs tests. Never stops early — the
 * coordinator handles the "no candidates" case before consulting a decider.
 */
export class HeuristicDecider implements Decider {
  choose(ctx: DecisionContext): Decision {
    const [top] = rankActions(ctx.candidates, ctx.rank);
    if (!top) return { kind: 'stop', reason: 'noUsefulAction' };
    return {
      kind: 'act',
      actionId: top.id,
      rationale: 'highest heuristic score',
    };
  }
}

export type ChooseFn = (ctx: DecisionContext) => Promise<Decision> | Decision;

/**
 * LLM-driven decider. The `choose` callback is fulfilled by an agent reasoning
 * over the observation, history, target, and remaining budget. In this POC the
 * agent is the in-session Claude Code loop (no SDK integration — plan §11);
 * the callback is the boundary where that reasoning is supplied.
 */
export class AgentDecider implements Decider {
  constructor(private readonly chooseFn: ChooseFn) {}
  choose(ctx: DecisionContext): Promise<Decision> | Decision {
    return this.chooseFn(ctx);
  }
}
