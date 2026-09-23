import type { Page, TestInfo } from '@playwright/test';
import type { MbtVerifiedStep } from '../../../src/mbt/types.js';
import type { JudgeEvidence, JudgeResult, LlmJudge } from './llm-judge.js';

const MAX_SCREENSHOTS = 5;

export interface PathEvaluator {
  run<T>(
    terminalState: string,
    execute: (
      onStepCompleted: (step: MbtVerifiedStep) => Promise<void>,
    ) => Promise<T>,
  ): Promise<T>;
}

type PathEvaluatorOptions = {
  page: Page;
  testInfo: TestInfo;
  judge: LlmJudge;
};

export function createNoopPathEvaluator(): PathEvaluator {
  return {
    async run(_terminalState, execute) {
      return execute(async () => undefined);
    },
  };
}

export function createPathEvaluator({
  page,
  testInfo,
  judge,
}: PathEvaluatorOptions): PathEvaluator {
  const steps: MbtVerifiedStep[] = [];
  const screenshots: JudgeEvidence['screenshots'] = [];

  async function captureScreenshot(eventType: string, expectedState: string) {
    if (screenshots.length >= MAX_SCREENSHOTS) {
      return;
    }

    try {
      const image = await page.locator('main').screenshot({
        animations: 'disabled',
        mask: [page.locator('input, textarea, [contenteditable="true"]')],
      });
      const label =
        String(screenshots.length + 1).padStart(2, '0') +
        '-' +
        eventType.toLowerCase() +
        '-' +
        expectedState;

      screenshots.push({ label, image });
      await testInfo.attach(label, {
        body: image,
        contentType: 'image/png',
      });
    } catch {
      // Evidence collection is advisory and must not hide the test result.
    }
  }

  async function finalize(status: JudgeEvidence['status']) {
    const evidence: JudgeEvidence = { status, steps, screenshots };

    await safelyAttach(testInfo, 'llm-judge-route', {
      status,
      steps,
      screenshotCount: screenshots.length,
    });

    const result = await safelyJudge(judge, evidence);
    const { rawResponse, ...verdict } = result;
    await safelyAttach(testInfo, 'llm-judge-result', verdict);
    if (rawResponse !== undefined) {
      await safelyAttach(testInfo, 'llm-judge-raw-response', rawResponse);
    }
    log(
      'verdict=' +
        verdict.verdict +
        ' confidence=' +
        verdict.confidence +
        ' findings=' +
        verdict.findings.join(','),
    );
  }

  return {
    async run(terminalState, execute) {
      try {
        const result = await execute(async (step) => {
          steps.push(step);
          await captureScreenshot(step.eventType, step.expectedState);
        });

        if (steps.length === 0) {
          steps.push({
            index: 0,
            eventType: 'INITIAL',
            expectedState: terminalState,
          });
          await captureScreenshot('INITIAL', terminalState);
        }

        await finalize('passed');
        return result;
      } catch (error) {
        await captureScreenshot('FAILURE', 'failure');
        await finalize('failed');
        throw error;
      }
    },
  };
}

function log(message: string) {
  console.log('[llm-judge] ' + message);
}

async function safelyAttach(testInfo: TestInfo, name: string, value: unknown) {
  try {
    const body = JSON.stringify(value);
    if (!body) {
      return;
    }

    await testInfo.attach(name, {
      body,
      contentType: 'application/json',
    });
  } catch {
    // Attachments supplement, rather than determine, test outcomes.
  }
}

async function safelyJudge(
  judge: LlmJudge,
  evidence: JudgeEvidence,
): Promise<JudgeResult> {
  try {
    return await judge.evaluate(evidence);
  } catch {
    return {
      verdict: 'inconclusive',
      confidence: 0,
      findings: ['missing_evidence'],
    };
  }
}
