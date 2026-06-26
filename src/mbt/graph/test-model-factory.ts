import { createActor } from 'xstate';
import type { AnyActorLogic, EventObject } from 'xstate';
import type { StatePath } from 'xstate/graph';
import type { ActionMap, MbtContext, StateVerifier } from '../types.js';

export type TestModelOptions<TEvent extends EventObject> = {
  actions: ActionMap;
  verifyState?: StateVerifier;
  onStateVisited?: (stateValue: string) => void;
};

function getSnapshotStateValue(snapshot: unknown): string {
  const value = (snapshot as { value: string | Record<string, string> }).value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function getEventType(event: EventObject): string {
  return event.type;
}

function isInternalEvent(eventType: string): boolean {
  return eventType.startsWith('xstate.');
}

export async function testPath<TEvent extends EventObject>(
  path: StatePath<unknown, TEvent>,
  ctx: MbtContext,
  options: TestModelOptions<TEvent>,
): Promise<void> {
  const { actions, verifyState, onStateVisited } = options;

  for (const step of path.steps) {
    const eventType = getEventType(step.event);

    if (isInternalEvent(eventType)) {
      continue;
    }

    const handler = actions[eventType];

    if (!handler) {
      throw new Error(`No action handler registered for event "${eventType}"`);
    }

    await handler(ctx);

    const expectedState = getSnapshotStateValue(step.state);
    onStateVisited?.(expectedState);

    if (verifyState) {
      await verifyState(expectedState, ctx);
    }
  }

  const finalState = getSnapshotStateValue(path.state);
  onStateVisited?.(finalState);

  if (verifyState) {
    await verifyState(finalState, ctx);
  }
}

export function createModelVerifier(logic: AnyActorLogic) {
  const actor = createActor(logic);

  return (expectedState: string) => {
    const current = getSnapshotStateValue(actor.getSnapshot());
    if (current !== expectedState) {
      throw new Error(
        `State mismatch: expected "${expectedState}", model has "${current}"`,
      );
    }
  };
}

export async function testAllShortestPaths<TLogic extends AnyActorLogic>(
  logic: TLogic,
  paths: Array<StatePath<unknown, EventObject>>,
  ctx: MbtContext,
  options: TestModelOptions<EventObject>,
): Promise<{ pathsRun: number; stepsRun: number; visitedStates: string[] }> {
  const visited = new Set<string>();
  let stepsRun = 0;

  for (const path of paths) {
    await testPath(path, ctx, {
      ...options,
      onStateVisited: (stateValue) => {
        visited.add(stateValue);
        options.onStateVisited?.(stateValue);
      },
    });
    stepsRun += path.steps.length;
  }

  return {
    pathsRun: paths.length,
    stepsRun,
    visitedStates: [...visited],
  };
}
