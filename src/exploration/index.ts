/**
 * Exploration telemetry core (plan §6, Increment 1).
 *
 * Browser-independent primitives that the Playwright MCP loop (Increment 2)
 * will drive. Nothing here imports Playwright.
 */
export * from './types.js';
export { assert } from './assert.js';
export { hashState } from './hash.js';
export { resolveIntent } from './intent-map.js';
export type { EntryStrategy, ResolvedIntent } from './intent-map.js';
export { ObservedGraph } from './graph.js';
export { IssueLog } from './issues.js';
export type { Correlation } from './issues.js';
export { classifyParty, registrableDomain } from './signal-origin.js';
export { deriveAppProfile, buildAppContext } from './app-profile.js';
export {
  loadCoverageHints,
  defaultFetchText,
  defaultIsProductUrl,
} from './sitemap.js';
export type { CoverageHints, FetchText, LoadHintsOptions } from './sitemap.js';
export { SessionRecorder } from './recorder.js';
export type { RecorderOptions, TransitionResult } from './recorder.js';
export { renderReport, writeArtifacts } from './report.js';
export type { RunArtifacts } from './report.js';
export { classifyConsequence } from './consequence-policy.js';
export type { ConsequenceVerdict } from './consequence-policy.js';
export { rankActions, canonicalUrl, isOffOrigin } from './action-ranker.js';
export type { RankContext } from './action-ranker.js';
export type { ExplorationHost } from './host.js';
export { HeuristicDecider, AgentDecider } from './decider.js';
export type {
  Decider,
  Decision,
  DecisionContext,
  ChooseFn,
} from './decider.js';
export { explore, resolveEntryUrl, DEFAULT_BUDGET } from './coordinator.js';
export type {
  ExploreOptions,
  ExploreResult,
  ExploreDefaults,
} from './coordinator.js';
