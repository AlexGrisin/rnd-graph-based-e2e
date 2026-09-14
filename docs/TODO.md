Workspace TODOs for `rnd-graph-based-e2e`.
Purpose: track durable follow-up work that is too large or cross-cutting for inline comments.
Content: each entry header names priority, when, what, and where.
Style: concise, factual, phase-friendly; implementation history belongs in `agents/IMPLEMENTATION.md`.

## High - Future setup - Replace SDLC placeholders when systems are chosen - `gain.json`

`gain.json` intentionally keeps placeholder values for unresolved SDLC systems during the current POC. Replace them only when concrete systems are selected.

## Medium - Future setup - Add CI automation if the POC graduates - repository automation

No CI workflow or repository quality gate is selected for the current POC. Add one only if the repository moves beyond the current manual-validation stage.

## Medium - Future setup - Narrow traversal defaults if a production policy is needed - `src/mbt/graph/`

The POC currently supports both shortest-path traversal and exploration-loop traversal. Document stricter defaults only if a later phase requires a single mandated execution policy.

## Medium - Future setup - Add richer live-store stability policy only if needed - `tests/support/`

Live `app` tests fail on the first observed storefront failure. Add broader retry or tolerance rules only if later execution policy requires them.
