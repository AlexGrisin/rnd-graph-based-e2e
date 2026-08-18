import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';
import { classifyParty } from '../../../src/exploration/index.js';
import type {
  ActionResult,
  ExplorationHost,
  Observation,
  Signal,
  VisibleAction,
} from '../../../src/exploration/index.js';

/**
 * Live `ExplorationHost` — the ONLY component that touches a real site.
 *
 * Implements the same two-method contract the coordinator drives, backed by a
 * real Chromium page: `open` = navigate + snapshot, `act` = interact + snapshot.
 * All action *choice* and safety gating happen upstream in `src/exploration/`;
 * this adapter only executes what it is told and reports what it observes.
 */
export type PlaywrightHostOptions = {
  /** Site origin, used to flag unexpected origin changes. */
  baseUrl: string;
  /** Directory for screenshot evidence; screenshots are skipped if absent. */
  evidenceDir?: string;
  headless?: boolean;
  navTimeoutMs?: number;
  actionTimeoutMs?: number;
  /**
   * Settle wait after a NAVIGATION. Kept short — a page load already takes real
   * time, and retail pages never truly idle so a long networkidle cap is pure
   * latency. Most exploration steps are navigations, so this is the main speed
   * lever.
   */
  settleMs?: number;
  /**
   * Settle wait after a CLICK/submit. Longer, because clicks are instant but the
   * UI they trigger (cart count, drawers, validation) updates via async XHR — a
   * short wait snapshots a stale page (e.g. bag count still 0 after add).
   */
  clickSettleMs?: number;
  /** Capture a screenshot per observation (evidence). Disable for speed. */
  captureScreenshots?: boolean;
  /** Max interactive elements captured per page (bounded; excess is dropped). */
  maxActionsPerPage?: number;
};

/**
 * Consent/cookie/marketing vendors whose console + network noise is NOT site
 * behavior. Signals mentioning these are dropped so overlay handling (and the
 * banners themselves) leave no trace in exploration telemetry.
 */
const OVERLAY_NOISE = [
  'onetrust',
  'cookielaw',
  'cookiepro',
  'otsdkstub',
  'cookiebot',
  'cybot',
  'consentcdn',
  'exponea',
  'bloomreach',
  'usercentrics',
  'trustarc',
];

function isOverlayNoise(text: string): boolean {
  const t = text.toLowerCase();
  return OVERLAY_NOISE.some((p) => t.includes(p));
}

/** First absolute URL found in a message, for party classification. */
function firstUrlIn(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s'")]+/);
  return m ? m[0] : undefined;
}

type FieldMeta = {
  type: string;
  name: string;
  label: string;
  placeholder: string;
  autocomplete: string;
};

/**
 * Fields we must NEVER type into — credentials, payment, and secret PII. These
 * are surfaced but flagged consequential so the coordinator skips them; this is
 * also a defense-in-depth check at fill time.
 */
function isSensitiveField(f: FieldMeta): boolean {
  const hay =
    `${f.type} ${f.name} ${f.label} ${f.placeholder} ${f.autocomplete}`.toLowerCase();
  return (
    f.type === 'password' ||
    /password|passcode|card.?number|cardnumber|cc-?num|cvv|cvc|security.?code|iban|ssn|social.?security|account.?number|routing/.test(
      hay,
    )
  );
}

/** A safe, synthetic value for a non-sensitive field, chosen by type/label. */
function synthesizeFieldValue(f: FieldMeta): string {
  const hay =
    `${f.type} ${f.name} ${f.label} ${f.placeholder} ${f.autocomplete}`.toLowerCase();
  if (/e-?mail/.test(hay)) return 'explore+test@example.com';
  if (/phone|tel|mobile/.test(hay)) return '07700900000'; // UK test range
  if (/post.?code|postal|\bzip\b/.test(hay)) return 'M1 1AE';
  if (/first.?name|given.?name/.test(hay)) return 'Test';
  if (/last.?name|surname|family.?name/.test(hay)) return 'Explorer';
  if (/full.?name|your.?name|\bname\b/.test(hay)) return 'Test Explorer';
  if (/city|town/.test(hay)) return 'Manchester';
  if (/street|address/.test(hay)) return 'Test Street';
  if (/house|number/.test(hay)) return '1';
  if (/compan|organi[sz]ation/.test(hay)) return 'Test Co';
  if (/search|query|\bq\b/.test(hay)) return 'jeans';
  if (f.type === 'number') return '1';
  return 'test';
}

