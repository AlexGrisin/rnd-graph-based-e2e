import type {
  JudgeEvidence,
  ObservationJudgeEvidence,
} from './judge-client.js';
import type { ExploratoryConcern } from './rubrics/exploratory-observation.rubric.js';

export function collectStepEvaluationIssues(
  stepResults: ObservationJudgeEvidence['stepResults'],
  routeScreenshots: JudgeEvidence['screenshots'],
): ExploratoryConcern[] {
  return stepResults.flatMap(({ step, result, screenshot }) =>
    result.criteria
      .filter((criterion) => criterion.status === 'not_met')
      .map((criterion) => ({
        statement:
          'Step ' +
          String(step.index + 1) +
          ' (' +
          step.eventType +
          ' → ' +
          step.expectedState +
          '): ' +
          criterion.criterionId +
          ' was not met.',
        confidence: criterion.confidence,
        severity: 'medium' as const,
        evidence: {
          stepNumbers: [step.index + 1],
          screenshotIndexes: screenshot
            ? routeScreenshotIndexes(routeScreenshots, screenshot.label)
            : [],
          criteria: [criterion.criterionId],
        },
      })),
  );
}

function routeScreenshotIndexes(
  screenshots: JudgeEvidence['screenshots'],
  label: string,
): number[] {
  const index = screenshots.findIndex(
    (screenshot) => screenshot.label === label,
  );
  return index === -1 ? [] : [index];
}
