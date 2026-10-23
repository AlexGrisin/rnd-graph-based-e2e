import type { EventObject } from 'xstate';
import type { StatePath } from 'xstate/graph';

export function getSnapshotStateValue(snapshot: unknown): string {
  const value = (snapshot as { value: string | Record<string, string> }).value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function getSnapshotContext(
  snapshot: unknown,
): Record<string, unknown> | undefined {
  return (snapshot as { context?: Record<string, unknown> }).context;
}

function hasMeaningfulContext(context: unknown): boolean {
  return (
    !!context && typeof context === 'object' && Object.keys(context).length > 0
  );
}

/**
 * Identity key for graph traversal/dedup — state value plus context. Two
 * snapshots sharing a state value but differing in context (e.g. a guard's
 * boolean flag) are distinct graph nodes and must not be merged; using value
 * alone would conflate their outgoing edges (see getAllCyclicPaths).
 */
export function getSnapshotKey(snapshot: unknown): string {
  const context = getSnapshotContext(snapshot);
  return hasMeaningfulContext(context)
    ? `${getSnapshotStateValue(snapshot)}${JSON.stringify(context)}`
    : getSnapshotStateValue(snapshot);
}

function getEventType(event: EventObject): string {
  return event.type;
}

function isInternalEvent(eventType: string): boolean {
  return eventType.startsWith('xstate.');
}

export function describePath(path: StatePath<unknown, EventObject>): string {
  const targetState = getSnapshotStateValue(path.state);
  const events = path.steps
    .filter((step) => !isInternalEvent(getEventType(step.event)))
    .map((step) => getEventType(step.event))
    .join(' → ');

  const label =
    events.length > 0
      ? `→ ${targetState}: ${events}`
      : `→ ${targetState}: (initial)`;

  // Distinct context (e.g. a guard's tracked flag) can produce the same
  // event-type sequence into the same state value; disambiguate the title
  // so two genuinely different graph nodes don't collide.
  const context = getSnapshotContext(path.state);
  return hasMeaningfulContext(context)
    ? `${label} (${formatContext(context!)})`
    : label;
}

// No brackets/braces/quotes: --grep treats the title as a regex, and those
// characters are regex metacharacters that break naive copy-pasted greps.
function formatContext(context: Record<string, unknown>): string {
  return Object.entries(context)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}
