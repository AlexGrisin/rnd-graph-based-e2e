import type { Issue, Signal, SignalEvent, SignalKind } from './types.js';
import { fingerprint } from './hash.js';

/**
 * Signal kinds that are treated as potential bugs on first occurrence.
 * Others (timeouts, no-change, obstruction) become potential bugs only when
 * they reproduce — see plan §8.
 */
const BUG_KINDS: ReadonlySet<SignalKind> = new Set<SignalKind>([
  'pageError',
  'consoleError',
  'requestFailed',
  'httpError',
  'errorShown',
]);

export type Correlation = {
  fromNode: string;
  toNode?: string;
  actionId?: string;
  step: number;
};

/**
 * Correlates signals to graph transitions. Keeps a raw event stream
 * (→ errors.json) and a deduplicated, fingerprinted issue set (→ issues.json).
 */
export class IssueLog {
  private readonly events: SignalEvent[] = [];
  private readonly issuesByFingerprint = new Map<string, Issue>();
  /** Distinct transition keys per issue, used to count affected transitions. */
  private readonly transitionsByFingerprint = new Map<string, Set<string>>();

  record(signal: Signal, at: Correlation): Issue {
    this.events.push({
      kind: signal.kind,
      message: signal.message,
      fromNode: at.fromNode,
      toNode: at.toNode,
      actionId: at.actionId,
      step: at.step,
      detail: signal.detail,
      party: signal.party,
    });

    // Dedup by signal identity (kind + message + party), NOT by transition, so
    // the same error across many pages collapses to one issue with a count and
    // an affected-transitions tally.
    const fp = fingerprint([signal.kind, signal.party, signal.message]);
    const transitionKey = `${at.fromNode}->${at.toNode ?? ''}`;
    let transitions = this.transitionsByFingerprint.get(fp);
    if (!transitions) {
      transitions = new Set<string>();
      this.transitionsByFingerprint.set(fp, transitions);
    }
    transitions.add(transitionKey);

    const existing = this.issuesByFingerprint.get(fp);
    if (existing) {
      existing.count += 1;
      existing.transitions = transitions.size;
      existing.potentialBug =
        existing.potentialBug || isPotentialBug(signal.kind, existing.count);
      return existing;
    }

    const issue: Issue = {
      fingerprint: fp,
      kind: signal.kind,
      message: signal.message,
      fromNode: at.fromNode,
      toNode: at.toNode,
      actionId: at.actionId,
      count: 1,
      transitions: transitions.size,
      firstStep: at.step,
      potentialBug: isPotentialBug(signal.kind, 1),
      party: signal.party,
    };
    this.issuesByFingerprint.set(fp, issue);
    return issue;
  }

  /** Raw correlated signal events (→ errors.json). */
  allEvents(): SignalEvent[] {
    return [...this.events];
  }

  /** Deduplicated issues (→ issues.json). */
  allIssues(): Issue[] {
    return [...this.issuesByFingerprint.values()];
  }

  potentialBugs(): Issue[] {
    return this.allIssues().filter((i) => i.potentialBug);
  }
}

/** An issue is a potential bug if its kind is bug-worthy or it reproduced. */
export function isPotentialBug(kind: SignalKind, count: number): boolean {
  // Field-level validation is the site working as designed against the tool's
  // own (incomplete/synthetic) input — never a defect, even if it repeats.
  if (kind === 'validation') return false;
  return BUG_KINDS.has(kind) || count >= 2;
}
