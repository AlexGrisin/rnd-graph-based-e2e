Assumptions and unknowns for `rnd-graph-based-e2e`.
Purpose: track facts that need validation before they become durable requirements.
Content: each entry states the assumption/unknown, confidence, evidence, and the target file to update when resolved.
Style: factual, confidence-qualified, concise; do not store credentials or secret-shaped values.

## Assumptions

### A1 - npm remains the package manager

- Confidence: High.
- Evidence: `package-lock.json` exists and `package.json` defines npm scripts.
- Resolve into: `docs/TECHSTACK.md`, `docs/ARCHITECTURE.md`.

### A2 - Browser-free stub runs are sufficient for graph and wiring smoke

- Confidence: High.
- Evidence: Playwright `stub` project runs the auth, shopping, store-lookup, and evaluator specs with log-only actions or deterministic fixtures.
- Resolve into: `docs/ARCHITECTURE.md`, `docs/TODO.md` if broader non-browser validation is requested.

### A3 - Shopping live actions use stable discovery behavior

- Confidence: High.
- Evidence: the live adapters use a fixed POC search term and category navigation before opening the first product listing.
- Resolve into: `docs/CONTEXT.md`, `docs/PATTERNS/action-map.md`.

## Decisions

- Page objects live under `tests/support/pages/`, not `src/`.
- Event-to-browser glue lives under `tests/support/actions/`.
- XState journey machines must stay Playwright-free.
- Built-in CODEMAP is the only code map backend selected for this initialization.
- No CI system or repository quality gate is selected for the POC at this stage.
- The POC supports both shortest-path traversal and exploration-loop traversal.
- Live storefront `app` test failures fail immediately; no flake-tolerance policy is defined beyond the first observed failure.
- `gain.json` keeps unresolved SDLC-system fields as placeholders until concrete systems are chosen.
