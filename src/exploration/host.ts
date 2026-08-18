import type { ActionResult, Observation, VisibleAction } from './types.js';

/**
 * The browser boundary the coordinator drives.
 *
 * Deliberately MCP-shaped: `open` ≈ navigate+snapshot, `act` ≈ interact+snapshot.
 * The coordinator knows nothing beyond this interface, so the same loop runs
 * against a controlled in-memory site (tests) or a live browser (Playwright /
 * Playwright MCP) without change.
 */
export interface ExplorationHost {
  /** Navigate to a URL and return the resulting page observation. */
  open(url: string): Promise<Observation>;
  /** Execute an action from the current page; return its result + new state. */
  act(action: VisibleAction): Promise<ActionResult>;
  /** Optional: capture a screenshot artifact, returning its reference/path. */
  screenshot?(label: string): Promise<string | undefined>;
  /** Optional: release browser resources. */
  close?(): Promise<void>;
}
