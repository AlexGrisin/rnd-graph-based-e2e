# AGENT MEMORY

Generalized reusable lessons from agent sessions.
Root causes converted into preventive rules, not incident-specific notes.
Entries are h3 headers with [ACTIVE|RETIRED] status.
Content: brief, grep-friendly, MECE across sections.
Style: one-liner per entry, optional sub-bullets for context.
Keep template entries so that AI knows how to fill them in later on.

## Preventive Rules

### <Generalized Preventive Rule> [ACTIVE|RETIRED]
[Root cause, Reasons, Problems]

### Keep Journey Machines Browser-Free [ACTIVE]
Do not put Playwright locators, page objects, or environment reads inside `src/machines/`; this preserves model/adapter separation.

### Use XState Assign For Context Changes [ACTIVE]
Use `assign()` for machine context updates instead of direct mutation.

### Keep Generated Coverage Inclusive [ACTIVE]
Default shortest-path coverage includes terminal error paths unless a reviewed requirement narrows the suite.

### Extend Stub Fixtures With Page API Growth [ACTIVE]
When page objects call new Playwright APIs, update `createMockPage` or `createMockLocator` so stub runs remain useful.

### Refresh Derived Inventories After Artifact Changes [ACTIVE]
Regenerate and validate CODEMAP counts after documentation or pattern artifacts change during initialization.

### Remove Superseded Orchestration Layers [ACTIVE]
When specs execute graph paths directly, remove unused wrapper runners and strategy machines so dependency type changes cannot break dead code.

### Remove Isolated Subsystems Atomically [ACTIVE]
When a subsystem has no active runtime consumers, remove its code, entry points, tests, configuration, and current documentation together so no dead contracts remain.

## What Worked

### <Generalized What Worked> [ACTIVE|RETIRED]
[Root cause, Reasons, Problems]

### Pattern Docs For Contributor-Facing Repetition [ACTIVE]
Page object, graph spec, journey machine, action-map, and config-loader patterns capture repeated contributor contracts without duplicating architecture docs.

### Overlay Dismissal Centralization [ACTIVE]
Centralizing app overlay dismissal keeps page objects focused and prevents repeated live storefront workarounds.

## What Failed

### <Generalized What Failed> [ACTIVE|RETIRED]
[Hypothesis, Root cause, Reasons, Problems]

### URL-Only Checkout Waiting Was Too Weak [ACTIVE]
Prefer visible cart badge or guest form readiness over relying solely on checkout URL redirects.

### Unused Strategy Layer Hid Type Drift [ACTIVE]
The unreferenced walk-strategy and runner remained after specs moved to direct `testPath()` execution, adding compiler failures and maintenance surface without runtime value.

## Discoveries

### <Generalized Discovery> [ACTIVE|RETIRED]
[Usage, Reasons, Problems]

### Built-In CODEMAP Only [ACTIVE]
Workspace initialization selected built-in CODEMAP only; do not assume external graph or LSP tools are available.

### Root-Only TypeScript Scope [ACTIVE]
Root source/config inventory is 27 TypeScript files: 26 under `src/` and `tests/`, plus `playwright.config.ts`.
