import type { Page, TestInfo } from '@playwright/test';
import { appAuthMachine } from '../../src/machines/app-auth.machine.js';
import { appShoppingMachine } from '../../src/machines/app-shopping.machine.js';
import { getAllShortestPaths } from '../../src/mbt/graph/path-generator.js';
import { testPath } from '../../src/mbt/graph/test-model-factory.js';
import type { MbtVerifiedStep } from '../../src/mbt/types.js';
import { test, expect } from '../fixtures.js';
import {
  createLlmGatewayJudge,
  type JudgeEvidence,
  type JudgeResult,
  type LlmJudge,
  type ObservationJudge,
  type ObservationJudgeEvidence,
} from '../support/evaluation/judge-client.js';
import { createLlmGatewayObservationJudge } from '../support/evaluation/observation-judge-client.js';
import type { ExploratoryObservationReport } from '../support/evaluation/rubrics/exploratory-observation.rubric.js';
import { pathEvidenceRubric } from '../support/evaluation/rubrics/path-evidence.rubric.js';
import { stepEvidenceRubric } from '../support/evaluation/rubrics/step-evidence.rubric.js';
import {
  formatJudgeIssues,
  formatJudgeReasoning,
  formatJudgeSummary,
} from '../support/evaluation/report-formatters.js';
import { createPathEvaluator } from '../support/evaluation/test-evaluator.js';
import { formatSuiteObservationReport } from '../support/reporting/llm-observation-reporter.js';

