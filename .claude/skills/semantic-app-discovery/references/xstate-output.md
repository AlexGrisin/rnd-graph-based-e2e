# XState Output Contract

Read this reference before creating or changing a machine.

## Machine contract

The persistent semantic output is a pure TypeScript machine at `src/machines/<journey>.machine.ts`. Follow the repository's [XState journey-machine pattern](../../../../docs/PATTERNS/machine-model.md).

- Export `<Journey>Context` and `<Journey>Event` before the machine.
- Create the machine with `setup({ types: ... }).createMachine(...)`.
- Use a stable camel-case machine ID and lower-camel-case state IDs.
- Use `UPPER_SNAKE_CASE` event types.
- Keep `initial`, `context`, and `states` in the machine declaration.
- Export a narrow `<Journey>StateValue` union and a state-value helper.
- Use `assign(...)` only for small, transition-driven domain context updates.
- Keep the machine free of Playwright, locators, URLs, credentials, configuration, and browser evidence.

## New journeys

For a new journey, propose a stable journey name before creating `src/machines/<journey>.machine.ts`. Include only directly observed states, events, and transitions. A terminal state uses `type: 'final'`; do not infer terminality from a page URL alone.

## Existing journeys

When extending an existing machine:

- preserve its ID, state names, event names, context, and unrelated transitions;
- add only directly observed behavior;
- reuse an existing state or event when semantically equivalent;
- do not delete or rename behavior unless the caller explicitly approved it; and
- avoid guards unless typed context makes the transition deterministic and the graph remains traversable.

Use separate events for outcomes that the adapter deliberately controls. Do not encode selectors, URLs, snapshot refs, credentials, or UI copy into event names or context.

## Output modes

In `integrated` mode, a machine change is complete only with the corresponding repository wiring in [repository-integration.md](repository-integration.md). In explicit `model-only` mode, produce the machine proposal and list the missing page-object, action-map, stub, fixture, verifier, and spec work; do not claim that the new paths execute.

## Review and validation

Before modifying source, show the machine states, events, transitions, final states, and affected adapter files for approval. After applying an approved change, format the touched files and validate the generated paths through the repository's stub project where the journey is wired.
