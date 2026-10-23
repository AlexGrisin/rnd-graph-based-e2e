# Invocation

Read this reference before browser interaction.

## Required inputs

Obtain these inputs before browser interaction:

- `base_url` and allowed domains;
- environment and destructive-action policy;
- target machine path, such as `src/machines/app-shopping.machine.ts`;
- whether the target is a new journey or an extension of an existing machine;
- output mode: `integrated` (default) or `model-only`;
- approved test data and authentication state, when a safe action needs them;
- scope, budget, and expected source state or restoration method; and
- whether the browser session is externally managed.

Accept concise natural language. For example:

```text
Explore the signed-out shopping journey at the configured BASE_URL.
Target machine: src/machines/app-shopping.machine.ts.
Mode: integrated.
Allowed domain: the configured application host.
Environment: test.
Forbidden: purchases, payment, account changes, personal-data submission.
Budget: six semantic actions.
Restore to the home state before sibling actions.
```

Do not read local credential files or begin without an allowed-domain boundary and destructive-action policy. If the expected source state cannot be restored or recognized, stop rather than improvising navigation.

## Output modes

`integrated` is the default. It updates the target machine and every repository adapter required for generated stub and live tests. Use `model-only` only when the caller explicitly wants a pure machine proposal and accepts that browser wiring remains incomplete.

For a new journey, derive the machine path as `src/machines/<journey>.machine.ts` only after confirming the stable journey name. For an existing journey, preserve the current machine ID, state names, events, and transitions unless a removal is explicitly approved. Neither mode creates YAML, a generated graph, sidecars, or an assembler output.