test.describe('LLM path evaluator', () => {
  test('uses the structured gateway result without a live request', async () => {
    let requestUrl = '';
    let requestBody = '';
    const judge = createLlmGatewayJudge(
      {
        gatewayUrl: 'https://api.openai.com/v1',
        token: 'test-token',
        model: 'gpt-4o-mini',
        modelVersion: 'unversioned-alias',
        attachRawResponse: true,
        timeoutMs: 100,
      },
      pathEvidenceRubric,
      async (url, init) => {
        requestUrl = url;
        requestBody = String(init.body);
        return new Response(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      criteria: createAssessments(1, 0.8),
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      },
    );

    const result = await judge.evaluate({
      status: 'passed',
      steps: [
        {
          index: 0,
          eventType: 'GO_LOGIN',
          expectedState: 'login',
          expectedContext: { authenticated: false },
        },
      ],
      screenshots: [
        {
          label: '01-go_login-login',
          image: Buffer.from('image'),
          stepIndex: 0,
          action: 'GO_LOGIN',
          target: 'login',
        },
      ],
    });

    const parsedRequest = JSON.parse(requestBody) as {
      input: Array<{ content: Array<{ text?: string }> }>;
    };
    const parsedEvidence = JSON.parse(
      parsedRequest.input[1]?.content[0]?.text ?? '',
    ) as Record<string, unknown>;

    expect(requestUrl).toBe('https://api.openai.com/v1/responses');
    expect(requestBody).toContain('GO_LOGIN');
    expect(requestBody).toContain('route-node-correspondence');
    expect(requestBody).toContain('evidenceImageIndexes');
    expect(requestBody).toContain('explanation');
    expect(parsedEvidence).toMatchObject({
      finalExpectedState: 'login',
      finalExpectedContext: { authenticated: false },
      route: [
        expect.objectContaining({
          expectedContext: { authenticated: false },
        }),
      ],
      screenshots: [
        {
          imageIndex: 0,
          label: '01-go_login-login',
          action: 'GO_LOGIN',
          stepIndex: 0,
          target: 'login',
        },
      ],
    });
    expect(result).toMatchObject({
      verdict: 'pass',
      decisionReason: 'pass_threshold_met',
      score: 1,
      confidence: 0.8,
      findings: ['route_supported'],
      criteria: expect.arrayContaining([
        expect.objectContaining({
          criterionId: 'route-node-correspondence',
        }),
      ]),
      rawResponse: {
        output: expect.any(Array),
      },
    });
  });

  test('returns inconclusive when the provider rejects the request', async () => {
    const judge = createLlmGatewayJudge(
      {
        gatewayUrl: 'https://api.openai.com/v1',
        token: 'test-token',
        model: 'gpt-4o-mini',
        modelVersion: 'unversioned-alias',
        attachRawResponse: false,
        timeoutMs: 100,
      },
      pathEvidenceRubric,
      async () => new Response('', { status: 500 }),
    );

    await expect(
      judge.evaluate({ status: 'passed', steps: [], screenshots: [] }),
    ).resolves.toEqual({
      verdict: 'inconclusive',
      decisionReason: 'provider_unavailable',
      score: 0,
      confidence: 0,
      findings: ['missing_evidence'],
      criteria: [],
    });
  });

  test('uses a structured exploratory observation report without a live request', async () => {
    let requestBody = '';
    const judge = createLlmGatewayObservationJudge(
      {
        gatewayUrl: 'https://api.openai.com/v1',
        token: 'test-token',
        model: 'gpt-4o-mini',
        modelVersion: 'unversioned-alias',
        attachRawResponse: false,
        timeoutMs: 100,
      },
      async (_url, init) => {
        requestBody = String(init.body);
        return new Response(
          JSON.stringify({ output_text: JSON.stringify(observationReport()) }),
          { status: 200 },
        );
      },
    );

    const result = await judge.evaluate({
      route: {
        status: 'passed',
        steps: [
          {
            index: 0,
            eventType: 'GO_LOGIN',
            expectedState: 'login',
          },
        ],
        screenshots: [
          {
            label: '01-go_login-login',
            image: Buffer.from('image'),
            stepIndex: 0,
            action: 'GO_LOGIN',
            target: 'login',
          },
        ],
      },
      routeResult: passingJudgeResult(),
      stepResults: [
        {
          step: {
            index: 0,
            eventType: 'GO_LOGIN',
            expectedState: 'login',
          },
          result: passingJudgeResult(),
          screenshot: {
            label: '01-go_login-login',
            image: Buffer.from('image'),
            stepIndex: 0,
            action: 'GO_LOGIN',
            target: 'login',
          },
        },
      ],
    });

    expect(requestBody).toContain('stepJudgments');
    expect(requestBody).toContain('routeVerdict');
    expect(requestBody).toContain('wentWell');
    expect(requestBody).toContain('routeScreenshotIndex');
    expect(result.report).toEqual(observationReport());
  });

  test('applies the rubric threshold band deterministically', async () => {
    const judge = createLlmGatewayJudge(
      {
        gatewayUrl: 'https://api.openai.com/v1',
        token: 'test-token',
        model: 'gpt-4o-mini',
        modelVersion: 'unversioned-alias',
        attachRawResponse: false,
        timeoutMs: 100,
      },
      pathEvidenceRubric,
      async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              criteria: createAssessments(0.6, 0.9),
            }),
          }),
          { status: 200 },
        ),
    );

    await expect(
      judge.evaluate({ status: 'passed', steps: [], screenshots: [] }),
    ).resolves.toMatchObject({
      verdict: 'inconclusive',
      decisionReason: 'score_between_thresholds',
      score: 0.6,
      confidence: 0.9,
      findings: ['missing_evidence'],
    });
  });

  test('caps screenshots and keeps the judge result advisory', async () => {
    let capturedEvidence: JudgeEvidence | undefined;
    const attachments: Array<{ name: string; contentType: string }> = [];
    const judge: LlmJudge = {
      async evaluate(evidence) {
        capturedEvidence = evidence;
        return {
          verdict: 'inconclusive',
          decisionReason: 'provider_unavailable',
          score: 0,
          confidence: 0,
          findings: ['missing_evidence'],
          criteria: [],
          rawResponse: { output: 'debug response' },
        };
      },
    };
    const screenshotLocator = {
      screenshot: async () => Buffer.from('masked-image'),
    };
    const evaluator = createPathEvaluator({
      page: {
        locator: () => screenshotLocator,
      } as unknown as Page,
      testInfo: {
        attach: async (
          name: string,
          options: Parameters<TestInfo['attach']>[1],
        ) => {
          attachments.push({
            name,
            contentType: options?.contentType ?? 'unknown',
          });
        },
      } as unknown as TestInfo,
      routeJudge: judge,
    });

    await evaluator.run('done', async (onStepCompleted) => {
      for (let index = 0; index < 6; index += 1) {
        await onStepCompleted({
          index,
          eventType: 'NEXT',
          expectedState: 'state' + index,
        });
      }
    });

    expect(capturedEvidence?.screenshots).toHaveLength(5);
    expect(capturedEvidence?.screenshots.at(-1)?.label).toBe('06-next-state5');
    expect(
      attachments.filter((item) => item.contentType === 'image/png'),
    ).toHaveLength(5);
    expect(attachments.map((item) => item.name)).toContain('llm-judge-result');
    expect(attachments.map((item) => item.name)).toContain(
      'llm-judge-raw-response',
    );
  });

  test('preserves a deterministic failure after attaching partial evidence', async () => {
    let capturedEvidence: JudgeEvidence | undefined;
    const judge: LlmJudge = {
      async evaluate(evidence) {
        capturedEvidence = evidence;
        return {
          verdict: 'inconclusive',
          decisionReason: 'provider_unavailable',
          score: 0,
          confidence: 0,
          findings: ['missing_evidence'],
          criteria: [],
        };
      },
    };
    const evaluator = createPathEvaluator({
      page: {
        locator: () => ({
          screenshot: async () => Buffer.from('masked-image'),
        }),
      } as unknown as Page,
      testInfo: {
        attach: async () => undefined,
      } as unknown as TestInfo,
      routeJudge: judge,
    });
    const deterministicFailure = new Error('deterministic failure');

    await expect(
      evaluator.run('done', async () => {
        throw deterministicFailure;
      }),
    ).rejects.toBe(deterministicFailure);

    expect(capturedEvidence?.status).toBe('failed');
    expect(capturedEvidence?.steps).toEqual([]);
  });

  test('judges every verified step inline before the next action', async () => {
    const stepEvidence: JudgeEvidence[] = [];
    const executionOrder: string[] = [];
    const attachments: string[] = [];
    const evaluator = createPathEvaluator({
      page: {
        locator: () => ({
          screenshot: async () => Buffer.from('masked-image'),
        }),
      } as unknown as Page,
      testInfo: {
        attach: async (name: string) => {
          attachments.push(name);
        },
      } as unknown as TestInfo,
      stepJudge: {
        async evaluate(evidence) {
          stepEvidence.push(evidence);
          executionOrder.push('judge:' + evidence.steps[0]?.eventType);
          return {
            verdict: 'pass',
            decisionReason: 'pass_threshold_met',
            score: 1,
            confidence: 1,
            findings: ['route_supported'],
            criteria: createStepAssessments(1, 1),
          };
        },
      },
    });

    await evaluator.run('done', async (onStepCompleted) => {
      await onStepCompleted({
        index: 0,
        eventType: 'GO_LOGIN',
        expectedState: 'login',
        expectedContext: { username: '' },
      });
      executionOrder.push('after:GO_LOGIN');
      await onStepCompleted({
        index: 1,
        eventType: 'SUBMIT_WITHOUT_CREDENTIALS',
        expectedState: 'credentialsRequired',
      });
      executionOrder.push('after:SUBMIT_WITHOUT_CREDENTIALS');
    });

    expect(executionOrder).toEqual([
      'judge:GO_LOGIN',
      'after:GO_LOGIN',
      'judge:SUBMIT_WITHOUT_CREDENTIALS',
      'after:SUBMIT_WITHOUT_CREDENTIALS',
    ]);
    expect(stepEvidence).toHaveLength(2);
    expect(stepEvidence[0]).toMatchObject({
      status: 'passed',
      steps: [
        {
          eventType: 'GO_LOGIN',
          expectedState: 'login',
          expectedContext: { username: '' },
        },
      ],
      screenshots: [
        {
          label: '01-go_login-login',
          stepIndex: 0,
          action: 'GO_LOGIN',
          target: 'login',
        },
      ],
    });
    expect(stepEvidence[1]).toMatchObject({
      steps: [{ eventType: 'SUBMIT_WITHOUT_CREDENTIALS' }],
      screenshots: [
        {
          label: '02-submit_without_credentials-credentialsRequired',
          stepIndex: 1,
          action: 'SUBMIT_WITHOUT_CREDENTIALS',
          target: 'credentialsRequired',
        },
      ],
    });
    expect(attachments).toEqual(
      expect.arrayContaining([
        'llm-judge-step-01',
        'llm-judge-step-01-result',
        'llm-judge-step-02',
        'llm-judge-step-02-result',
      ]),
    );
  });

  test('attaches a synthesized observation report without changing the test outcome', async () => {
    let observationEvidence: ObservationJudgeEvidence | undefined;
    const attachments: Array<{
      name: string;
      contentType: string;
      body?: string;
    }> = [];
    const passingJudge: LlmJudge = {
      async evaluate() {
        return passingJudgeResult();
      },
    };
    const observationJudge: ObservationJudge = {
      async evaluate(evidence) {
        observationEvidence = evidence;
        return { report: observationReport() };
      },
    };
    const stepJudge: LlmJudge = {
      async evaluate() {
        return failedStepJudgeResult();
      },
    };
    const evaluator = createPathEvaluator({
      page: {
        locator: () => ({
          screenshot: async () => Buffer.from('masked-image'),
        }),
      } as unknown as Page,
      testInfo: {
        attach: async (
          name: string,
          options: Parameters<TestInfo['attach']>[1],
        ) => {
          attachments.push({
            name,
            contentType: options?.contentType ?? 'unknown',
            body: typeof options?.body === 'string' ? options.body : undefined,
          });
        },
      } as unknown as TestInfo,
      routeJudge: passingJudge,
      stepJudge,
      observationJudge,
    });

    await expect(
      evaluator.run('done', async (onStepCompleted) => {
        await onStepCompleted({
          index: 0,
          eventType: 'GO_LOGIN',
          expectedState: 'login',
        });
      }),
    ).resolves.toBeUndefined();

    expect(observationEvidence).toMatchObject({
      route: { status: 'passed', steps: [{ eventType: 'GO_LOGIN' }] },
      routeResult: { verdict: 'pass' },
      stepResults: [
        {
          step: { eventType: 'GO_LOGIN' },
          result: { verdict: 'fail' },
        },
      ],
    });
    const reportAttachment = attachments.find(
      (attachment) => attachment.name === 'llm-judge-observations',
    );
    expect(reportAttachment).toMatchObject({
      contentType: 'text/markdown',
      body: expect.stringContaining(
        '## Potential issues detected by step evaluation',
      ),
    });
    expect(reportAttachment?.body).toContain(
      'Step 1 (GO_LOGIN → login): target-state-visible was not met.',
    );
    const resultAttachment = attachments.find(
      (attachment) => attachment.name === 'llm-judge-observation-result',
    );
    expect(resultAttachment?.body).toContain('stepEvaluationIssues');
    expect(resultAttachment?.body).toContain('target-state-visible');
  });

  test('formats all test observations into a suite report', () => {
    const report = formatSuiteObservationReport([
      {
        title: 'app › Auth graph-driven › login',
        status: 'passed',
        report: observationReport(),
      },
    ]);

    expect(report).toContain('## Suite summary');
    expect(report).toContain('Tests with observations: 1');
    expect(report).toContain('## What went well');
    expect(report).toContain('## Potential issues detected by step evaluation');
    expect(report).toContain('## Concerns and potential issues');
    expect(report).toContain('severity: low');
    expect(report).toContain('app › Auth graph-driven › login');
  });

  test('exposes an observation result to the suite reporter', async ({}, testInfo) => {
    await testInfo.attach('llm-judge-observation-result', {
      body: JSON.stringify(observationReport()),
      contentType: 'application/json',
    });
  });

  test('reports a verified graph step after its deterministic check', async () => {
    const path = getAllShortestPaths(appAuthMachine).find(
      (candidate) =>
        candidate.steps.some((step) => step.event.type === 'GO_LOGIN') &&
        candidate.steps.every(
          (step) =>
            step.event.type === 'GO_LOGIN' ||
            step.event.type.startsWith('xstate.'),
        ),
    );
    const steps: MbtVerifiedStep[] = [];
    const logs: string[] = [];

    expect(path).toBeDefined();
    await testPath(
      path!,
      { page: {} as Page, log: (message) => logs.push(message) },
      {
        actions: { GO_LOGIN: async () => undefined },
        verifyState: async (state) => {
          expect(state).toBe('login');
        },
        onStepCompleted: async (step) => {
          steps.push(step);
        },
      },
    );

    expect(steps).toEqual([
      {
        index: 0,
        eventType: 'GO_LOGIN',
        expectedState: 'login',
        expectedContext: { username: '' },
      },
    ]);
    expect(logs).toContain('[xstate] ACTION=GO_LOGIN TARGET=login');
  });

  test('reports XState context after shopping actions', async () => {
    const path = getAllShortestPaths(appShoppingMachine).find((candidate) =>
      candidate.steps.some((step) => step.event.type === 'GO_CART'),
    );
    const steps: MbtVerifiedStep[] = [];

    expect(path).toBeDefined();
    await testPath(
      path!,
      { page: {} as Page, log: () => undefined },
      {
        actions: {
          BROWSE_CATEGORY: async () => undefined,
          OPEN_PDP: async () => undefined,
          ADD_TO_CART: async () => undefined,
          GO_CART: async () => undefined,
        },
        onStepCompleted: async (step) => {
          steps.push(step);
        },
      },
    );

    expect(steps.at(-1)).toMatchObject({
      eventType: 'GO_CART',
      expectedState: 'cart',
      expectedContext: {
        hasFavorite: false,
        hasItemInCart: true,
      },
    });
  });

  test('formats a concise decision-oriented summary', () => {
    expect(
      formatJudgeSummary({
        verdict: 'fail',
        decisionReason: 'required_criterion_failed',
        score: 0.44,
        confidence: 0.91,
        findings: ['route_not_supported'],
        criteria: [
          {
            criterionId: 'route-node-correspondence',
            status: 'not_met',
            score: 0.3,
            confidence: 0.91,
            reasonCode: 'visible_conflict',
            evidenceImageIndexes: [1, 4],
            explanation:
              'Expected state and context conflict with the visible UI.',
          },
          {
            criterionId: 'final-state-appropriate',
            status: 'met',
            score: 0.9,
            confidence: 0.91,
            reasonCode: 'visible_support',
            evidenceImageIndexes: [4],
            explanation: 'The final state is visibly supported.',
          },
        ],
      }),
    ).toBe(
      'verdict=fail score=0.44 confidence=0.91 criteria=1/2 ' +
        'reason=required_criterion_failed ' +
        'issues=route-node-correspondence:not_met',
    );

    expect(
      formatJudgeIssues({
        verdict: 'fail',
        decisionReason: 'required_criterion_failed',
        score: 0.44,
        confidence: 0.91,
        findings: ['route_not_supported'],
        criteria: [
          {
            criterionId: 'route-node-correspondence',
            status: 'not_met',
            score: 0.3,
            confidence: 0.91,
            reasonCode: 'visible_conflict',
            evidenceImageIndexes: [1, 4],
            explanation:
              'Expected state and context conflict with the visible UI.',
          },
        ],
      }),
    ).toEqual([
      'issue criterion=route-node-correspondence status=not_met ' +
        'score=0.3 confidence=0.91 reason=visible_conflict images=1,4 ' +
        'detail="Expected state and context conflict with the visible UI."',
    ]);

    expect(
      formatJudgeReasoning({
        verdict: 'pass',
        decisionReason: 'pass_threshold_met',
        score: 0.9,
        confidence: 0.9,
        findings: ['route_supported'],
        criteria: [
          {
            criterionId: 'target-state-visible',
            status: 'met',
            score: 0.9,
            confidence: 0.9,
            reasonCode: 'visible_support',
            evidenceImageIndexes: [0],
            explanation: 'The expected target state is visibly supported.',
          },
        ],
      }),
    ).toEqual([
      'reasoning criterion=target-state-visible status=met ' +
        'detail="The expected target state is visibly supported."',
    ]);
  });
});

