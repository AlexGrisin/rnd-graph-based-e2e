import type { Observation } from './types.js';
import type { CoverageHints } from './sitemap.js';

/**
 * Derive a concise structural profile of the app from what we already have:
 * the homepage observation's links and the sitemap hints. This grounds the
 * decider in the site's shape (page families, scale) without it having to
 * rediscover the structure each run. Pure and testable.
 *
 * It complements — does not replace — an authored context file, which carries
 * business rules the structure can't reveal (e.g. "size required before add").
 */
export function deriveAppProfile(
  baseUrl: string,
  root: Observation,
  hints?: CoverageHints,
): string {
  const origin = new URL(baseUrl).origin;

  const urls = [
    ...root.actions.map((a) => a.href).filter((h): h is string => Boolean(h)),
    ...(hints?.urls ?? []),
  ];

  const families = new Map<string, number>();
  for (const u of urls) {
    try {
      const parsed = new URL(u, baseUrl);
      if (parsed.origin !== origin) continue;
      const family = parsed.pathname
        .split('/')
        .filter(Boolean)
        .slice(0, 2)
        .join('/');
      if (family) families.set(family, (families.get(family) ?? 0) + 1);
    } catch {
      /* ignore unparseable */
    }
  }

  const topFamilies = [...families.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([family]) => `/${family}`);

  const lines = ['# Auto-derived structure', `Site origin: ${origin}`];
  if (topFamilies.length) {
    lines.push(`Path families seen: ${topFamilies.join(', ')}`);
  }
  if (hints) {
    lines.push(
      `Sitemap: ${hints.urls.length} URLs (${hints.productUrls.length} product-like)${hints.truncated ? ', truncated' : ''}.`,
    );
    if (hints.productUrls[0]) {
      lines.push(`Example product URL: ${hints.productUrls[0]}`);
    }
  }
  return lines.join('\n');
}

/** Combine an optional authored profile with the auto-derived structure. */
export function buildAppContext(
  authored: string | undefined,
  derived: string,
): string {
  return [authored?.trim(), derived].filter(Boolean).join('\n\n');
}
