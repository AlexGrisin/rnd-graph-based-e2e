Changelog for docs/PATTERNS/ — tracks pattern creation and updates.

## 2025-06-26 — Initial patterns

| Action  | Pattern          | Notes                                                                                                                 |
| ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Created | `page-object.md` | Extracted from `base.page.ts`, `home.page.ts`, `login.page.ts`, `my-account.page.ts`, `index.ts`, `state-verifier.ts` |
| Created | `test-spec.md`   | Extracted from `graph-driven.spec.ts`, `fixtures.ts`                                                                  |
| Created | `INDEX.md`       | Initial index                                                                                                         |

## 2025-06-26 — Page object pattern revision (user feedback)

| Action  | Pattern          | Notes                                                                                                               |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Updated | `page-object.md` | `<PageName>Page` naming; selectors in constructor; `should*` assertions; Playwright fixtures replace `PageRegistry` |
| Updated | `test-spec.md`   | Fixture contract and setup steps aligned with page-object revision                                                  |
