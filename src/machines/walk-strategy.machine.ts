import { assign, setup } from 'xstate';
import type { StatePath } from 'xstate/graph';
import type { AppAuthEvent } from './app-auth.machine.js';

export type WalkStrategyContext = {
  paths: Array<StatePath<unknown, AppAuthEvent>>;
  pathIndex: number;
  visitedStates: string[];
  lastError: string | null;
};

export type WalkStrategyEvent =
  | { type: 'START'; paths: WalkStrategyContext['paths'] }
  | { type: 'PATH_COMPLETE'; finalState: string }
  | { type: 'FAIL'; reason: string };

export const walkStrategyMachine = setup({
  types: {
    context: {} as WalkStrategyContext,
    events: {} as WalkStrategyEvent,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCGAbA1gZQC4CdVcwoBPAOgEsJ0wBibAFQEEAlRgbQAYBdRUAA4B7WJVyUhAO34gAHogCMAJgCs5ACwBObQA4VOrgHYuXJTvUAaEKUUA2deTP3NtpevWGttzQF8fVtCw8QmIyckDMSkkoOgAFZkYACQB9AGEAeQBZWIAZAFFGPO4+JBBhUXEpGXkEJQBmJXIGnQUjOp1bLhVbKxsETTryFRVtD0MXF09ffxAI4KISCgiomPiktKzcgqKFEsERMQlpUpqVLgdbZqMXd3HLa0QWoZMuBQUDV4Vu9T8AjBwCAswstonQAGLMACSOWKMnKhyqJ0QZwuV3G9g8mnufQUhkM5E0KjqCncOjqhPO9T8M0kQggcBkc0BoT6+wqR2qiAAtD0Hggeb9Zv95iyqDQwHCDpVjqAauolL1FDp8YZLlwdJplfVlF9BUyQotwv8VpL2YjZYhiYN3JolFxbTolAN1LycYTyK86ur1XVLt0FHrhczDRApBLSvDpZyEC0uB69LazgpOliVIqEK1BoYlLYVMZNIZlV9bIZA0Fg2EAGaoSi0CCmhEyuSPVrxkaqV4p9Rpvl2uO4gvnV6x+Wl6lAA */
  id: 'walkStrategy',
  initial: 'idle',
  context: {
    paths: [],
    pathIndex: 0,
    visitedStates: [],
    lastError: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'walking',
          actions: assign({
            paths: ({ event }) => event.paths,
            pathIndex: 0,
            visitedStates: [],
            lastError: null,
          }),
        },
      },
    },
    walking: {
      on: {
        PATH_COMPLETE: [
          {
            guard: ({ context, event }) => {
              const nextIndex = context.pathIndex + 1;
              return nextIndex < context.paths.length;
            },
            actions: assign({
              pathIndex: ({ context }) => context.pathIndex + 1,
              visitedStates: ({ context, event }) =>
                context.visitedStates.includes(event.finalState)
                  ? context.visitedStates
                  : [...context.visitedStates, event.finalState],
            }),
          },
          {
            target: 'done',
            actions: assign({
              visitedStates: ({ context, event }) =>
                context.visitedStates.includes(event.finalState)
                  ? context.visitedStates
                  : [...context.visitedStates, event.finalState],
            }),
          },
        ],
        FAIL: {
          target: 'failed',
          actions: assign({
            lastError: ({ event }) => event.reason,
          }),
        },
      },
    },
    done: {
      type: 'final',
    },
    failed: {
      type: 'final',
    },
  },
});

export function getCurrentPath(context: WalkStrategyContext) {
  return context.paths[context.pathIndex];
}
