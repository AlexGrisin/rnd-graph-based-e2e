import type { VisibleAction, ActionKind } from './types.js';

/**
 * Action ranker — the "decide" step (plan FR-03).
 *
 * Ranks visible actions by usefulness and unvisited coverage, biased only by
 * the target's own keywords. Contains NO site URLs or scripted sequences: the
 * same function ranks any page on any site. This is what keeps exploration
 * "autonomous" rather than a replay of an encoded journey.
 */
export type RankContext = {
  /** Keywords derived from the semantic target (intent-map). */
  keywords: string[];
  /** Origin of the site under exploration, for scope scoring. */
  baseOrigin: string;
  /** Origin+pathname of every state already visited. */
  visitedUrls: ReadonlySet<string>;
};

const KIND_WEIGHT: Record<ActionKind, number> = {
  click: 9, // primary CTAs slightly above plain links
  navigate: 8,
  search: 7,
  fill: 5,
  select: 4,
  submit: 3,
  other: 1,
};

/** origin+pathname of an href resolved against a base, or null if unparseable. */
export function canonicalUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/** True if `href` resolves to a different origin than the site (a scope exit). */
export function isOffOrigin(href: string, baseOrigin: string): boolean {
  try {
    return new URL(href, baseOrigin).origin !== baseOrigin;
  } catch {
    return false;
  }
}

export function scoreAction(action: VisibleAction, ctx: RankContext): number {
  let score = KIND_WEIGHT[action.kind] ?? 0;
  const name = action.name.toLowerCase();
  const href = action.href?.toLowerCase() ?? '';

  // Keyword relevance: match against the visible name or the target path.
  if (ctx.keywords.some((k) => name.includes(k) || href.includes(k))) {
    score += 50;
  }

  if (action.href) {
    if (isOffOrigin(action.href, ctx.baseOrigin)) {
      score -= 100; // off-origin: a scope exit, tried last
    } else {
      const canon = canonicalUrl(action.href, ctx.baseOrigin);
      if (canon && !ctx.visitedUrls.has(canon)) score += 20; // unvisited coverage
    }
  }

  return score;
}

/** Return actions sorted by descending usefulness (stable for ties). */
export function rankActions(
  actions: VisibleAction[],
  ctx: RankContext,
): VisibleAction[] {
  return actions
    .map((action, index) => ({
      action,
      index,
      score: scoreAction(action, ctx),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.action);
}
