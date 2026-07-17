import { appPurchaseMachine } from '../../src/machines/app-purchase.machine.js';
import { describePath } from '../../src/mbt/graph/path-label.js';
import { getAllShortestPaths } from '../../src/mbt/graph/path-generator.js';
import { testPath } from '../../src/mbt/graph/test-model-factory.js';
import { test } from '../fixtures.js';

const paths = getAllShortestPaths(appPurchaseMachine);

test.describe('Purchase graph-driven MBT', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name === 'app') {
      await page.goto('/');
    }
  });

  for (const path of paths) {
    test(describePath(path), async ({ mbtContext, actions, stateVerifier }) => {
      await testPath(path, mbtContext, {
        actions,
        verifyState: stateVerifier,
      });
    });
  }
});
