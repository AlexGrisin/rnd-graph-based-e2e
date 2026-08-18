import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AgentDecider,
  type CompletionReason,
  type Decision,
  type DecisionContext,
} from '../../../src/exploration/index.js';

/**
 * A keyless "LLM in the loop" for the POC.
 *
 * On each decision the Node exploration loop writes `request.json` (the current
 * page URL + candidate actions) and blocks, polling for `response.json`. The
 * in-session agent (Claude Code) reads the request, reasons, and writes the
 * response. No AI API key or SDK is involved — the agent IS the session driving
 * the loop, exactly as the plan intends (§11 bars a direct SDK integration).
 *
 * The Node side still owns the real browser + recorder, so artifacts stay
 * faithful; the agent only supplies `{ actionId, rationale }` per step.
 */
export type FileChannelOptions = {
  dir: string;
  pollMs?: number;
  /** Per-decision wait before giving up and stopping the run. */
  stepTimeoutMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createFileChannelDecider(options: FileChannelOptions): {
  decider: AgentDecider;
  requestPath: string;
  responsePath: string;
} {
  const pollMs = options.pollMs ?? 750;
  const stepTimeoutMs = options.stepTimeoutMs ?? 600_000;
  const requestPath = join(options.dir, 'request.json');
  const responsePath = join(options.dir, 'response.json');

  let step = 0;

  const decider = new AgentDecider(
    async (ctx: DecisionContext): Promise<Decision> => {
      step += 1;
      await mkdir(options.dir, { recursive: true });
      await rm(responsePath, { force: true });
      await writeFile(
        requestPath,
        `${JSON.stringify(
          {
            step,
            target: ctx.target,
            appContext: ctx.appContext,
            currentUrl: ctx.current.url,
            budgetRemaining: ctx.budgetRemaining,
            lastAction: ctx.lastAction,
            instructions:
              'Reply by writing response.json: {"actionId":"<id>","rationale":"<why>"} or {"stop":true,"reason":"targetCovered","rationale":"<why>"}. If lastAction.changedState is false after an add-to-bag/submit, select a required size/variant first, then retry.',
            candidates: ctx.candidates.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind,
              href: c.href,
            })),
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      const start = Date.now();
      while (Date.now() - start < stepTimeoutMs) {
        let raw: string | undefined;
        try {
          raw = await readFile(responsePath, 'utf8');
        } catch {
          await sleep(pollMs);
          continue;
        }
        await rm(responsePath, { force: true });
        await rm(requestPath, { force: true });
        const resp = JSON.parse(raw) as {
          actionId?: string;
          rationale?: string;
          stop?: boolean;
          reason?: CompletionReason;
        };
        if (resp.stop) {
          return {
            kind: 'stop',
            reason: resp.reason ?? 'noUsefulAction',
            rationale: resp.rationale,
          };
        }
        if (resp.actionId) {
          return {
            kind: 'act',
            actionId: resp.actionId,
            rationale: resp.rationale,
          };
        }
        // Malformed response: ask again next loop by rewriting the request.
        await sleep(pollMs);
      }
      return {
        kind: 'stop',
        reason: 'budgetExhausted',
        rationale: 'agent timed out',
      };
    },
  );

  return { decider, requestPath, responsePath };
}
