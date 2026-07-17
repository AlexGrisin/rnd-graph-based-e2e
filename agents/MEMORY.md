Agent memory for rnd-graph-based-e2e.

## Conventions

- Keep XState machines in `src/machines/` without Playwright imports.
- Page objects belong in `tests/support/pages/`.
- Event→browser glue belongs in `tests/support/actions/`.

## Preventive rules

- Do not put Playwright locators inside `src/` — breaks model/engine separation.
- Use `assign()` for XState context mutations, not direct mutation.
- Default coverage runs all `getShortestPaths` results, including the `error` terminal path (the error-path filter was removed).
- Extend stub `createMockPage` / `createMockLocator` whenever new page objects call extra Playwright APIs (e.g. `getByTestId`).
- Dismiss Exponea subscription overlays in addition to OneTrust/push before PDP clicks.
- Prefer waiting for cart badge / guest form visibility over relying solely on checkout URL redirects.
