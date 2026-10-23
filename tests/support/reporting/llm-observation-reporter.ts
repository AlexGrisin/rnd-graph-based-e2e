import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import type {
  ExploratoryConcern,
  ExploratoryObservation,
  ExploratoryObservationReport,
} from '../evaluation/rubrics/exploratory-observation.rubric.js';

const OBSERVATION_ATTACHMENT = 'llm-judge-observation-result';
const REPORT_NAME = 'llm-judge-suite-observations.md';
const REPORT_DIRECTORY = 'artifacts/llm-observations';

export type SuiteTestObservation = {
  title: string;
  status: TestResult['status'];
  report: ExploratoryObservationReport;
};

export default class LlmObservationReporter implements Reporter {
  private outputDirectory = join(process.cwd(), REPORT_DIRECTORY);
  private readonly reports = new Map<string, SuiteTestObservation>();

  onBegin(config: FullConfig) {
    const workspace = config.configFile
      ? dirname(config.configFile)
      : process.cwd();
    this.outputDirectory = join(workspace, REPORT_DIRECTORY);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const attachment = result.attachments.find(
      (candidate) => candidate.name === OBSERVATION_ATTACHMENT,
    );
    const report = attachment ? readObservationReport(attachment) : undefined;
    if (!report) {
      return;
    }

    this.reports.set(test.id, {
      title: test.titlePath().filter(Boolean).join(' › '),
      status: result.status,
      report,
    });
  }

  async onEnd() {
    if (this.reports.size === 0) {
      return;
    }

    await mkdir(this.outputDirectory, { recursive: true });
    await writeFile(
      join(this.outputDirectory, REPORT_NAME),
      formatSuiteObservationReport([...this.reports.values()]),
      'utf8',
    );
  }

  printsToStdio() {
    return false;
  }
}

export function formatSuiteObservationReport(
  reports: SuiteTestObservation[],
): string {
  return [
    '# LLM-assisted exploratory observations — suite',
    '',
    '> Advisory roll-up of per-test LLM observations; it is not a human finding.',
    '',
    '## Suite summary',
    '',
    '- Tests with observations: ' + reports.length,
    '- What went well: ' + count(reports, 'wentWell'),
    '- Step-evaluation potential issues: ' +
      count(reports, 'stepEvaluationIssues'),
    '- Concerns and potential issues: ' + count(reports, 'concerns'),
    '- Errors seen: ' + count(reports, 'errorsSeen'),
    '- Coverage gaps: ' + count(reports, 'coverageGaps'),
    '',
    formatSection('What went well', reports, 'wentWell'),
    '',
    formatSection(
      'Potential issues detected by step evaluation',
      reports,
      'stepEvaluationIssues',
    ),
    '',
    formatSection('Concerns and potential issues', reports, 'concerns'),
    '',
    formatSection('Errors seen', reports, 'errorsSeen'),
    '',
    formatSection('Coverage gaps', reports, 'coverageGaps'),
    '',
  ].join('\n');
}

function readObservationReport(attachment: {
  body?: Buffer;
  path?: string;
}): ExploratoryObservationReport | undefined {
  try {
    const text = attachment.body
      ? attachment.body.toString('utf8')
      : attachment.path
        ? readFileSync(attachment.path, 'utf8')
        : undefined;
    if (!text) {
      return undefined;
    }

    const value = JSON.parse(text) as unknown;
    return isObservationReport(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isObservationReport(
  value: unknown,
): value is ExploratoryObservationReport {
  return (
    isRecord(value) &&
    typeof value.summary === 'string' &&
    Array.isArray(value.wentWell) &&
    Array.isArray(value.concerns) &&
    Array.isArray(value.errorsSeen) &&
    Array.isArray(value.coverageGaps)
  );
}

function formatSection(
  title: string,
  reports: SuiteTestObservation[],
  section: keyof Pick<
    ExploratoryObservationReport,
    | 'wentWell'
    | 'stepEvaluationIssues'
    | 'concerns'
    | 'errorsSeen'
    | 'coverageGaps'
  >,
): string {
  const observations = reports.flatMap((test) =>
    (test.report[section] ?? []).map((observation) => ({
      test,
      observation,
    })),
  );
  if (observations.length === 0) {
    return '## ' + title + '\n\nNone observed.';
  }

  return [
    '## ' + title,
    '',
    ...observations.map(
      ({ test, observation }) =>
        '- ' +
        test.title +
        ' (' +
        test.status +
        '): ' +
        observation.statement +
        formatSeverity(observation) +
        ' [confidence ' +
        observation.confidence +
        '; ' +
        formatEvidence(observation) +
        ']',
    ),
  ].join('\n');
}

function count(
  reports: SuiteTestObservation[],
  section: keyof Pick<
    ExploratoryObservationReport,
    | 'wentWell'
    | 'stepEvaluationIssues'
    | 'concerns'
    | 'errorsSeen'
    | 'coverageGaps'
  >,
): number {
  return reports.reduce(
    (total, test) => total + (test.report[section]?.length ?? 0),
    0,
  );
}

function formatSeverity(observation: ExploratoryObservation): string {
  const severity = (observation as ExploratoryConcern).severity;
  return severity ? ' (severity: ' + severity + ')' : '';
}

function formatEvidence(observation: ExploratoryObservation): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
