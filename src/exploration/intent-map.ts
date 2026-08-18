/**
 * Intent → entry resolution (plan §3).
 *
 * This is the ONLY target-specific logic in the system. It decides where the
 * agent *starts* for a given semantic target; it never constrains where the
 * agent may go afterwards. Unknown / free-text targets degrade to homepage
 * exploration biased toward the target's own words.
 */

/** How to seed the first page for a target. */
export type EntryStrategy =
  | { kind: 'sitemapProduct' } // first product-like URL from the sitemap
  | { kind: 'homeSearch' } // homepage search control, sample a query
  | { kind: 'addToCartThenCart' } // resolve a PDP → add to cart → cart page
  | { kind: 'cartThenCheckoutGuest' } // cart → checkout entry, guest path only
  | { kind: 'homepageBiased'; keywords: string[] }; // fallback

export type ResolvedIntent = {
  /** The raw target the user typed. */
  target: string;
  /** Lowercased, trimmed target. */
  normalizedTarget: string;
  strategy: EntryStrategy;
  /** Words used to bias action ranking toward the target. */
  keywords: string[];
};

const STOP_WORDS = new Set([
  'explore',
  'the',
  'a',
  'an',
  'flow',
  'flows',
  'page',
  'pages',
  'and',
  'of',
  'to',
]);

/** Extract ranking keywords from the target string. */
export function extractKeywords(target: string): string[] {
  return target
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Resolve a semantic target to an entry strategy. Order matters: the most
 * specific match wins (guest checkout before cart before pdp).
 */
export function resolveIntent(target: string): ResolvedIntent {
  const normalizedTarget = target.toLowerCase().trim();
  const keywords = extractKeywords(target);

  const has = (...needles: string[]) =>
    needles.some((n) => normalizedTarget.includes(n));

  let strategy: EntryStrategy;
  if (has('checkout', 'guest')) {
    strategy = { kind: 'cartThenCheckoutGuest' };
  } else if (has('cart', 'basket', 'bag')) {
    strategy = { kind: 'addToCartThenCart' };
  } else if (has('pdp', 'product', 'detail')) {
    strategy = { kind: 'sitemapProduct' };
  } else if (has('search', 'find')) {
    strategy = { kind: 'homeSearch' };
  } else {
    strategy = { kind: 'homepageBiased', keywords };
  }

  return { target, normalizedTarget, strategy, keywords };
}
