import type { Page } from '@playwright/test';

export type MbtVerifiedStep = {
  index: number;
  eventType: string;
  expectedState: string;
};

export type MbtContext = {
  page: Page;
  log: (message: string) => void;
};

export type ActionHandler = (ctx: MbtContext) => Promise<void>;

export type ActionMap = Record<string, ActionHandler>;

export type StateVerifier = (
  expectedState: string,
  ctx: MbtContext,
) => Promise<void>;

export type MbtRunOptions = {
  actions: ActionMap;
  verifyState?: StateVerifier;
  onStateVisited?: (stateValue: string) => void;
  onStepCompleted?: (step: MbtVerifiedStep) => void | Promise<void>;
};

export type MbtRunResult = {
  pathsExecuted: number;
  stepsExecuted: number;
  visitedStates: string[];
  success: boolean;
  error?: string;
};

export type PathCoverageReport = {
  totalPaths: number;
  totalSteps: number;
  stateValues: string[];
};
