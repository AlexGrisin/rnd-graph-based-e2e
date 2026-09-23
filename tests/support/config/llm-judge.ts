import type { LlmGatewayJudgeConfig } from '../evaluation/llm-judge.js';

const DEFAULT_GATEWAY_URL = 'https://api.openai.com/v1';
const JUDGE_MODEL = 'gpt-4o-mini';
const JUDGE_MODEL_VERSION = 'unversioned-alias';

export function getLlmJudgeConfig(): LlmGatewayJudgeConfig | undefined {
  if (process.env.LLM_JUDGE_ENABLED !== 'true') {
    return undefined;
  }

  const token = process.env.LLM_GATEWAY_TOKEN;
  if (!token) {
    throw new Error(
      'LLM_JUDGE_ENABLED requires LLM_GATEWAY_TOKEN. The token is never logged or attached to test results.',
    );
  }

  const model = process.env.LLM_JUDGE_MODEL ?? JUDGE_MODEL;
  if (model !== JUDGE_MODEL) {
    throw new Error(
      'LLM_JUDGE_MODEL must be "' + JUDGE_MODEL + '" for this MVP.',
    );
  }

  return {
    gatewayUrl: process.env.LLM_GATEWAY_URL ?? DEFAULT_GATEWAY_URL,
    token,
    model: JUDGE_MODEL,
    modelVersion: process.env.LLM_JUDGE_MODEL_VERSION ?? JUDGE_MODEL_VERSION,
    attachRawResponse: process.env.LLM_JUDGE_ATTACH_RAW_RESPONSE === 'true',
    timeoutMs: 15_000,
  };
}
