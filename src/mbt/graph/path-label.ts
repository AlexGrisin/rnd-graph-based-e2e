import type { EventObject } from 'xstate';
import type { StatePath } from 'xstate/graph';

export function getSnapshotStateValue(snapshot: unknown): string {
  const value = (snapshot as { value: string | Record<string, string> }).value;
  return typeof value === 'string' ? value : JSON.stringify(value);
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

  return events.length > 0
    ? `→ ${targetState}: ${events}`
    : `→ ${targetState}: (initial)`;
}
