import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  explore,
  loadCoverageHints,
  writeArtifacts,
} from '../../src/exploration/index.js';
import { PlaywrightHost } from '../support/exploration/playwright-host.js';
import { createFileChannelDecider } from '../support/exploration/file-channel-decider.js';

/** Optional per-app authored context (business rules, flows, prerequisites). */
async function loadAuthoredContext(): Promise<string | undefined> {
  return readFile(join('config', 'app-context.md'), 'utf8').catch(
    () => undefined,
  );
}

/**
 * Agent-driven live exploration: the in-session LLM makes every decision via a
 * file channel while the Node PlaywrightHost drives the real browser and records
 * faithful artifacts. No AI API key — the agent is the Claude Code session.
 *
 * Run (headed) in the background, then answer each request.json by writing
 * response.json:
 *   EXPLORE_HEADED=1 npx playwright test --project=exploration-live \
 *     tests/exploration-live/agent.live.spec.ts
 */

const BASE_URL = process.env.BASE_URL ?? 'https://www.beaverbrooks.co.uk/';
const TARGET = process.env.EXPLORE_TARGET ?? 'explore pdp';
const CHANNEL_DIR = join('artifacts', 'exploration', '_channel');

test('agent-driven exploration against BASE_URL', async () => {
  test.setTimeout(1_800_000); // 30 min — waits on the in-session agent

  const runId = `agent-${Date.now()}`;
  const outDir = join('artifacts', 'exploration', runId);
  const host = new PlaywrightHost({
    baseUrl: BASE_URL,
    evidenceDir: join(outDir, 'evidence'),
    headless: !process.env.EXPLORE_HEADED,
  });
  const { decider } = createFileChannelDecider({ dir: CHANNEL_DIR });

  await host.start();
  let result;
  try {
    const hints = await loadCoverageHints(BASE_URL).catch(() => undefined);
    const authoredContext = await loadAuthoredContext();
    result = await explore({
      target: TARGET,
      baseUrl: BASE_URL,
      runId,
      host,
      decider,
      hints,
      authoredContext,
      defaults: { maxSteps: 20, maxStates: 15, timeBudgetMs: 1_500_000 },
    });
  } finally {
    await host.close();
  }

  await writeArtifacts(outDir, result.artifacts);

  // eslint-disable-next-line no-console
  console.log(
    `\n[agent] "${TARGET}" → ${result.manifest.nodeCount} states, ` +
      `${result.manifest.edgeCount} transitions, ` +
      `${result.manifest.skippedCount} skipped, ` +
      `stop=${result.completionReason}\n[agent] artifacts: ${outDir}\n`,
  );

  expect(result.manifest.nodeCount).toBeGreaterThanOrEqual(1);
  expect(result.completionReason).toBeTruthy();
});
