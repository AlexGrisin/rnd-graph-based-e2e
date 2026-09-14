Reusable XState journey-machine pattern for this workspace.

## Name

XState Journey Machine

## Description

Encapsulates one user journey as a typed XState machine in `src/machines/`. The machine stays pure: it describes states, events, and small context updates without any Playwright imports or browser behavior.

Use when:

- Adding a new MBT journey under `src/machines/`
- Extending an existing journey with another user-visible state or event
- Providing a machine that `tests/mbt/*.spec.ts` can traverse through shared runner utilities

Do not put Playwright code, locators, or environment reads in the machine module.

## Conventions

- Export `<Journey>Context` and `<Journey>Event` types before the machine.
- Build the machine with `setup({ types: ... }).createMachine(...)`.
- Use string state ids that match page-verifier keys and MBT path labels.
- Keep `initial`, `context`, and `states` inline in the machine declaration.
- Export a narrow `*StateValue` union plus a helper that reads `.value` from an unknown snapshot.
- Reserve `assign(...)` for small context mutations caused by a transition.

## Template

```typescript
import { assign, setup } from 'xstate';

export type ExampleJourneyContext = {
  selectedItem: string;
};

export type ExampleJourneyEvent =
  | { type: 'OPEN_DETAIL' }
  | { type: 'CONFIRM' }
  | { type: 'FAIL' };

export const exampleJourneyMachine = setup({
  types: {
    context: {} as ExampleJourneyContext,
    events: {} as ExampleJourneyEvent,
  },
}).createMachine({
  id: 'exampleJourney',
  initial: 'home',
  context: {
    selectedItem: '',
  },
  states: {
    home: {
      on: {
        OPEN_DETAIL: 'detail',
      },
    },
    detail: {
      on: {
        CONFIRM: {
          target: 'done',
          actions: assign({ selectedItem: 'demo-item' }),
        },
        FAIL: 'error',
      },
    },
    done: {
      type: 'final',
    },
    error: {
      type: 'final',
    },
  },
});

export type ExampleJourneyStateValue = 'home' | 'detail' | 'done' | 'error';

export function getExampleJourneyStateValue(
  state: unknown,
): ExampleJourneyStateValue {
  return (state as { value: ExampleJourneyStateValue }).value;
}
```

## Reference implementations

- `src/machines/app-auth.machine.ts` - typed context plus `assign(...)` on `SUBMIT`
- `src/machines/app-shopping.machine.ts` - shopping journey with discovery branches, home-return cycles, and checkout
