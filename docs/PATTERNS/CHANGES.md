Changelog for `docs/PATTERNS/`.

## 2026-07-22 - Root pattern extraction refresh
- Updated `INDEX.md` to remove tables, list current pattern coverage, and record explicit skips for important uncovered modules.
- Created `machine-model.md` from `src/machines/app-auth.machine.ts` and `src/machines/app-purchase.machine.ts`.
- Created `action-map.md` from `tests/support/actions/app-auth.actions.ts`, `tests/support/actions/app-purchase.actions.ts`, and `tests/support/actions/stub-actions.ts`.
- Created `config-loader.md` from `tests/support/config/app-credentials.ts` and `tests/support/config/app-product.ts`.

## 2025-06-26 - Initial patterns
- Created `page-object.md` from `base.page.ts`, `home.page.ts`, `login.page.ts`, `my-account.page.ts`, `index.ts`, and `state-verifier.ts`.
- Created `test-spec.md` from `graph-driven.spec.ts` and `fixtures.ts`.
- Created `INDEX.md`.

## 2025-06-26 - Page object pattern revision
- Updated `page-object.md` with `<PageName>Page` naming, constructor-owned selectors, `should*` assertions, and Playwright fixtures instead of `PageRegistry`.
- Updated `test-spec.md` to align fixture contract and setup steps with the page-object revision.
