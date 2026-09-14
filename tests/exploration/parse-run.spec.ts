import { join } from 'node:path';
import { test } from '@playwright/test';
import { writeArtifacts } from '../../src/exploration/index.js';
import { parseTrace } from '../support/exploration/trace-parser.js';

/**
 * Task runner (NOT a unit test): turns a recorded Playwright-MCP `trace.zip` into
 * the exploration artifacts. Skipped unless `EXPLORE_TRACE` is set, so it is inert
 * in the normal browser-free suite.
 *
 * Invoked by the `/explore` skill after the MCP run finishes tracing:
 *   EXPLORE_TRACE=<zip> EXPLORE_TARGET=pdp EXPLORE_OUT=<dir> EXPLORE_RUN_ID=<id> \
 *     npx playwright test --project=exploration parse-run
 *
 * (Runner-spec rather than a CLI because the repo has no standalone TS runner;
 * this reuses Playwright's TS toolchain with zero new dependency.)
 */
const TRACE = process.env.EXPLORE_TRACE;

test('parse MCP trace → exploration artifacts', async ({ baseURL }) => {
  test.skip(!TRACE, 'set EXPLORE_TRACE=<trace.zip> to run the parser');

  if (!baseURL) {
    throw new Error(
      'Missing BASE_URL. Set it in .env (see .env.example) before parsing a trace.',
    );
  }

  const outDir =
    process.env.EXPLORE_OUT ?? join('artifacts', 'exploration', 'parsed');
  const target = process.env.EXPLORE_TARGET ?? 'pdp';
  const artifacts = await parseTrace(TRACE!, {
    target,
    baseUrl: baseURL,
    runId: process.env.EXPLORE_RUN_ID ?? `parsed-${target}`,
  });
  const written = await writeArtifacts(outDir, artifacts);

  // eslint-disable-next-line no-console
  console.log(
    `\n[parse] "${target}" → ${artifacts.manifest.nodeCount} states, ` +
      `${artifacts.manifest.edgeCount} transitions, ` +
      `${artifacts.manifest.skippedCount} skipped, ` +
      `${artifacts.issues.length} issues\n[parse] artifacts: ${outDir}\n` +
      written.map((w) => `  - ${w}`).join('\n') +
      '\n',
  );
});
