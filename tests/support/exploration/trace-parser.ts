import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  SessionRecorder,
  classifyConsequence,
  classifyParty,
  type ActionKind,
  type ActionResult,
  type ChosenAction,
  type Observation,
  type RunArtifacts,
  type Signal,
  type SignalKind,
  type VisibleAction,
} from '../../../src/exploration/index.js';

const run = promisify(execFile);

/**
 * Post-hoc trace parser (Increment 2).
 *
 * The agent explores via Microsoft's Playwright MCP with tracing on; this turns
 * the resulting `trace.zip` into the exploration artifacts by feeding the EXISTING
 * pure core (`SessionRecorder` → `writeArtifacts`). No browser, no live host.
 *
 * Two layers:
 *   - `extractTrace(zip)` — unzips (shell `unzip`, no dep) and parses `trace.trace`
 *     into an ordered, browser-independent `TraceModel`.
 *   - `traceModelToArtifacts(model, meta)` — PURE transform → `RunArtifacts`.
 * `parseTrace(zip, meta)` composes both.
 */

/** One Playwright API call recovered from before/after pairs. */
export type TraceAction = {
  seq: number;
  callId: string;
  method: string; // goto | click | fill | selectOption | press | type | ...
  klass: string; // Frame | BrowserContext | ...
  params: Record<string, unknown>;
  /** after.error.message, if the call failed. */
  error?: string;
};

/** A main-frame DOM snapshot. */
export type TraceSnapshot = {
  seq: number;
  frameUrl: string;
  html: string;
};

/** A console message (also mirrors network failures/4xx). */
export type TraceConsole = {
  seq: number;
  messageType: string; // error | warning | log | ...
  text: string;
  url?: string;
};

/** An unhandled page error. */
export type TracePageError = {
  seq: number;
  message: string;
};

/** Browser-independent, order-preserving view of a trace. */
export type TraceModel = {
  actions: TraceAction[];
  snapshots: TraceSnapshot[];
  consoles: TraceConsole[];
  pageErrors: TracePageError[];
};

export type TraceMeta = {
  target: string;
  baseUrl: string;
  runId: string;
};

/** Playwright methods that represent a user-meaningful step. */
const RELEVANT = new Set([
  'goto',
  'click',
  'fill',
  'selectOption',
  'press',
  'type',
]);

const KIND: Record<string, ActionKind> = {
  goto: 'navigate',
  click: 'click',
  fill: 'fill',
  selectOption: 'select',
  press: 'other',
  type: 'fill',
};

/**
 * Hard-budget caps mirrored from the `/explore` skill's "Budget (hard gate)"
 * (10 acting steps / 15 states — POC). Kept in sync by hand: the budget is
 * prompt-enforced in the skill, so there is no shared runtime source. Used only
 * to label completion honestly — a run that reached a cap stopped because it ran
 * out of budget, not because coverage was confirmed.
 */
const STEP_BUDGET = 10;
const STATE_BUDGET = 15;

// ---------------------------------------------------------------------------
// Layer A — extract
// ---------------------------------------------------------------------------

/**
 * Parse a Playwright trace into a `TraceModel`.
 *
 * Accepts EITHER a raw, uncompressed `*.trace` stream (what the MCP writes live
 * for the session — `trace-<ts>.trace`) OR a bundled `trace.zip`. Prefer the raw
 * `.trace`: no `unzip`, no dependency, and no risk of reading a stale `trace.zip`
 * left over from an earlier run. The zip path is kept only as a fallback.
 */
