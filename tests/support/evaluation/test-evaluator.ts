import type { Page, TestInfo } from '@playwright/test';
import type { MbtVerifiedStep } from '../../../src/mbt/types.js';
import type {
  JudgeEvidence,
  JudgeResult,
  LlmJudge,
  ObservationJudge,
  ObservationJudgeEvidence,
} from './judge-client.js';
import {
  formatExploratoryObservationReport,
  formatJudgeIssues,
  formatJudgeReasoning,
  formatJudgeSummary,
  formatObservationSummary,
} from './report-formatters.js';
import {
  safelyAttachImage,
  safelyAttachJson,
  safelyAttachText,
} from './test-attachments.js';
import { collectStepEvaluationIssues } from './step-evaluation-issues.js';

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
  routeJudge?: LlmJudge;
  stepJudge?: LlmJudge;
  observationJudge?: ObservationJudge;
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
  routeJudge,
  stepJudge,
  observationJudge,
}: PathEvaluatorOptions): PathEvaluator {
  const steps: MbtVerifiedStep[] = [];
  const screenshots: JudgeEvidence['screenshots'] = [];
  const stepResults: ObservationJudgeEvidence['stepResults'] = [];

  async function captureScreenshot(
    eventType: string,
    expectedState: string,
    sequenceNumber: number,
    stepIndex?: number,
  ): Promise<JudgeEvidence['screenshots'][number] | undefined> {
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
      const screenshot = {
        label,
        image,
        stepIndex,
        action: eventType,
        target: expectedState,
      };

      if (screenshots.length < MAX_SCREENSHOTS) {
        screenshots.push(screenshot);
      } else {
        screenshots[MAX_SCREENSHOTS - 1] = screenshot;
      }

      return screenshot;
    } catch {
      // Evidence collection is advisory and must not hide the test result.
      return undefined;
    }
  }

  async function finalize(status: JudgeEvidence['status']) {
    const evidence: JudgeEvidence = { status, steps, screenshots };

    for (const screenshot of screenshots) {
      await safelyAttachImage(testInfo, screenshot.label, screenshot.image);
    }

    await safelyAttachJson(testInfo, 'llm-judge-route', {
      status,
      steps,
      screenshotCount: screenshots.length,
      screenshots: screenshots.map((screenshot, imageIndex) => ({
        imageIndex,
        label: screenshot.label,
        stepIndex: screenshot.stepIndex,
        action: screenshot.action,
        target: screenshot.target,
      })),
    });

    let routeResult: JudgeResult | undefined;
    if (routeJudge) {
      const result = await safelyJudge(routeJudge, evidence);
      const { rawResponse, ...verdict } = result;
      routeResult = verdict;
      await safelyAttachJson(testInfo, 'llm-judge-result', verdict);
      if (rawResponse !== undefined) {
        await safelyAttachJson(testInfo, 'llm-judge-raw-response', rawResponse);
      }
      log(formatJudgeSummary(verdict));
      for (const issue of formatJudgeIssues(verdict)) {
        log(issue);
      }
    }

    await evaluateObservations(evidence, routeResult);
  }

  async function evaluateStep(
    step: MbtVerifiedStep,
    screenshot: JudgeEvidence['screenshots'][number] | undefined,
  ) {
    if (!stepJudge) {
      return;
    }

    const evidence: JudgeEvidence = {
      status: 'passed',
      steps: [step],
      screenshots: screenshot ? [screenshot] : [],
    };
    const stepName =
      'llm-judge-step-' + String(step.index + 1).padStart(2, '0');
    await safelyAttachJson(testInfo, stepName, {
      step,
      screenshotCount: evidence.screenshots.length,
      screenshots: evidence.screenshots.map((item, imageIndex) => ({
        imageIndex,
        label: item.label,
        action: item.action,
        target: item.target,
      })),
    });

    const result = await safelyJudge(stepJudge, evidence);
    const { rawResponse, ...verdict } = result;
    stepResults.push({ step, result: verdict, screenshot });
    await safelyAttachJson(testInfo, stepName + '-result', verdict);
    if (rawResponse !== undefined) {
      await safelyAttachJson(testInfo, stepName + '-raw-response', rawResponse);
    }

    const stepDescription =
      'step=' +
      String(step.index + 1).padStart(2, '0') +
      ' action=' +
      step.eventType +
      ' target=' +
      step.expectedState;
    log(stepDescription + ' ' + formatJudgeSummary(verdict));
    for (const reasoning of formatJudgeReasoning(verdict)) {
      log(stepDescription + ' ' + reasoning);
    }
  }

  async function evaluateObservations(
    route: JudgeEvidence,
    routeResult: JudgeResult | undefined,
  ) {
    if (!observationJudge) {
      return;
    }

    const { report, rawResponse } = await safelyObserve(observationJudge, {
      route,
      routeResult,
      stepResults,
    });
    if (report) {
      const reportWithStepIssues = {
        ...report,
        stepEvaluationIssues: collectStepEvaluationIssues(
          stepResults,
          route.screenshots,
        ),
      };
      await safelyAttachText(
        testInfo,
        'llm-judge-observations',
        formatExploratoryObservationReport(reportWithStepIssues),
      );
      await safelyAttachJson(
        testInfo,
        'llm-judge-observation-result',
        reportWithStepIssues,
      );
      log(formatObservationSummary(reportWithStepIssues));
    } else {
      log('observations=unavailable');
    }
    if (rawResponse !== undefined) {
      await safelyAttachJson(
        testInfo,
        'llm-judge-observation-raw-response',
        rawResponse,
      );
    }
  }

  return {
    async run(terminalState, execute, terminalContext) {
      try {
        const result = await execute(async (step) => {
          steps.push(step);
          const screenshot = await captureScreenshot(
            step.eventType,
            step.expectedState,
            step.index + 1,
            step.index,
          );
          await evaluateStep(step, screenshot);
        });

        if (steps.length === 0) {
          steps.push({
            index: 0,
            eventType: 'INITIAL',
            expectedState: terminalState,
            expectedContext: terminalContext,
          });
          await captureScreenshot('INITIAL', terminalState, 1, 0);
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

async function safelyObserve(
  judge: ObservationJudge,
  evidence: Parameters<ObservationJudge['evaluate']>[0],
) {
  try {
    return await judge.evaluate(evidence);
  } catch {
    return {};
  }
}
