import { appAuthMachine } from '../../src/machines/app-auth.machine.js';
import {
  describePath,
  getSnapshotContext,
  getSnapshotStateValue,
} from '../../src/mbt/graph/path-label.js';
import { getAllShortestPaths } from '../../src/mbt/graph/path-generator.js';
import { testPath } from '../../src/mbt/graph/test-model-factory.js';
import { dismissAppOverlays } from '../support/app/overlays.js';
import { test } from '../fixtures.js';

const paths = getAllShortestPaths(appAuthMachine);

test.describe('Auth graph-driven', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name === 'app') {
      await page.goto('/');
      await dismissAppOverlays(page);
    }
  });

  for (const path of paths) {
    test(
      describePath(path),
      async ({ mbtContext, actions, stateVerifier, pathEvaluator }) => {
        await pathEvaluator.run(
          getSnapshotStateValue(path.state),
          async (onStepCompleted) => {
            await testPath(path, mbtContext, {
              actions,
              verifyState: stateVerifier,
              onStepCompleted,
            });
          },
          getSnapshotContext(path.state),
        );
      },
    );
  }
});