function createAssessments(score: number, confidence: number) {
  return pathEvidenceRubric.criteria.map((criterion) => ({
    criterionId: criterion.id,
    status: 'met' as const,
    score,
    confidence,
    reasonCode: 'visible_support' as const,
    evidenceImageIndexes: [],
    explanation: 'The criterion is supported by the supplied evidence.',
  }));
}

function createStepAssessments(score: number, confidence: number) {
  return stepEvidenceRubric.criteria.map((criterion) => ({
    criterionId: criterion.id,
    status: 'met' as const,
    score,
    confidence,
    reasonCode: 'visible_support' as const,
    evidenceImageIndexes: [],
    explanation: 'The criterion is supported by the supplied evidence.',
  }));
}

function passingJudgeResult(): JudgeResult {
  return {
    verdict: 'pass',
    decisionReason: 'pass_threshold_met',
    score: 1,
    confidence: 1,
    findings: ['route_supported'],
    criteria: createAssessments(1, 1),
  };
}

function failedStepJudgeResult(): JudgeResult {
  const criteria = createStepAssessments(1, 1);
  criteria[0] = {
    ...criteria[0]!,
    status: 'not_met',
    score: 0,
    confidence: 0.8,
    reasonCode: 'visible_conflict',
    evidenceImageIndexes: [0],
    explanation: 'The expected target state is not visible.',
  };
  return {
    verdict: 'fail',
    decisionReason: 'required_criterion_failed',
    score: 0.5,
    confidence: 0.8,
    findings: ['route_not_supported'],
    criteria,
  };
}

function observationReport(): ExploratoryObservationReport {
  return {
    summary:
      'The observed route is supported overall, with one follow-up concern.',
    wentWell: [
      {
        statement: 'The expected target state is visibly supported.',
        confidence: 0.9,
        evidence: {
          stepNumbers: [1],
          screenshotIndexes: [0],
          criteria: ['target-state-visible'],
        },
      },
    ],
    concerns: [
      {
        statement: 'A visible confirmation of the context change is limited.',
        confidence: 0.7,
        severity: 'low',
        evidence: {
          stepNumbers: [1],
          screenshotIndexes: [0],
          criteria: ['context-effect-consistent'],
        },
      },
    ],
    errorsSeen: [],
    coverageGaps: [],
  };
}
