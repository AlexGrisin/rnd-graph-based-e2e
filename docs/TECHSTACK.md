Tech stack for `rnd-graph-based-e2e`.

## Runtime

| Area | Technology | Evidence |
| --- | --- | --- |
| Language | TypeScript 5.x | `typescript` direct dev dependency |
| Runtime | Node.js with ESM modules | `"type": "module"` |
| Compiler mode | ES2022 + NodeNext, `noEmit`, `strict` | `tsconfig.json` |

## Test and MBT stack

| Area | Technology | Evidence |
| --- | --- | --- |
| Browser automation | Playwright Test | `@playwright/test` direct dev dependency |
| Model-based testing | XState v5 graph traversal | `xstate` direct dependency; architecture docs reference `xstate/graph` utilities |
| Env loading | `dotenv` | `playwright.config.ts` loads `.env` before config creation |

## Execution model

- Single-package npm workspace with `package-lock.json`
- Two Playwright projects: `stub` and `app`
- Test sources under `tests/`; MBT engine and machines under `src/`
- Page-object support layer under `tests/support/`

## Key conventions

- State machines live in `src/machines/`
- MBT graph and runner utilities live in `src/mbt/`
- TypeScript includes `src/**/*.ts`, `tests/**/*.ts`, and `playwright.config.ts`
