import type {
  ActionResult,
  ExplorationHost,
  Observation,
  VisibleAction,
} from '../../src/exploration/index.js';

/**
 * A controlled in-memory site + host for exercising the coordinator without a
 * browser (plan Increment 2 acceptance: "against a controlled local site").
 *
 * This is TEST DATA. It intentionally contains site-specific URLs and controls —
 * the point of the acceptance test is that the coordinator/ranker/policy under
 * `src/exploration/` reach the target here WITHOUT any of these URLs appearing
 * in their code. The multi-page path is discovered, not scripted.
 */

const ORIGIN = 'https://shop.test';

type Page = {
  aria: string;
  actions: VisibleAction[];
  /** Signals emitted when this page is opened (e.g. a JS error on the PDP). */
  signals?: Observation['signals'];
};

function link(name: string, href: string): VisibleAction {
  return { id: `link:${name}`, role: 'link', name, kind: 'navigate', href };
}
function button(name: string): VisibleAction {
  return { id: `button:${name}`, role: 'button', name, kind: 'click' };
}

const PAGES: Record<string, Page> = {
  '/': {
    aria: 'heading Home\nlink Shop\nlink Search\nlink Instagram',
    actions: [
      link('Shop', '/shop'),
      link('Search', '/search'),
      link('Instagram', 'https://instagram.com/brand'),
    ],
  },
  '/shop': {
    aria: 'heading Shop\nlink Blue Jeans\nlink Red Jeans\nlink Home',
    actions: [
      link('Blue Jeans', '/p/blue-1234'),
      link('Red Jeans', '/p/red-5678'),
      link('Home', '/'),
    ],
  },
  '/p/blue-1234': {
    aria: 'heading Blue Jeans\nbutton Add to bag\nbutton Place order\nlink Home',
    actions: [button('Add to bag'), button('Place order'), link('Home', '/')],
    signals: [{ kind: 'consoleError', message: 'Uncaught TypeError on PDP' }],
  },
  '/p/red-5678': {
    aria: 'heading Red Jeans\nbutton Add to bag\nlink Home',
    actions: [button('Add to bag'), link('Home', '/')],
  },
  '/cart': {
    aria: 'heading Cart\nbutton Checkout\nbutton Place order\nlink Continue shopping',
    actions: [
      button('Checkout'),
      button('Place order'),
      link('Continue shopping', '/shop'),
    ],
  },
  '/checkout': {
    aria: 'heading Checkout\nbutton Pay now\nlink Home',
    actions: [button('Pay now'), link('Home', '/')],
  },
  '/search': {
    aria: 'heading Search\nlink Home',
    actions: [link('Home', '/')],
  },
};

/** Button transitions: (path, actionId) → destination path. */
const BUTTON_NAV: Record<string, Record<string, string>> = {
  '/p/blue-1234': { 'button:Add to bag': '/cart' },
  '/p/red-5678': { 'button:Add to bag': '/cart' },
  '/cart': { 'button:Checkout': '/checkout' },
};

export class FixtureHost implements ExplorationHost {
  private currentPath = '/';
  /** Records every URL opened, so the test can assert backtracking occurred. */
  readonly opened: string[] = [];

  private pathOf(url: string): string | null {
    try {
      const u = new URL(url, ORIGIN);
      return u.origin === ORIGIN ? u.pathname : null;
    } catch {
      return null;
    }
  }

  private observe(path: string): Observation {
    const page = PAGES[path];
    if (!page) {
      return {
        url: `${ORIGIN}${path}`,
        aria: `heading Not found ${path}`,
        actions: [],
      };
    }
    return {
      url: `${ORIGIN}${path}`,
      aria: page.aria,
      actions: page.actions,
      signals: page.signals,
    };
  }

  async open(url: string): Promise<Observation> {
    this.opened.push(url);
    const path = this.pathOf(url);
    if (path === null) {
      // Off-origin: a scope exit dead-end (the coordinator normally skips these).
      return { url, aria: `heading External ${url}`, actions: [] };
    }
    this.currentPath = path;
    return this.observe(path);
  }

  async act(action: VisibleAction): Promise<ActionResult> {
    if (action.href) {
      const path = this.pathOf(action.href);
      if (path === null) {
        return { outcome: await this.open(action.href) };
      }
      this.currentPath = path;
      return { outcome: this.observe(path) };
    }
    const dest = BUTTON_NAV[this.currentPath]?.[action.id];
    if (dest) {
      this.currentPath = dest;
      return { outcome: this.observe(dest) };
    }
    // A button with no modeled effect: no state change.
    return {
      failed: true,
      signals: [{ kind: 'noChange', message: `${action.name} did nothing` }],
    };
  }
}
