import type { Page, TestInfo } from '@playwright/test';
import type { MbtVerifiedStep } from '../../../src/mbt/types.js';
import type { JudgeEvidence, JudgeResult, LlmJudge } from './judge-client.js';

const MAX_SCREENSHOTS = 5;

export interface PathEvaluator {
  run<T>(
    terminalState: string,
    execute: (
      onStepCompleted: (step: MbtVerifiedStep) => Promise<void>,
    ) => Promise<T>,
    terminalContext?: Record<string, unknown>,
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

  async function captureScreenshot(
    eventType: string,
    expectedState: string,
    sequenceNumber: number,
  ) {
    try {
      const image = await page.locator('main').screenshot({
        animations: 'disabled',
        mask: [page.locator('input, textarea, [contenteditable="true"]')],
      });
      const label =
        String(sequenceNumber).padStart(2, '0') +
        '-' +
        eventType.toLowerCase() +
        '-' +
        expectedState;
      const screenshot = { label, image };

      if (screenshots.length < MAX_SCREENSHOTS) {
        screenshots.push(screenshot);
      } else {
        screenshots[MAX_SCREENSHOTS - 1] = screenshot;
      }
    } catch {
      // Evidence collection is advisory and must not hide the test result.
    }
  }

  async function finalize(status: JudgeEvidence['status']) {
    const evidence: JudgeEvidence = { status, steps, screenshots };

    for (const screenshot of screenshots) {
      await safelyAttachImage(testInfo, screenshot.label, screenshot.image);
    }

    await safelyAttach(testInfo, 'llm-judge-route', {
      status,
      steps,
      screenshotCount: screenshots.length,
      screenshots: screenshots.map((screenshot, imageIndex) => ({
        imageIndex,
        label: screenshot.label,
      })),
    });

    const result = await safelyJudge(judge, evidence);
    const { rawResponse, ...verdict } = result;
    await safelyAttach(testInfo, 'llm-judge-result', verdict);
    if (rawResponse !== undefined) {
      await safelyAttach(testInfo, 'llm-judge-raw-response', rawResponse);
    }
    log(formatJudgeSummary(verdict));
    for (const issue of formatJudgeIssues(verdict)) {
      log(issue);
    }
  }

  return {
    async run(terminalState, execute, terminalContext) {
      try {
        const result = await execute(async (step) => {
          steps.push(step);
          await captureScreenshot(
            step.eventType,
            step.expectedState,
            step.index + 1,
          );
        });

        if (steps.length === 0) {
          steps.push({
            index: 0,
            eventType: 'INITIAL',
            expectedState: terminalState,
            expectedContext: terminalContext,
          });
          await captureScreenshot('INITIAL', terminalState, 1);
        }

        await finalize('passed');
        return result;
      } catch (error) {
        await captureScreenshot('FAILURE', 'failure', steps.length + 1);
        await finalize('failed');
        throw error;
      }
    },
  };
}

function log(message: string) {
  console.log('[llm-judge] ' + message);
}

export function formatJudgeSummary(result: JudgeResult): string {
  const metCount = result.criteria.filter(
    (criterion) => criterion.status === 'met',
  ).length;
  const issues = result.criteria
    .filter((criterion) => criterion.status !== 'met')
    .map((criterion) => criterion.criterionId + ':' + criterion.status);

  return [
    'verdict=' + result.verdict,
    'score=' + result.score,
    'confidence=' + result.confidence,
    'criteria=' + metCount + '/' + result.criteria.length,
    'reason=' + result.decisionReason,
    issues.length > 0 ? 'issues=' + issues.join(',') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatJudgeIssues(result: JudgeResult): string[] {
  if (result.verdict === 'pass') {
    return [];
  }

  return result.criteria
    .filter((criterion) => criterion.status !== 'met')
    .map((criterion) =>
      [
        'issue',
        'criterion=' + criterion.criterionId,
        'status=' + criterion.status,
        'score=' + criterion.score,
        'confidence=' + criterion.confidence,
        'reason=' + criterion.reasonCode,
        criterion.evidenceImageIndexes.length > 0
          ? 'images=' + criterion.evidenceImageIndexes.join(',')
          : 'images=none',
        'detail=' + JSON.stringify(criterion.explanation),
      ].join(' '),
    );
}

async function safelyAttachImage(
  testInfo: TestInfo,
  name: string,
  image: Buffer,
) {
  try {
    await testInfo.attach(name, {
      body: image,
      contentType: 'image/png',
    });
  } catch {
    // Attachments supplement, rather than determine, test outcomes.
  }
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
      decisionReason: 'provider_unavailable',
      score: 0,
      confidence: 0,
      findings: ['missing_evidence'],
      criteria: [],
    };
  }
}
