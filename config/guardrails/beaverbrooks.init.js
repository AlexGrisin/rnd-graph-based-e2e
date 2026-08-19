// GENERATED — do not edit. Built by tests/support/exploration/guardrails.ts from
// src/exploration/consequence-policy.ts (CONSEQUENCE_PATTERNS) + config/guardrails/<site>.json.
// Regenerate: UPDATE_GUARDRAILS=1 npx playwright test --project=exploration guardrails
(function guardrailRuntime(config) {
  const w = window;
  if (w.__exploreGuardrails) return; // idempotent across re-injection
  const stats = {
    neutralized: 0,
    dismissed: 0
  };
  w.__exploreGuardrails = stats;
  const matchers = config.patterns.map(p => ({
    re: new RegExp(p.source, p.flags),
    reason: p.reason
  }));
  const accessibleName = el => {
    const aria = el.getAttribute('aria-label');
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const value = el.value || '';
    return (aria || text || value).toLowerCase();
  };
  const neutralize = () => {
    const controls = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]');
    controls.forEach(el => {
      const marked = el;
      if (marked.__exploreBlocked) return;
      const name = accessibleName(el);
      if (!name) return;
      const hit = matchers.find(m => m.re.test(name));
      if (!hit) return;
      marked.__exploreBlocked = true;
      marked.setAttribute('data-explore-blocked', hit.reason);
      marked.style.pointerEvents = 'none';
      marked.disabled = true;
      marked.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
      }, true);
      stats.neutralized += 1;
    });
  };
  const dismiss = () => {
    config.overlayAcceptSelectors.forEach(sel => {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        stats.dismissed += 1;
      }
    });
    config.overlayRemoveSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(n => {
        n.remove();
        stats.dismissed += 1;
      });
    });
  };
  const run = () => {
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
    document.addEventListener('DOMContentLoaded', run, {
      once: true
    });
  }
  window.addEventListener('load', run, {
    once: true
  });
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  });
  const observe = () => observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  if (document.documentElement) {
    observe();
  } else {
    document.addEventListener('DOMContentLoaded', observe, {
      once: true
    });
  }
})({"patterns":[{"source":"\\b(place( your)? order|submit order|complete (order|purchase))\\b","flags":"i","reason":"order placement"},{"source":"\\b(pay|pay now|make payment|complete payment|confirm and pay)\\b","flags":"i","reason":"payment"},{"source":"\\b(buy now|purchase now)\\b","flags":"i","reason":"purchase"},{"source":"\\b(delete|remove account|close account)\\b","flags":"i","reason":"destructive action"},{"source":"\\b(save (card|payment|address)|add (card|payment method))\\b","flags":"i","reason":"personal-data submission"},{"source":"\\b(send|send message|send email|submit (enquiry|inquiry|message|form))\\b","flags":"i","reason":"communication send"},{"source":"\\b(submit review|write a review|post (a )?(review|comment)|publish)\\b","flags":"i","reason":"content publish"}],"overlayAcceptSelectors":["#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll","#CybotCookiebotDialogBodyButtonAccept"],"overlayRemoveSelectors":["#CybotCookiebotDialog","#CybotCookiebotDialogBodyUnderlay"]});