export class PlaywrightHost implements ExplorationHost {
  private browser?: Browser;
  private page?: Page;
  private readonly baseOrigin: string;
  private readonly opts: Required<
    Omit<PlaywrightHostOptions, 'evidenceDir'>
  > & { evidenceDir?: string };
  private signals: Signal[] = [];
  private tick = 0;
  /** Number of interactive elements dropped by the per-page cap (telemetry). */
  droppedActions = 0;

  constructor(options: PlaywrightHostOptions) {
    this.baseOrigin = new URL(options.baseUrl).origin;
    this.opts = {
      baseUrl: options.baseUrl,
      evidenceDir: options.evidenceDir,
      headless: options.headless ?? true,
      navTimeoutMs: options.navTimeoutMs ?? 30_000,
      actionTimeoutMs: options.actionTimeoutMs ?? 15_000,
      settleMs: options.settleMs ?? 2_000,
      clickSettleMs: options.clickSettleMs ?? 4_000,
      captureScreenshots: options.captureScreenshots ?? true,
      maxActionsPerPage: options.maxActionsPerPage ?? 120,
    };
  }

  async start(): Promise<void> {
    if (this.opts.evidenceDir) {
      await mkdir(this.opts.evidenceDir, { recursive: true });
    }
    this.browser = await chromium.launch({ headless: this.opts.headless });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
    this.wireSignals(this.page);
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }

  async open(url: string): Promise<Observation> {
    await this.load(url);
    const { observation, errorMessages, validationMessages } =
      await this.observePage('open');
    return {
      ...observation,
      signals: [
        ...this.drain(),
        ...this.errorSignals(errorMessages),
        ...this.validationSignals(validationMessages),
      ],
    };
  }

  async act(action: VisibleAction): Promise<ActionResult> {
    const page = this.requirePage();

    // On-origin link → navigate directly (deterministic; avoids popups/_blank).
    if (action.kind === 'navigate' && action.href) {
      await this.load(action.href);
      return this.buildOutcome(action.id);
    }

    const locator = page.locator(`[data-explore-id="${action.id}"]`);

    // Form fields: type a safe synthetic value / pick an option.
    if (action.kind === 'fill') return this.fillField(action, locator);
    if (action.kind === 'select') return this.selectField(action, locator);

    // Otherwise click the tagged element, clearing any blocking overlay first.
    return this.clickWithOverlayClear(action, locator);
  }

  /** Type a safe synthetic value into a non-sensitive field. */
  private async fillField(
    action: VisibleAction,
    loc: Locator,
  ): Promise<ActionResult> {
    const meta = await this.readFieldMeta(action.id);
    // Defense in depth: sensitive fields are flagged consequential and should
    // already have been skipped, but never type into one even if we get here.
    if (isSensitiveField(meta)) {
      return {
        failed: true,
        signals: [
          ...this.drain(),
          {
            kind: 'obstructed',
            message: `refused to fill sensitive field "${action.name}"`,
            party: 'first',
          },
        ],
      };
    }
    try {
      await loc.fill(synthesizeFieldValue(meta), {
        timeout: this.opts.actionTimeoutMs,
      });
    } catch (err) {
      return {
        failed: true,
        signals: [
          ...this.drain(),
          {
            kind: 'timeout',
            message: `fill "${action.name}": ${(err as Error).message}`,
            party: 'first',
          },
        ],
      };
    }
    await this.settle(this.opts.clickSettleMs);
    return this.buildOutcome(action.id);
  }

  /** Pick the first real option of a <select>. */
  private async selectField(
    action: VisibleAction,
    loc: Locator,
  ): Promise<ActionResult> {
    try {
      await loc
        .selectOption({ index: 1 })
        .catch(() => loc.selectOption({ index: 0 }));
    } catch (err) {
      return {
        failed: true,
        signals: [
          ...this.drain(),
          {
            kind: 'timeout',
            message: `select "${action.name}": ${(err as Error).message}`,
            party: 'first',
          },
        ],
      };
    }
    await this.settle(this.opts.clickSettleMs);
    return this.buildOutcome(action.id);
  }

