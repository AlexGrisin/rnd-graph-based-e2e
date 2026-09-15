import { appShoppingMachine } from '../../src/machines/app-shopping.machine.js';
import { describePath } from '../../src/mbt/graph/path-label.js';
import { getAllCyclicPaths } from '../../src/mbt/graph/path-generator.js';
import { testPath } from '../../src/mbt/graph/test-model-factory.js';
import { dismissAppOverlays } from '../support/app/overlays.js';
import { test } from '../fixtures.js';

const paths = getAllCyclicPaths(appShoppingMachine);

test.describe('Shopping graph-driven', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name === 'app') {
      await page.goto('/');
      await dismissAppOverlays(page);
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
