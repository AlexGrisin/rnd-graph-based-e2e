# Playwright MCP Execution

Read this reference before browser exploration.

- Use only available Playwright MCP browser tools. Do not bypass the UI with hidden HTTP calls, guessed routes, source shortcuts, script evaluation, or invented selectors.
- Resolve targets from the current accessibility snapshot using roles, names, labels, values, and current refs. Never invent an element or value.
- Snapshot refs are ephemeral. After navigation, submission, modal changes, or asynchronous updates, take a new snapshot and resolve the next target again.
- Translate observed targets into replayable page-object locators before operating them. Persist a role and accessible name, label, placeholder, stable text, observed test ID, or explicit CSS fallback only in the owning page object; never persist the MCP ref.
- Use only caller-provided or approved data. Never fabricate credentials, payment details, personal data, OTPs, or secrets.
- Wait for observable conditions rather than arbitrary sleeps.
- Treat new tabs, dialogs, permissions, downloads, uploads, and cross-origin navigation as authorization boundaries.
- If the page changes before an operation, refresh and retry target resolution once. Do not repeatedly click, submit, refresh, or retry a potentially mutating action.
- Keep interaction evidence in the trace or run result, not the XState machine.
- Treat the browser session as owned by this invocation unless explicitly declared externally managed.
- After source changes are safely applied or the draft is reported, call `browser_close` on every exit path. If closing fails, retain the original outcome, record a warning, and retry at most once.
