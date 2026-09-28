import {
  buildInstructions,
  buildResponseFormat,
  evaluateAssessments,
  inconclusiveResult,
  parseAssessments,
  validateRubric,
} from './rubric-engine.js';
import type { MbtVerifiedStep } from '../../../src/mbt/types.js';
import type { JudgeResult, JudgeRubric } from './rubric-engine.js';

export type {
  CriterionAssessment,
  CriterionReasonCode,
  CriterionStatus,
  JudgeDecisionReason,
  JudgeFinding,
  JudgeResult,
  JudgeRubric,
} from './rubric-engine.js';

export type JudgeEvidence = {
  status: 'passed' | 'failed';
  steps: MbtVerifiedStep[];
  screenshots: Array<{
    label: string;
    image: Buffer;
  }>;
};

export type LlmGatewayJudgeConfig = {
  gatewayUrl: string;
  token: string;
  model: 'gpt-4o-mini';
  modelVersion: string;
  attachRawResponse: boolean;
  timeoutMs: number;
};

export interface LlmJudge {
  evaluate(evidence: JudgeEvidence): Promise<JudgeResult>;
}

type FetchImplementation = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export function createLlmGatewayJudge(
  config: LlmGatewayJudgeConfig,
  rubric: JudgeRubric,
  fetchImplementation: FetchImplementation = globalThis.fetch,
): LlmJudge {
  validateRubric(rubric);

  return {
    async evaluate(evidence) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchImplementation(
          getResponsesUrl(config.gatewayUrl),
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + config.token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.model,
              input: [
                {
                  role: 'developer',
                  content: [
                    {
                      type: 'input_text',
                      text: buildInstructions(rubric),
                    },
                  ],
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: JSON.stringify({
                        deterministicStatus: evidence.status,
                        route: evidence.steps,
                        finalExpectedState:
                          evidence.steps.at(-1)?.expectedState,
                        finalExpectedContext:
                          evidence.steps.at(-1)?.expectedContext,
                        screenshots: evidence.screenshots.map(
                          (screenshot, imageIndex) => ({
                            imageIndex,
                            label: screenshot.label,
                          }),
                        ),
                      }),
                    },
                    ...evidence.screenshots.map((screenshot) => ({
                      type: 'input_image',
                      image_url:
                        'data:image/png;base64,' +
                        screenshot.image.toString('base64'),
                      detail: 'low',
                    })),
                  ],
                },
              ],
              text: { format: buildResponseFormat(rubric) },
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          return inconclusiveResult();
        }

        const payload = await response.json();
        const outputText = getOutputText(payload);
        const assessments = outputText
          ? parseAssessments(outputText, rubric, evidence.screenshots.length)
          : undefined;
        const result = assessments
          ? evaluateAssessments(rubric, assessments)
          : inconclusiveResult('invalid_response');

        return config.attachRawResponse
          ? { ...result, rawResponse: payload }
          : result;
      } catch {
        return inconclusiveResult();
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function getResponsesUrl(gatewayUrl: string): string {
  return gatewayUrl.replace(/\/+$/, '') + '/responses';
}

function getOutputText(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }
  if (!Array.isArray(payload.output)) {
    return undefined;
  }

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === 'output_text' &&
        typeof content.text === 'string'
      ) {
        return content.text;
      }
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
