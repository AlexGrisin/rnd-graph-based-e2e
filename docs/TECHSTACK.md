Tech stack for rnd-graph-based-e2e.

## Runtime

| Technology | Version | Purpose  |
| ---------- | ------- | -------- |
| Node.js    | ≥ 20    | Runtime  |
| TypeScript | 5.x     | Language |

## Dependencies

| Package          | Purpose                         |
| ---------------- | ------------------------------- |
| xstate           | State machines, graph utilities |
| @playwright/test | E2E test runner                 |

## Tooling

- npm (package manager)
- Playwright CLI (browser install, test execution)

## Conventions

- ESM (`"type": "module"`)
- `*.machine.ts` suffix for XState machines
- Page objects under `tests/support/pages/`
