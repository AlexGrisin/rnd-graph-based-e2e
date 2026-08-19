import { readFile } from 'node:fs/promises';
import { CONSEQUENCE_PATTERNS } from '../../../src/exploration/consequence-policy.js';

/**
 * Page-side guardrails for MCP-driven exploration.
 *
 * When the agent drives Microsoft's Playwright MCP directly, we can no longer
 * wrap `browser_click` to enforce the consequence gate in a tool boundary. Instead
 * we inject a script into every page that:
 *   1. dismisses consent/marketing overlays (site-specific selectors), and
 *   2. neutralizes consequential controls (order/payment/account/etc.) by matching
 *      their accessible name against the shared `CONSEQUENCE_PATTERNS`.
 *
 * Site-specific knowledge (selectors, extra consequential names) lives as DATA in
 * a per-site config file, never in this generic generator — see
 * `config/guardrails/<site>.json` and `loadSiteGuardrails`.
 *
 * Delivery is delivery-agnostic: the returned string can be passed to the MCP
 * server as an init script if it supports one, or evaluated by the skill via
 * `browser_evaluate` after each navigation.
 */
export type SiteGuardrails = {
  /** Origins the run may stay on (advisory; also passed to `--allowed-origins`). */
  allowedOrigins?: string[];
  /** Selectors to CLICK to accept/close a consent dialog (e.g. "Allow all"). */
  overlayAcceptSelectors?: string[];
  /** Selectors whose matched nodes are REMOVED outright (backdrops, modals). */
  overlayRemoveSelectors?: string[];
  /**
   * Extra site-specific consequential control names, as case-insensitive regex
   * SOURCES (merged with the generic `CONSEQUENCE_PATTERNS`). Keep minimal — do
   * NOT list navigations you want explored (e.g. "proceed to checkout").
   */
  extraConsequentialNames?: string[];
};

type RuntimeConfig = {
  patterns: { source: string; flags: string; reason: string }[];
  overlayAcceptSelectors: string[];
  overlayRemoveSelectors: string[];
};

/** Load a per-site guardrail data file (`config/guardrails/<site>.json`). */
export async function loadSiteGuardrails(
  path: string,
): Promise<SiteGuardrails> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as SiteGuardrails;
}

/**
 * Build the self-contained JS string to inject into the page. Pure and
 * deterministic (no FS, no browser) so it is unit-testable.
 */
export function buildGuardrailScript(site: SiteGuardrails = {}): string {
  const extra = (site.extraConsequentialNames ?? []).map((source) => ({
    source,
    flags: 'i',
    reason: 'site-specific consequential control',
  }));
  const config: RuntimeConfig = {
    patterns: [...CONSEQUENCE_PATTERNS, ...extra],
    overlayAcceptSelectors: site.overlayAcceptSelectors ?? [],
    overlayRemoveSelectors: site.overlayRemoveSelectors ?? [],
  };
  // The consequential-control patterns are NOT authored here or in the .init.js —
  // they are the single source of truth in src/exploration/consequence-policy.ts
  // (CONSEQUENCE_PATTERNS), embedded below. The committed *.init.js is generated
  // output (a path is needed for the MCP --init-script), kept in lockstep by
  // tests/exploration/guardrails.spec.ts. Regenerate, never hand-edit.
  const banner =
    '// GENERATED — do not edit. Built by tests/support/exploration/guardrails.ts from\n' +
    '// src/exploration/consequence-policy.ts (CONSEQUENCE_PATTERNS) + config/guardrails/<site>.json.\n' +
    '// Regenerate: UPDATE_GUARDRAILS=1 npx playwright test --project=exploration guardrails\n';
  return `${banner}(${guardrailRuntime.toString()})(${JSON.stringify(config)});`;
}

/**
 * The injected runtime. MUST be fully self-contained — it is serialized via
 * `.toString()` and executed in the page, so it may only reference `window`,
 * `document`, and its `config` argument (no imports, no outer scope).
 */
function guardrailRuntime(config: RuntimeConfig): void {
  const w = window as unknown as {
    __exploreGuardrails?: { neutralized: number; dismissed: number };
  };
  if (w.__exploreGuardrails) return; // idempotent across re-injection
  const stats = { neutralized: 0, dismissed: 0 };
  w.__exploreGuardrails = stats;

  const matchers = config.patterns.map((p) => ({
    re: new RegExp(p.source, p.flags),
    reason: p.reason,
  }));

  const accessibleName = (el: Element): string => {
    const aria = el.getAttribute('aria-label');
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const value = (el as HTMLInputElement).value || '';
    return (aria || text || value).toLowerCase();
  };

  const neutralize = (): void => {
    const controls = document.querySelectorAll(
      'button, a, [role="button"], input[type="submit"], input[type="button"]',
    );
    controls.forEach((el) => {
      const marked = el as HTMLElement & { __exploreBlocked?: boolean };
      if (marked.__exploreBlocked) return;
      const name = accessibleName(el);
      if (!name) return;
      const hit = matchers.find((m) => m.re.test(name));
      if (!hit) return;
      marked.__exploreBlocked = true;
      marked.setAttribute('data-explore-blocked', hit.reason);
      marked.style.pointerEvents = 'none';
      (marked as unknown as { disabled?: boolean }).disabled = true;
      marked.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
        },
        true,
      );
      stats.neutralized += 1;
    });
  };

  const dismiss = (): void => {
    config.overlayAcceptSelectors.forEach((sel) => {
      const btn = document.querySelector(sel) as HTMLElement | null;
      if (btn) {
        btn.click();
        stats.dismissed += 1;
      }
    });
    config.overlayRemoveSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((n) => {
        n.remove();
        stats.dismissed += 1;
      });
    });
  };

  const run = (): void => {
    try {
      dismiss();
      neutralize();
    } catch {
      /* never let a guardrail error break the page */
    }
  };

  // Cover three timings: (1) now — the script is injected before page scripts,
  // so the DOM is usually empty here; (2) after the document parses; (3) late
  // SPA content, via a mutation observer coalesced to one pass per frame.
  run();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
  window.addEventListener('load', run, { once: true });

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  });
  const observe = (): void =>
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  if (document.documentElement) {
    observe();
  } else {
    document.addEventListener('DOMContentLoaded', observe, { once: true });
  }
}
