import type { Page, TestInfo } from '@playwright/test';
import { appAuthMachine } from '../../src/machines/app-auth.machine.js';
import { getAllShortestPaths } from '../../src/mbt/graph/path-generator.js';
import { testPath } from '../../src/mbt/graph/test-model-factory.js';
import { test, expect } from '../fixtures.js';
import {
  createLlmGatewayJudge,
  type JudgeEvidence,
  type LlmJudge,
} from '../support/evaluation/llm-judge.js';
import { createPathEvaluator } from '../support/evaluation/test-evaluator.js';

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
        timeoutMs: 100,
      },
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
                      verdict: 'pass',
                      confidence: 0.8,
                      findings: ['route_supported'],
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
        },
      ],
      screenshots: [],
    });

    expect(requestUrl).toBe('https://api.openai.com/v1/responses');
    expect(requestBody).toContain('GO_LOGIN');
    expect(result).toEqual({
      verdict: 'pass',
      confidence: 0.8,
      findings: ['route_supported'],
    });
  });

  test('returns inconclusive when the provider rejects the request', async () => {
    const judge = createLlmGatewayJudge(
      {
        gatewayUrl: 'https://api.openai.com/v1',
        token: 'test-token',
        model: 'gpt-4o-mini',
        modelVersion: 'unversioned-alias',
        timeoutMs: 100,
      },
      async () => new Response('', { status: 500 }),
    );

    await expect(
      judge.evaluate({ status: 'passed', steps: [], screenshots: [] }),
    ).resolves.toEqual({
      verdict: 'inconclusive',
      confidence: 0,
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
          confidence: 0,
          findings: ['missing_evidence'],
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
    expect(
      attachments.filter((item) => item.contentType === 'image/png'),
    ).toHaveLength(5);
    expect(attachments.map((item) => item.name)).toContain('llm-judge-result');
  });

  test('preserves a deterministic failure after attaching partial evidence', async () => {
    let capturedEvidence: JudgeEvidence | undefined;
    const judge: LlmJudge = {
      async evaluate(evidence) {
        capturedEvidence = evidence;
        return {
          verdict: 'inconclusive',
          confidence: 0,
          findings: ['missing_evidence'],
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
    const steps: Array<{
      index: number;
      eventType: string;
      expectedState: string;
    }> = [];

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
      },
    ]);
  });
});
