/**
 * Pure exploration domain types.
 *
 * NO Playwright / browser imports are allowed in this module (or anywhere under
 * `src/exploration/`). The recorder consumes *host observations* — plain data
 * the future Playwright MCP loop will hand it — so the whole telemetry core is
 * testable without a browser.
 */

/** ARIA role / control kinds worth ranking as actions. Free-form; not exhaustive. */
export type ActionKind =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'search'
  | 'select'
  | 'submit'
  | 'other';

/** A visible, actionable element the agent may choose from a page state. */
export type VisibleAction = {
  /** Stable-within-a-state identifier, e.g. `${role}:${name}`. */
  id: string;
  /** ARIA role or control kind: link, button, textbox, ... */
  role: string;
  /** Accessible name / visible label. */
  name: string;
  kind: ActionKind;
  /** Resolved target URL for links/navigations, when known. */
  href?: string;
  /** True when the action is judged to cause a persistent external effect. */
  consequential?: boolean;
};

/** Runtime signal categories worth correlating to a graph transition (see plan §8). */
export type SignalKind =
  | 'pageError'
  | 'consoleError'
  | 'requestFailed'
  | 'httpError' // 4xx / 5xx
  | 'errorShown' // visible SITE error UI after an action (alert, banner)
  | 'validation' // field-level validation prompt — expected, NOT a defect
  | 'timeout'
  | 'ambiguous'
  | 'obstructed'
  | 'noChange'
  | 'originChange'
  | 'ariaCaptureFailed';

/** Whether a signal originated on the site's own domain or a third party. */
export type SignalParty = 'first' | 'third';

export type Signal = {
  kind: SignalKind;
  message: string;
  /** Optional structured detail (status code, url, selector, ...). */
  detail?: Record<string, unknown>;
  /** First-party (site) vs third-party (external vendor). */
  party?: SignalParty;
};

/**
 * A single observed page state captured by the host.
 * This is the browser-independent input to the recorder.
 */
export type Observation = {
  url: string;
  /** Raw ARIA snapshot text; the recorder normalizes + hashes it for identity. */
  aria: string;
  /** Path/reference to a stored screenshot artifact, if captured. */
  screenshotRef?: string;
  /** Actions visible on this page. */
  actions: VisibleAction[];
  /** Signals observed while reaching / rendering this state. */
  signals?: Signal[];
};

/** The action the agent chose to take from a source state. */
export type ChosenAction = {
  /** Matches `VisibleAction.id` from the source observation. */
  actionId: string;
  /** Human-readable label of what was attempted. */
  label: string;
  kind: ActionKind;
  /** True when skipped by the consequence policy instead of executed. */
  skipped?: boolean;
  /** Reason for the skip, when skipped. */
  skipReason?: string;
  /** Why the decider chose this action (agent rationale or heuristic note). */
  rationale?: string;
};

/** Result of executing (or skipping) a chosen action. */
export type ActionResult = {
  /** Observation of the resulting state; absent when the action produced none. */
  outcome?: Observation;
  /** Signals produced by executing this action. */
  signals?: Signal[];
  /** True when the action failed to complete. */
  failed?: boolean;
};

/** A deduplicated state in the observed graph. Identity = normalized-ARIA hash. */
export type GraphNode = {
  /** SHA-256 hex of the normalized ARIA state. */
  id: string;
  url: string;
  screenshotRef?: string;
  /** Number of visible actions seen at first observation. */
  actionCount: number;
  /** Step index at which this node was first observed. */
  firstSeenStep: number;
};

/** A recorded transition (or skipped boundary) between states. */
export type GraphEdge = {
  from: string; // source node id
  to: string | null; // target node id; null for skipped/failed transitions
  actionId: string;
  label: string;
  kind: ActionKind;
  /** True when this edge is a recorded consequence boundary, not a navigation. */
  skipped: boolean;
  skipReason?: string;
  /** Why the decider chose this action (agent rationale or heuristic note). */
  rationale?: string;
  /** Signal kinds correlated to this transition. */
  signalKinds: SignalKind[];
  step: number;
};

/** A deduplicated potential-issue, fingerprinted for repeat detection. */
export type Issue = {
  /** Deterministic fingerprint (kind + correlation), used for dedup. */
  fingerprint: string;
  kind: SignalKind;
  message: string;
  /** Source node of the FIRST occurrence (representative). */
  fromNode: string;
  toNode?: string;
  actionId?: string;
  /** Total times this signal occurred (across all transitions). */
  count: number;
  /** Number of distinct transitions this signal appeared on. */
  transitions: number;
  firstStep: number;
  /** Promoted to a potential bug (see plan §8). */
  potentialBug: boolean;
  /** First-party (site) vs third-party (external vendor). */
  party?: SignalParty;
};

/** A raw correlated signal event (→ errors.json), before dedup. */
export type SignalEvent = {
  kind: SignalKind;
  message: string;
  fromNode: string;
  toNode?: string;
  actionId?: string;
  step: number;
  detail?: Record<string, unknown>;
  party?: SignalParty;
};

export type CompletionReason =
  | 'targetCovered'
  | 'noUsefulAction'
  | 'budgetExhausted'
  | 'error';

/** Run-level manifest (→ manifest.json). */
export type Manifest = {
  runId: string;
  target: string;
  baseUrl: string;
  startedStep: number;
  totalSteps: number;
  nodeCount: number;
  edgeCount: number;
  skippedCount: number;
  issueCount: number;
  completionReason?: CompletionReason;
};
