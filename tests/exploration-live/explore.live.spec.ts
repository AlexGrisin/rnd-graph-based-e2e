import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  explore,
  loadCoverageHints,
  writeArtifacts,
} from '../../src/exploration/index.js';
import { PlaywrightHost } from '../support/exploration/playwright-host.js';

/**
 * Live exploration proof: `explore <target>` against BASE_URL in real Chromium.
 *
 * The only input is the semantic target (env EXPLORE_TARGET, default
 * "explore pdp"). Everything else — entry, budget, policy — is internal.
 * Bounded small so it stays a quick, polite demo run.
 */

const BASE_URL = process.env.BASE_URL ?? 'https://www.beaverbrooks.co.uk/';
const TARGET = process.env.EXPLORE_TARGET ?? 'explore pdp';

test('autonomous exploration against BASE_URL', async () => {
  test.setTimeout(180_000);

  const runId = `live-${Date.now()}`;
  const outDir = join('artifacts', 'exploration', runId);
  const host = new PlaywrightHost({
    baseUrl: BASE_URL,
    evidenceDir: join(outDir, 'evidence'),
    headless: !process.env.EXPLORE_HEADED,
  });

  await host.start();
  let result;
  try {
    // Advisory hints + authored app context (both best-effort).
    const hints = await loadCoverageHints(BASE_URL).catch(() => undefined);
    const authoredContext = await readFile(
      join('config', 'app-context.md'),
      'utf8',
    ).catch(() => undefined);

    result = await explore({
      target: TARGET,
      baseUrl: BASE_URL,
      runId,
      host,
      hints,
      authoredContext,
      defaults: { maxSteps: 12, maxStates: 8, timeBudgetMs: 120_000 },
    });
  } finally {
    await host.close();
  }

  await writeArtifacts(outDir, result.artifacts);

  // eslint-disable-next-line no-console
  console.log(
    `\n[explore] "${TARGET}" → ${result.manifest.nodeCount} states, ` +
      `${result.manifest.edgeCount} transitions, ` +
      `${result.manifest.skippedCount} skipped, ` +
      `${result.recorder.issues.potentialBugs().length} potential issues, ` +
      `stop=${result.completionReason}\n[explore] artifacts: ${outDir}\n`,
  );

  // The loop reached the site, discovered at least one state, and stopped cleanly.
  expect(result.manifest.nodeCount).toBeGreaterThanOrEqual(1);
  expect(result.completionReason).toBeTruthy();
});
