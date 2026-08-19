/**
 * Exploration telemetry core.
 *
 * Browser-independent primitives consumed by the post-hoc trace parser
 * (`tests/support/exploration/trace-parser.ts`) and the guardrail generator.
 * Nothing here imports Playwright.
 */
export * from './types.js';
export { assert } from './assert.js';
export { hashState } from './hash.js';
export { ObservedGraph } from './graph.js';
export { IssueLog } from './issues.js';
export type { Correlation } from './issues.js';
export { classifyParty, registrableDomain } from './signal-origin.js';
export { SessionRecorder } from './recorder.js';
export type { RecorderOptions, TransitionResult } from './recorder.js';
export { renderReport, writeArtifacts } from './report.js';
export type { RunArtifacts } from './report.js';
export {
  classifyConsequence,
  CONSEQUENCE_PATTERNS,
} from './consequence-policy.js';
export type { ConsequenceVerdict } from './consequence-policy.js';