  /** Read a field's attributes (for value synthesis / sensitivity checks). */
  private async readFieldMeta(actionId: string): Promise<FieldMeta> {
    const empty = {
      type: '',
      name: '',
      label: '',
      placeholder: '',
      autocomplete: '',
    };
    try {
      return await this.requirePage().evaluate((id) => {
        const el = document.querySelector(
          `[data-explore-id="${id}"]`,
        ) as HTMLElement | null;
        if (!el) {
          return {
            type: '',
            name: '',
            label: '',
            placeholder: '',
            autocomplete: '',
          };
        }
        let label = el.getAttribute('aria-label') ?? '';
        if (!label && el.id) {
          const lab = document.querySelector(
            `label[for="${CSS.escape(el.id)}"]`,
          );
          if (lab) label = lab.textContent ?? '';
        }
        return {
          type: (
            (el as HTMLInputElement).type ?? el.tagName.toLowerCase()
          ).toLowerCase(),
          name: el.getAttribute('name') ?? '',
          label: label.replace(/\s+/g, ' ').trim(),
          placeholder: el.getAttribute('placeholder') ?? '',
          autocomplete: el.getAttribute('autocomplete') ?? '',
        };
      }, actionId);
    } catch {
      return empty;
    }
  }

  /**
   * Click an element, first clearing any overlay covering it. If the click still
   * fails: escape, re-clear, and retry once. A click blocked by a NON-overlay
   * element is reported as `obstructed` (a real interaction problem); an overlay
   * we cleared leaves no trace (it is chrome, like the consent banner).
   */
  private async clickWithOverlayClear(
    action: VisibleAction,
    loc: Locator,
  ): Promise<ActionResult> {
    const page = this.requirePage();
    await this.dismissOverlays();
    await this.clearClickBlockers(action.id);
    try {
      await loc.click({ timeout: this.opts.actionTimeoutMs });
    } catch {
      await this.dismissOverlays();
      await page.keyboard.press('Escape').catch(() => {});
      const blocker = await this.clearClickBlockers(action.id);
      try {
        await loc.click({ timeout: this.opts.actionTimeoutMs });
      } catch (err) {
        const obstructed = blocker !== null && !blocker.cleared;
        return {
          failed: true,
          signals: [
            ...this.drain(),
            {
              kind: obstructed ? 'obstructed' : 'timeout',
              message: obstructed
                ? `click "${action.name}" blocked by ${blocker.desc}`
                : `click "${action.name}": ${(err as Error).message}`,
              party: 'first',
            },
          ],
        };
      }
    }
    await this.settle(this.opts.clickSettleMs); // clicks trigger async UI
    await this.dismissOverlays();
    return this.buildOutcome(action.id);
  }

  /**
   * If another element covers the target, decide whether it is an overlay and,
   * if so, close it (prefer its own close control, else remove it). Returns
   * `{ desc, cleared }` describing the blocker, or null if nothing blocks. A
   * non-overlay blocker is left in place (`cleared: false`).
   */
  private async clearClickBlockers(
    actionId: string,
  ): Promise<{ desc: string; cleared: boolean } | null> {
    try {
      return await this.requirePage().evaluate((id) => {
        const el = document.querySelector(`[data-explore-id="${id}"]`);
        if (!el) return null;
        (el as HTMLElement).scrollIntoView({
          block: 'center',
          inline: 'center',
        });
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        if (!top || top === el || el.contains(top) || top.contains(el)) {
          return null; // nothing covering the target
        }
        const OVERLAY_RE =
          /modal|overlay|dialog|popup|drawer|backdrop|lightbox|interstitial|exponea|subscription|newsletter|consent|onetrust/i;
        let node: Element | null = top;
        for (let i = 0; i < 6 && node; i++) {
          const cs = getComputedStyle(node);
          const z = parseInt(cs.zIndex) || 0;
          const cls = node.className?.toString() ?? '';
          const overlayish =
            (cs.position === 'fixed' || cs.position === 'absolute') &&
            (z >= 10 ||
              OVERLAY_RE.test(cls) ||
              node.getAttribute('role') === 'dialog');
          if (overlayish) {
            const first = cls.trim().split(/\s+/)[0];
            const desc = `overlay:${node.tagName.toLowerCase()}${first ? `.${first}` : ''}`;
            const closer = node.querySelector<HTMLElement>(
              '[aria-label*="close" i], [title*="close" i], button[class*="close" i], .close, [data-testid*="close" i]',
            );
            if (closer) closer.click();
            else node.remove();
            return { desc, cleared: true };
          }
          node = node.parentElement;
        }
        return { desc: `blocker:${top.tagName.toLowerCase()}`, cleared: false };
      }, actionId);
    } catch {
      return null;
    }
  }

