import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  buildGuardrailScript,
  loadSiteGuardrails,
} from '../support/exploration/guardrails.js';

/**
 * Browser-free tests for the page-side guardrail generator (Increment 1).
 *
 * `buildGuardrailScript` is pure, so its structure is asserted here without a
 * browser. The committed per-site init script (referenced by `.mcp.json` via
 * `--init-script`) is kept in lockstep with the generator + site data via a
 * freshness check; run with `UPDATE_GUARDRAILS=1` to (re)generate it.
 */

const SITE_JSON = join('config', 'guardrails', 'beaverbrooks.json');
const INIT_JS = join('config', 'guardrails', 'beaverbrooks.init.js');

test('guardrail script embeds consequence patterns + overlay handling', () => {
  const script = buildGuardrailScript({
    overlayAcceptSelectors: ['#AcceptCookies'],
    overlayRemoveSelectors: ['#CookieDialog'],
    extraConsequentialNames: ['wire transfer'],
  });

  // Generated banner naming the source of truth, then the self-invoking runtime.
  expect(script.startsWith('// GENERATED')).toBeTruthy();
  expect(script).toContain('consequence-policy.ts');
  expect(script).toContain('(function guardrailRuntime');
  expect(script).toContain('MutationObserver');
  expect(script).toContain('data-explore-blocked');

  // Site-specific data is embedded.
  expect(script).toContain('#AcceptCookies');
  expect(script).toContain('#CookieDialog');
  expect(script).toContain('wire transfer');

  // Generic consequence reasons come from the shared CONSEQUENCE_PATTERNS.
  expect(script).toContain('order placement');
  expect(script).toContain('payment');
});

test('committed Beaverbrooks init script is current', async () => {
  const site = await loadSiteGuardrails(SITE_JSON);
  const expected = `${buildGuardrailScript(site)}\n`;

  if (process.env.UPDATE_GUARDRAILS) {
    await writeFile(INIT_JS, expected, 'utf8');
  }

  const actual = await readFile(INIT_JS, 'utf8').catch(() => '');
  expect(
    actual,
    'stale/missing — run: UPDATE_GUARDRAILS=1 npx playwright test --project=exploration guardrails',
  ).toBe(expected);
});