export async function extractTrace(tracePath: string): Promise<TraceModel> {
  if (!tracePath.endsWith('.zip')) {
    return parseTraceTrace(await readFile(tracePath, 'utf8'));
  }
  const dir = await mkdtemp(join(tmpdir(), 'explore-trace-'));
  try {
    await run('unzip', ['-o', '-q', tracePath, 'trace.trace', '-d', dir]).catch(
      () => run('unzip', ['-o', '-q', tracePath, '-d', dir]),
    );
    const raw = await readFile(join(dir, 'trace.trace'), 'utf8');
    return parseTraceTrace(raw);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Parse the newline-delimited `trace.trace` stream, preserving line order. */
export function parseTraceTrace(raw: string): TraceModel {
  const actions: TraceAction[] = [];
  const snapshots: TraceSnapshot[] = [];
  const consoles: TraceConsole[] = [];
  const pageErrors: TracePageError[] = [];
  const pending = new Map<string, TraceAction>();

  let seq = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    seq += 1;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = o.type as string;

    if (type === 'before') {
      const action: TraceAction = {
        seq,
        callId: String(o.callId),
        method: String(o.method),
        klass: String(o.class),
        params: (o.params as Record<string, unknown>) ?? {},
      };
      pending.set(action.callId, action);
      actions.push(action);
    } else if (type === 'after') {
      const action = pending.get(String(o.callId));
      const err = o.error as { message?: string } | null | undefined;
      if (action && err?.message) action.error = err.message;
    } else if (type === 'frame-snapshot') {
      const snap = (o.snapshot as Record<string, unknown>) ?? {};
      if (snap.isMainFrame) {
        snapshots.push({
          seq,
          frameUrl: String(snap.frameUrl ?? ''),
          html: htmlFromSnapshot(snap.html),
        });
      }
    } else if (type === 'console') {
      consoles.push({
        seq,
        messageType: String(o.messageType ?? ''),
        text: String(o.text ?? ''),
        url: ((o.location as { url?: string })?.url ?? '') || undefined,
      });
    } else if (type === 'event' && /pageerror/i.test(String(o.method ?? ''))) {
      pageErrors.push({ seq, message: String(o.error ?? o.method) });
    }
  }
  return { actions, snapshots, consoles, pageErrors };
}

// ---------------------------------------------------------------------------
// Layer B — pure transform
// ---------------------------------------------------------------------------

/** Turn a `TraceModel` into exploration artifacts via the pure core. */
export function traceModelToArtifacts(
  model: TraceModel,
  meta: TraceMeta,
): RunArtifacts {
  const steps = model.actions.filter((a) => RELEVANT.has(a.method));
  const recorder = new SessionRecorder(meta);

  if (steps.length === 0) {
    const root: Observation = { url: meta.baseUrl, aria: '', actions: [] };
    recorder.start(root);
    recorder.complete('noUsefulAction');
    return buildArtifacts(recorder);
  }

  // Root = the state reached by the first step (usually the entry `goto`).
  const first = steps[0];
  const rootObs = observationAfter(model, first, steps[1]?.seq, meta.baseUrl);
  const rootNode = recorder.start({
    ...rootObs,
    signals: signalsInWindow(model, first.seq, steps[1]?.seq, meta.baseUrl),
  });
  // Track the current NODE id (states dedup by ARIA-hash, not url — same url can
  // be two states), exactly as the retired coordinator did.
  let currentId = rootNode.id;

  for (let i = 1; i < steps.length; i += 1) {
    const step = steps[i];
    const nextSeq = steps[i + 1]?.seq;
    const label = labelFor(step);
    const kind = KIND[step.method] ?? 'other';

    // Post-hoc consequence classification: a consequential control was already
    // neutralized live by the guardrail; we record it as a skipped boundary so
    // the report reflects it. Best-effort — depends on the name in the selector.
    const verdict = classifyConsequence({
      id: label,
      role: '',
      name: labelName(step),
      kind,
    });

    const chosen: ChosenAction = {
      actionId: `${step.method}:${labelName(step) || step.callId}`,
      label,
      kind,
      skipped: verdict.consequential,
      skipReason: verdict.reason,
    };

    if (verdict.consequential) {
      recorder.recordTransition(currentId, chosen, {});
      continue;
    }

    const fromUrl = recorder.graph.getNode(currentId)?.url ?? meta.baseUrl;
    const obs = observationAfter(model, step, nextSeq, fromUrl);
    const result: ActionResult = {
      outcome: obs,
      signals: signalsInWindow(model, step.seq, nextSeq, meta.baseUrl),
      failed: step.error !== undefined,
    };
    const { toNode } = recorder.recordTransition(currentId, chosen, result);
    if (toNode) currentId = toNode.id;
  }

  // Honest completion label. The parser cannot judge whether the target was
  // actually covered — only the agent, which had eyes on the page, can. So if the
  // run reached the skill's hard budget (step OR state cap) we label it
  // `budgetExhausted` (it stopped because it ran out of room). Under the caps we
  // infer the agent stopped on its "target reached & exercised" condition and keep
  // `targetCovered` as the best available label.
  const statesReached = recorder.graph.nodes().length;
  const hitBudget =
    steps.length >= STEP_BUDGET || statesReached >= STATE_BUDGET;
  recorder.complete(hitBudget ? 'budgetExhausted' : 'targetCovered');
  return buildArtifacts(recorder);
}

/** Compose extract + transform. */
export async function parseTrace(
  zipPath: string,
  meta: TraceMeta,
): Promise<RunArtifacts> {
  return traceModelToArtifacts(await extractTrace(zipPath), meta);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function buildArtifacts(recorder: SessionRecorder): RunArtifacts {
  return {
    manifest: recorder.buildManifest(),
    nodes: recorder.graph.nodes(),
    edges: recorder.graph.edges(),
    issues: recorder.issues.allIssues(),
    signalEvents: recorder.issues.allEvents(),
  };
}

/** Build the observation for the state reached by `step` (before `nextSeq`). */
function observationAfter(
  model: TraceModel,
  step: TraceAction,
  nextSeq: number | undefined,
  fallbackUrl: string,
): Observation {
  const upper = nextSeq ?? Number.POSITIVE_INFINITY;
  const snap = model.snapshots
    .filter((s) => s.seq >= step.seq && s.seq < upper && s.frameUrl)
    .filter((s) => s.frameUrl !== 'about:blank')
    .slice(-1)[0];
  const url =
    snap?.frameUrl ??
    (step.method === 'goto'
      ? String(step.params.url ?? fallbackUrl)
      : fallbackUrl);
  const html = snap?.html ?? '';
  return {
    url,
    aria: normalizeHtml(html),
    actions: extractActions(html),
  };
}

/** Signals correlated to the [fromSeq, toSeq) window, classified from console. */
function signalsInWindow(
  model: TraceModel,
  fromSeq: number,
  toSeq: number | undefined,
  baseUrl: string,
): Signal[] {
  const upper = toSeq ?? Number.POSITIVE_INFINITY;
  const out: Signal[] = [];

  for (const c of model.consoles) {
    if (c.seq < fromSeq || c.seq >= upper) continue;
    if (c.messageType !== 'error') continue; // warnings/logs are not signals
    const classified = classifyConsole(c);
    out.push({
      ...classified,
      party: c.url ? classifyParty(c.url, baseUrl) : undefined,
    });
  }
  for (const e of model.pageErrors) {
    if (e.seq < fromSeq || e.seq >= upper) continue;
    out.push({ kind: 'pageError', message: e.message, party: 'first' });
  }
  return out;
}

/** Map a console error to a signal kind (network failures mirror here). */
function classifyConsole(c: TraceConsole): {
  kind: SignalKind;
  message: string;
} {
  const http = /status of (\d{3})/.exec(c.text);
  if (http && Number(http[1]) >= 400) {
    return { kind: 'httpError', message: `${http[1]} ${c.url ?? c.text}` };
  }
  if (/net::ERR|Failed to load resource/i.test(c.text)) {
    return { kind: 'requestFailed', message: c.url ?? c.text };
  }
  return { kind: 'consoleError', message: c.text };
}

/** Human label for a step's edge. */
function labelFor(step: TraceAction): string {
  if (step.method === 'goto')
    return `navigate ${shorten(String(step.params.url ?? ''))}`;
  const name = labelName(step);
  return name ? `${step.method} ${name}` : `${step.method} ${selectorOf(step)}`;
}

/** Best-effort accessible name from a selector (MCP uses role/name locators). */
function labelName(step: TraceAction): string {
  const sel = selectorOf(step);
  const byName = /name=["']([^"']+)["']/i.exec(sel);
  if (byName) return byName[1];
  const byText = /text=["']?([^"'\]]+)/i.exec(sel);
  if (byText) return byText[1].trim();
  return '';
}

function selectorOf(step: TraceAction): string {
  return String(step.params.selector ?? step.params.url ?? '');
}

function shorten(url: string, max = 80): string {
  const decoded = safeDecode(url);
  return decoded.length > max ? `${decoded.slice(0, max - 1)}…` : decoded;
}

function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/**
 * Playwright stores each snapshot's DOM as a nested array
 * (`[tagName, attrs, ...children]`; text nodes are bare strings), NOT an HTML
 * string. Serialize it back to HTML so `normalizeHtml` / `extractActions` /
 * hashing see real markup. A plain string (used by unit fixtures) passes through.
 */
export function htmlFromSnapshot(html: unknown): string {
  if (typeof html === 'string') return html;
  if (Array.isArray(html)) return snapshotNodeToHtml(html);
  return '';
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function snapshotNodeToHtml(node: unknown): string {
  if (typeof node === 'string') return node; // text node
  if (!Array.isArray(node)) return '';
  const [name, attrs, ...children] = node as unknown[];
  if (typeof name !== 'string' || !/^[a-zA-Z]/.test(name)) return ''; // skip #comment etc.
  const tag = name.toLowerCase();
  const attrStr =
    attrs && typeof attrs === 'object' && !Array.isArray(attrs)
      ? Object.entries(attrs as Record<string, unknown>)
          .map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)
          .join('')
      : '';
  if (VOID_TAGS.has(tag)) return `<${tag}${attrStr}>`;
  return `<${tag}${attrStr}>${children.map(snapshotNodeToHtml).join('')}</${tag}>`;
}

/** Normalize HTML for stable state identity (head/scripts/whitespace stripped). */
export function normalizeHtml(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><') // inter-tag whitespace must not change identity
    .trim();
}

/** Rough interactive-element extraction so `actionCount` is meaningful. */
function extractActions(html: string): VisibleAction[] {
  const out: VisibleAction[] = [];
  let i = 0;

  // Paired interactive elements: links, buttons, selects, textareas.
  const paired = /<(a|button|select|textarea)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = paired.exec(html))) {
    const tag = m[1].toLowerCase();
    const role = tag === 'a' ? 'link' : tag;
    const name = m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const kind: ActionKind =
      tag === 'a'
        ? 'navigate'
        : tag === 'select'
          ? 'select'
          : tag === 'textarea'
            ? 'fill'
            : 'click';
    out.push({ id: `${role}:${name || i}`, role, name, kind });
    i += 1;
  }

  // Void <input> elements (name from aria-label / placeholder / name / type).
  // Hidden inputs are not user-actionable, so they don't count.
  const inputs = /<input\b([^>]*)>/gi;
  while ((m = inputs.exec(html))) {
    const attrs = m[1];
    const type = (
      /type=["']?([^"'\s>]+)/i.exec(attrs)?.[1] ?? 'text'
    ).toLowerCase();
    if (type === 'hidden') continue;
    const name =
      /(?:aria-label|placeholder|name)=["']([^"']+)["']/i.exec(attrs)?.[1] ??
      type;
    const kind: ActionKind = /^(checkbox|radio|submit|button|reset)$/.test(type)
      ? 'click'
      : 'fill';
    out.push({ id: `input:${name || i}`, role: 'input', name, kind });
    i += 1;
  }

  return out;
}
