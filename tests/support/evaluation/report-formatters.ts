import type { JudgeResult } from './judge-client.js';
import type {
  ExploratoryObservation,
  ExploratoryObservationReport,
} from './rubrics/exploratory-observation.rubric.js';

export function formatJudgeSummary(result: JudgeResult): string {
  const metCount = result.criteria.filter(
    (criterion) => criterion.status === 'met',
  ).length;
  const issues = result.criteria
    .filter((criterion) => criterion.status !== 'met')
    .map((criterion) => criterion.criterionId + ':' + criterion.status);

  return [
    'verdict=' + result.verdict,
    'score=' + result.score,
    'confidence=' + result.confidence,
    'criteria=' + metCount + '/' + result.criteria.length,
    'reason=' + result.decisionReason,
    issues.length > 0 ? 'issues=' + issues.join(',') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatJudgeIssues(result: JudgeResult): string[] {
  if (result.verdict === 'pass') {
    return [];
  }

  return result.criteria
    .filter((criterion) => criterion.status !== 'met')
    .map((criterion) =>
      [
        'issue',
        'criterion=' + criterion.criterionId,
        'status=' + criterion.status,
        'score=' + criterion.score,
        'confidence=' + criterion.confidence,
        'reason=' + criterion.reasonCode,
        criterion.evidenceImageIndexes.length > 0
          ? 'images=' + criterion.evidenceImageIndexes.join(',')
          : 'images=none',
        'detail=' + JSON.stringify(criterion.explanation),
      ].join(' '),
    );
}

export function formatJudgeReasoning(result: JudgeResult): string[] {
  if (result.criteria.length === 0) {
    return ['reasoning=unavailable'];
  }

  return result.criteria.map((criterion) =>
    [
      'reasoning',
      'criterion=' + criterion.criterionId,
      'status=' + criterion.status,
      'detail=' + JSON.stringify(criterion.explanation),
    ].join(' '),
  );
}

export function formatExploratoryObservationReport(
  report: ExploratoryObservationReport,
): string {
  return [
    '# LLM-assisted exploratory observations',
    '',
    '> Advisory report generated from route and step judge evidence; it is not a human finding.',
    '',
    '## Summary',
    '',
    report.summary,
    '',
    formatObservationSection('What went well', report.wentWell),
    '',
    formatObservationSection(
      'Potential issues detected by step evaluation',
      report.stepEvaluationIssues ?? [],
    ),
    '',
    formatObservationSection('Concerns and potential issues', report.concerns),
    '',
    formatObservationSection('Errors seen', report.errorsSeen),
    '',
    formatObservationSection('Coverage gaps', report.coverageGaps),
    '',
  ].join('\n');
}

export function formatObservationSummary(
  report: ExploratoryObservationReport,
): string {
  return [
    'observations',
    'went-well=' + report.wentWell.length,
    'step-issues=' + (report.stepEvaluationIssues?.length ?? 0),
    'concerns=' + report.concerns.length,
    'errors=' + report.errorsSeen.length,
    'gaps=' + report.coverageGaps.length,
  ].join(' ');
}

function formatObservationSection(
  title: string,
  observations: ExploratoryObservation[],
): string {
  if (observations.length === 0) {
    return '## ' + title + '\n\nNone observed.';
  }

  return [
    '## ' + title,
    '',
    ...observations.flatMap((observation) => [
      '- ' + observation.statement + formatSeverity(observation),
      '  - Confidence: ' + observation.confidence,
      '  - Evidence: ' + formatObservationEvidence(observation),
    ]),
  ].join('\n');
}

function formatSeverity(observation: ExploratoryObservation): string {
  const severity = (observation as { severity?: string }).severity;
  return severity ? ' (severity: ' + severity + ')' : '';
}

function formatObservationEvidence(
  observation: ExploratoryObservation,
): string {
  const { stepNumbers, screenshotIndexes, criteria } = observation.evidence;
  return (
    [
      stepNumbers.length > 0 ? 'steps ' + stepNumbers.join(', ') : '',
      screenshotIndexes.length > 0
        ? 'screenshots ' + screenshotIndexes.join(', ')
        : '',
      criteria.length > 0 ? 'criteria ' + criteria.join(', ') : '',
    ]
      .filter(Boolean)
      .join('; ') || 'no direct evidence indexes'
  );
}