  /**
   * Snapshot the resulting state and fold in captured signals PLUS an active
   * check for visible error UI (validation, alerts, error banners) that a click
   * or submit surfaced — errors that emit no console/network signal.
   */
  private async buildOutcome(label: string): Promise<ActionResult> {
    const { observation, errorMessages, validationMessages } =
      await this.observePage(label);
    this.flagOriginChange(observation.url);
    return {
      outcome: observation,
      signals: [
        ...this.drain(),
        ...this.errorSignals(errorMessages),
        ...this.validationSignals(validationMessages),
      ],
    };
  }

  private errorSignals(messages: string[]): Signal[] {
    return messages.map((message) => ({
      kind: 'errorShown',
      message,
      party: 'first', // visible site error UI
    }));
  }

  private validationSignals(messages: string[]): Signal[] {
    return messages.map((message) => ({
      kind: 'validation',
      message,
      party: 'first', // form validation prompt (informational, not a defect)
    }));
  }

  async screenshot(label: string): Promise<string | undefined> {
    if (!this.opts.captureScreenshots || !this.opts.evidenceDir || !this.page) {
      return undefined;
    }
    const safe = label.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60);
    const path = join(this.opts.evidenceDir, `${this.tick++}-${safe}.png`);
    try {
      await this.page.screenshot({ path });
      return path;
    } catch {
      return undefined;
    }
  }

  // --- internals -----------------------------------------------------------

  private requirePage(): Page {
    if (!this.page) throw new Error('PlaywrightHost.start() was not called');
    return this.page;
  }

  private async load(url: string): Promise<void> {
    const page = this.requirePage();
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.opts.navTimeoutMs,
      });
      await this.settle();
      await this.dismissOverlays();
    } catch (err) {
      this.signals.push({
        kind: 'timeout',
        message: `navigation to ${url}: ${(err as Error).message}`,
      });
    }
  }

  private async settle(ms: number = this.opts.settleMs): Promise<void> {
    try {
      await this.requirePage().waitForLoadState('networkidle', { timeout: ms });
    } catch {
      /* networkidle is best-effort; many retail pages never fully idle, so we
         cap the wait rather than blocking on the old fixed 5s */
    }
  }

  /**
   * Accept cookies once (so the consent cookie persists and the banner stops
   * reappearing on every page) and close marketing/push overlays that block
   * clicks. Idempotent: once the cookie is set the accept control is gone, so
   * re-running each navigation is cheap. The signals these overlays emit are
   * filtered out of telemetry (see `wireSignals`), so this leaves no trace.
   */
  private async dismissOverlays(): Promise<void> {
    try {
      await this.requirePage().evaluate(() => {
        // Cookies: accept once so the consent cookie persists. Handles the two
        // CMPs these targets use — OneTrust and Cookiebot — plus a dark filter.
        const otAccept = document.getElementById('onetrust-accept-btn-handler');
        if (otAccept) otAccept.click();
        document.querySelector('.onetrust-pc-dark-filter')?.remove();
        // Cookiebot (Beaverbrooks): "Allow all", then remove the dialog.
        const cb =
          document.getElementById(
            'CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
          ) ?? document.getElementById('CybotCookiebotDialogBodyButtonAccept');
        if (cb) (cb as HTMLElement).click();
        document.getElementById('CybotCookiebotDialog')?.remove();
        // Push prompt: explicit reject, then remove.
        (
          document.querySelector(
            '.requestPushNotifications__rejectButton',
          ) as HTMLElement | null
        )?.click();
        document.querySelector('.requestPushNotifications')?.remove();
        // Exponea / Bloomreach marketing modals.
        document
          .querySelectorAll(
            '.exponea-subscription-dialog-overlay, .exponea-entrance-modal, [class*="exponea-subscription"]',
          )
          .forEach((el) => el.remove());
      });
    } catch {
      /* overlay dismissal is best-effort */
    }
  }

  /**
   * Read the resulting page — ARIA snapshot, interactive actions + visible
   * error UI (one DOM pass), and a screenshot — all concurrently to minimize
   * per-step latency.
   */
  private async observePage(label: string): Promise<{
    observation: Observation;
    errorMessages: string[];
    validationMessages: string[];
  }> {
    const page = this.requirePage();
    const url = page.url();
    const [aria, info, screenshotRef] = await Promise.all([
      page
        .locator('body')
        .ariaSnapshot()
        .catch(() => {
          this.signals.push({
            kind: 'ariaCaptureFailed',
            message: `at ${url}`,
            party: 'first',
          });
          return '';
        }),
      this.extractPageInfo(),
      this.screenshot(label),
    ]);
    this.droppedActions += info.dropped;
    return {
      observation: { url, aria, actions: info.actions, screenshotRef },
      errorMessages: info.errors,
      validationMessages: info.validations,
    };
  }

  /**
   * Single DOM pass returning both the interactive actions (main content first,
   * capped) and any visible error UI — merged into one `page.evaluate` to avoid
   * a second round-trip.
   */
  private async extractPageInfo(): Promise<{
    actions: VisibleAction[];
    errors: string[];
    validations: string[];
    dropped: number;
  }> {
    try {
      return (await this.requirePage().evaluate((limit) => {
        const isVisible = (el: Element) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== 'hidden' &&
            s.display !== 'none'
          );
        };

        // --- interactive actions + form fields (scan main content first) ---
        const FILLABLE = new Set([
          'text',
          'email',
          'search',
          'tel',
          'number',
          'url',
          'password',
          '',
        ]);
        const SENSITIVE_RE =
          /password|passcode|card.?number|cardnumber|cc-?num|cvv|cvc|security.?code|iban|ssn|social.?security|account.?number|routing/;
        const selector =
          'a[href], button, [role="button"], [role="link"], input[type="submit"], input[type="button"], input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="number"], input[type="url"], input[type="password"], input:not([type]), textarea, select';
        const mains = Array.from(
          document.querySelectorAll('main, [role="main"]'),
        );
        const scopes: Array<Document | Element> = [...mains, document];
        const elSeen = new Set<Element>();
        const elements: Element[] = [];
        for (const scope of scopes) {
          for (const el of Array.from(scope.querySelectorAll(selector))) {
            if (!elSeen.has(el)) {
              elSeen.add(el);
              elements.push(el);
            }
          }
        }
        const seen = new Set<string>();
        const actions: Array<{
          id: string;
          role: string;
          name: string;
          href?: string;
          kind: string;
          consequential?: boolean;
        }> = [];
        let dropped = 0;
        let n = 0;
        for (const el of elements) {
          if (!isVisible(el)) continue;
          const tag = el.tagName.toLowerCase();
          const inputType =
            tag === 'input'
              ? ((el as HTMLInputElement).type || 'text').toLowerCase()
              : '';
          const isField =
            tag === 'textarea' ||
            tag === 'select' ||
            (tag === 'input' && FILLABLE.has(inputType));

          // A readable label for the element/field.
          let label = el.getAttribute('aria-label') ?? '';
          if (!label && isField && el.id) {
            const lab = document.querySelector(
              `label[for="${CSS.escape(el.id)}"]`,
            );
            if (lab) label = lab.textContent ?? '';
          }
          const name = (
            label ||
            (isField ? '' : el.textContent) ||
            el.getAttribute('title') ||
            el.getAttribute('placeholder') ||
            el.getAttribute('name') ||
            (!isField ? (el as HTMLInputElement).value : '') ||
            (isField ? inputType || tag : '')
          )
            .replace(/\s+/g, ' ')
            .trim();
          if (!name) continue;

          const rawHref = el.getAttribute('href') ?? undefined;
          let href: string | undefined;
          try {
            href = rawHref ? new URL(rawHref, location.href).href : undefined;
          } catch {
            href = undefined;
          }
          const idAttr = el.getAttribute('name') || el.id || '';
          const key = `${tag}|${name}|${href ?? ''}|${idAttr}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (actions.length >= limit) {
            dropped += 1;
            continue;
          }

          let kind: string;
          if (tag === 'a' && href) kind = 'navigate';
          else if (tag === 'input' && inputType === 'submit') kind = 'submit';
          else if (tag === 'select') kind = 'select';
          else if (isField) kind = 'fill';
          else kind = 'click';

          // Sensitive fields are surfaced but flagged consequential so the
          // coordinator skips them (never typed into).
          let consequential = false;
          if (isField) {
            const sHay =
              `${inputType} ${el.getAttribute('name') ?? ''} ${el.getAttribute('autocomplete') ?? ''} ${label}`.toLowerCase();
            if (inputType === 'password' || SENSITIVE_RE.test(sHay)) {
              consequential = true;
            }
          }

          const id = `e${n++}`;
          el.setAttribute('data-explore-id', id);
          actions.push({
            id,
            role: el.getAttribute('role') ?? tag,
            name: name.slice(0, 120),
            href,
            kind,
            consequential: consequential || undefined,
          });
        }

        // --- visible messages, split into site errors vs field validation ---
        const ERROR_RE =
          /\b(error|not available|out of stock|sold out|went wrong|try again|failed|declined|unavailable|sorry|problem)\b/i;
        const VALIDATION_RE =
          /please (enter|select|provide|fill|choose|complete)|is required|required field|\brequired\b|enter (a|an|your)|fill (in|out)|invalid (e-?mail|email|phone|number|value|format|date)|must be|select (a|an|your)|choose (a|an|your)|this field/i;
        const errors: string[] = [];
        const validations: string[] = [];
        const seenMsg = new Set<string>();
        const push = (raw: string | null) => {
          const t = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
          if (!t || seenMsg.has(t)) return;
          seenMsg.add(t);
          if (VALIDATION_RE.test(t)) validations.push(t);
          else if (ERROR_RE.test(t)) errors.push(t);
        };
        document
          .querySelectorAll('[role="alert"], [aria-live="assertive"]')
          .forEach((el) => {
            if (isVisible(el)) push(el.textContent);
          });
        // aria-invalid is always field validation (the tool's own input), never
        // promoted to a site defect.
        document.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
          const desc = el.getAttribute('aria-describedby');
          const msgEl = desc
            ? document.getElementById(desc.split(' ')[0])
            : null;
          const fname =
            el.getAttribute('name') || el.getAttribute('id') || 'field';
          const t =
            `invalid field: ${fname}${msgEl ? ` — ${msgEl.textContent}` : ''}`
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 160);
          if (t && !seenMsg.has(t)) {
            seenMsg.add(t);
            validations.push(t);
          }
        });
        document
          .querySelectorAll(
            '.error-message, .field-error, .form-error, .invalid-feedback, [class*="errorMessage"], [data-error]:not([data-error=""])',
          )
          .forEach((el) => {
            if (isVisible(el)) push(el.textContent);
          });

        return {
          actions,
          errors: errors.slice(0, 8),
          validations: validations.slice(0, 8),
          dropped,
        };
      }, this.opts.maxActionsPerPage)) as {
        actions: VisibleAction[];
        errors: string[];
        validations: string[];
        dropped: number;
      };
    } catch {
      return { actions: [], errors: [], validations: [], dropped: 0 };
    }
  }

  private flagOriginChange(url: string): void {
    try {
      if (new URL(url).origin !== this.baseOrigin) {
        this.signals.push({
          kind: 'originChange',
          message: `landed off-origin at ${url}`,
        });
      }
    } catch {
      /* ignore unparseable url */
    }
  }

  private party(url: string | undefined): Signal['party'] {
    return classifyParty(url, this.opts.baseUrl);
  }

  private wireSignals(page: Page): void {
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isOverlayNoise(text)) return; // consent/marketing noise: no trace
      const url = firstUrlIn(text) ?? msg.location()?.url;
      this.signals.push({
        kind: 'consoleError',
        message: text.slice(0, 300),
        party: this.party(url),
      });
    });
    page.on('pageerror', (err) => {
      if (isOverlayNoise(err.message)) return;
      this.signals.push({
        kind: 'pageError',
        message: err.message.slice(0, 300),
        party: this.party(firstUrlIn(err.message)),
      });
    });
    page.on('requestfailed', (req) => {
      const failure = req.failure()?.errorText ?? '';
      if (failure.includes('ERR_ABORTED')) return; // benign (navigation cancels)
      if (isOverlayNoise(req.url())) return;
      this.signals.push({
        kind: 'requestFailed',
        message: `${req.method()} ${req.url().slice(0, 200)} — ${failure}`,
        party: this.party(req.url()),
      });
    });
    page.on('response', (res) => {
      const type = res.request().resourceType();
      if (isOverlayNoise(res.url())) return;
      if (res.status() >= 400 && ['document', 'xhr', 'fetch'].includes(type)) {
        this.signals.push({
          kind: 'httpError',
          message: `${res.status()} ${res.url().slice(0, 200)}`,
          detail: { status: res.status(), resourceType: type },
          party: this.party(res.url()),
        });
      }
    });
  }

  private drain(): Signal[] {
    const out = this.signals;
    this.signals = [];
    return out;
  }
}
