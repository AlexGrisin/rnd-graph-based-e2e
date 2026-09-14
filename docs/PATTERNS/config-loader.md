Reusable test-runtime config loader pattern for this workspace.

## Name

Env Config Loader

## Description

Reads environment-backed runtime inputs for browser tests from `tests/support/config/`. Each loader exposes a typed return shape and either fails fast for required values or applies a local default for optional values.

Use when:

- A support action or page object needs test runtime input from the environment
- The POC gains another configurable path, credential, or test-only toggle
- You need one typed entry point instead of scattering `process.env.*` reads

Do not read environment variables directly in specs or page objects when a shared support module can own the contract.

## Conventions

- Export a dedicated return type for the config payload.
- Export one `get*()` function per concern.
- Read and normalize `process.env.*` inside that function.
- Throw a descriptive error when required variables are missing.
- Keep defaults local to the module when the value is optional.

## Template

```typescript
export type ExampleConfig = {
  featurePath: string;
};

const DEFAULT_FEATURE_PATH = '/demo/path';

export function getExampleConfig(): ExampleConfig {
  const featurePath = process.env.FEATURE_PATH?.trim() || DEFAULT_FEATURE_PATH;

  if (!featurePath) {
    throw new Error('Missing FEATURE_PATH.');
  }

  return { featurePath };
}
```

## Reference implementations

- `tests/support/config/app-credentials.ts` - required credential loader that throws when email or password is missing
- `tests/support/config/app-product.ts` - required PDP path loader for the configured live shopping target
