import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  GraphEdge,
  GraphNode,
  Issue,
  Manifest,
  SignalEvent,
} from './types.js';
import type { CoverageHints } from './sitemap.js';

export type RunArtifacts = {
  manifest: Manifest;
  nodes: GraphNode[];
  edges: GraphEdge[];
  issues: Issue[];
  signalEvents: SignalEvent[];
  hints?: CoverageHints;
};

/**
 * Render the human-readable report (→ report.md). Pure and deterministic — no
 * timestamps or FS — so it is unit-testable without writing anything.
 */
export function renderReport(a: RunArtifacts): string {
  const { manifest, nodes, edges, issues } = a;
  const bugs = issues.filter((i) => i.potentialBug);
  const skipped = edges.filter((e) => e.skipped);

  const lines: string[] = [];
  lines.push(`# Exploration report — ${manifest.target}`);
  lines.push('');
  lines.push(`- **Run:** \`${manifest.runId}\``);
  lines.push(`- **Site:** ${manifest.baseUrl}`);
  lines.push(`- **Completion:** ${manifest.completionReason ?? 'unknown'}`);
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- States discovered: **${manifest.nodeCount}**`);
  lines.push(`- Transitions recorded: **${manifest.edgeCount}**`);
  lines.push(`- Consequence boundaries skipped: **${manifest.skippedCount}**`);
  lines.push(`- Steps taken: **${manifest.totalSteps}**`);
  if (a.hints) {
    lines.push(
      `- Sitemap hints: ${a.hints.urls.length} URLs (${a.hints.productUrls.length} product-like)${a.hints.truncated ? ', truncated' : ''}`,
    );
  }
  lines.push('');

  // Third-party (external vendor) issues are separated from site issues so
  // real first-party problems aren't buried under analytics/CDN noise. Issues
  // with no party attribution are treated as site issues.
  const siteBugs = bugs.filter((b) => b.party !== 'third');
  const thirdBugs = bugs.filter((b) => b.party === 'third');

  lines.push('## Potential issues');
  lines.push('');
  lines.push(
    `Site (first-party): **${siteBugs.length}** · third-party: **${thirdBugs.length}**`,
  );
  lines.push('');
  lines.push('### Site issues');
  lines.push('');
  pushIssueTable(lines, siteBugs);
  if (thirdBugs.length > 0) {
    lines.push('');
    lines.push('### Third-party (external vendors)');
    lines.push('');
    pushIssueTable(lines, thirdBugs);
  }
  lines.push('');

  // Field-validation prompts are the site working as designed against the
  // tool's own input — shown for context, NOT counted as issues.
  const validations = issues.filter((i) => i.kind === 'validation');
  if (validations.length > 0) {
    lines.push('## Form validation prompts (not issues)');
    lines.push('');
    lines.push(
      '_Expected responses to the explorer’s own incomplete/synthetic input._',
    );
    lines.push('');
    for (const v of validations) {
      lines.push(`- ${escapePipes(truncate(v.message, 120))} (×${v.count})`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('## Skipped boundaries');
    lines.push('');
    for (const e of skipped) {
      lines.push(`- \`${e.label}\` — ${e.skipReason ?? 'consequential'}`);
    }
    lines.push('');
  }

  const decided = a.edges.filter((e) => e.rationale);
  if (decided.length > 0) {
    lines.push('## Decision trail');
    lines.push('');
    for (const e of [...decided].sort((x, y) => x.step - y.step)) {
      lines.push(`${e.step}. \`${e.label}\` — ${e.rationale}`);
    }
    lines.push('');
  }

  lines.push('## States');
  lines.push('');
  for (const n of nodes) {
    lines.push(`- \`${shortId(n.id)}\` — ${n.url} (${n.actionCount} actions)`);
  }
  lines.push('');

  return lines.join('\n');
}

function pushIssueTable(lines: string[], bugs: Issue[]): void {
  if (bugs.length === 0) {
    lines.push('_None._');
    return;
  }
  // Deduped by message: show total occurrences and how many transitions each
  // spans, most-frequent first.
  const sorted = [...bugs].sort((a, b) => b.count - a.count);
  lines.push('| Kind | Message | Count | Transitions |');
  lines.push('| --- | --- | --- | --- |');
  for (const b of sorted) {
    lines.push(
      `| ${b.kind} | ${escapePipes(truncate(b.message, 100))} | ${b.count} | ${b.transitions} |`,
    );
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|');
}

/**
 * Persist the full artifact set to `<outDir>` (plan §9). Returns the paths
 * written. Directory is created if absent.
 */
export async function writeArtifacts(
  outDir: string,
  a: RunArtifacts,
): Promise<string[]> {
  await mkdir(join(outDir, 'evidence'), { recursive: true });

  const files: Array<[string, string]> = [
    ['manifest.json', json(a.manifest)],
    ['graph.json', json({ nodes: a.nodes, edges: a.edges })],
    ['issues.json', json(a.issues)],
    ['errors.json', json(a.signalEvents)],
    ['report.md', renderReport(a)],
  ];
  if (a.hints) files.push(['routes.json', json(a.hints)]);

  const written: string[] = [];
  for (const [name, content] of files) {
    const path = join(outDir, name);
    await writeFile(path, content, 'utf8');
    written.push(path);
  }
  return written;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
