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
  type LlmJudge,
} from '../support/evaluation/judge-client.js';
import { pathEvidenceRubric } from '../support/evaluation/rubrics/path-evidence.rubric.js';
import {
  createPathEvaluator,
  formatJudgeSummary,
} from '../support/evaluation/test-evaluator.js';

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
    expect(parsedEvidence).toMatchObject({
      finalExpectedState: 'login',
      finalExpectedContext: { authenticated: false },
      route: [
        expect.objectContaining({
          expectedContext: { authenticated: false },
        }),
      ],
      screenshots: [{ imageIndex: 0, label: '01-go_login-login' }],
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
      judge,
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
      judge,
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

    expect(path).toBeDefined();
    await testPath(
      path!,
      { page: {} as Page, log: () => undefined },
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
          },
          {
            criterionId: 'final-state-appropriate',
            status: 'met',
            score: 0.9,
            confidence: 0.91,
            reasonCode: 'visible_support',
          },
        ],
      }),
    ).toBe(
      'verdict=fail score=0.44 confidence=0.91 criteria=1/2 ' +
        'reason=required_criterion_failed ' +
        'issues=route-node-correspondence:not_met',
    );
  });
});

function createAssessments(score: number, confidence: number) {
  return pathEvidenceRubric.criteria.map((criterion) => ({
    criterionId: criterion.id,
    status: 'met',
    score,
    confidence,
    reasonCode: 'visible_support',
  }));
}
