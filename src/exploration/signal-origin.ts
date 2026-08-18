import type { SignalParty } from './types.js';

/**
 * First-party vs third-party signal classification (by registrable domain).
 *
 * A signal is first-party when its URL shares the site's registrable domain
 * (e.g. `www.g-star.com` and `al.g-star.com` are both first-party for a
 * `g-star.com` site); anything else (analytics, A/B, CDNs on other domains) is
 * third-party. This lets the report separate real site issues from external
 * vendor noise instead of discarding either.
 */

/** Common multi-label public suffixes, so `co.uk` etc. resolve correctly. */
const SECOND_LEVEL_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'co.nz',
  'com.au',
  'net.au',
  'org.au',
  'co.jp',
  'co.za',
  'com.br',
  'co.in',
  'com.mx',
]);

/** Best-effort registrable domain (no full PSL dependency). */
export function registrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/\.$/, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (SECOND_LEVEL_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

/**
 * Classify a URL relative to the site. Returns 'third' when the URL is absent
 * or unparseable — an unattributable external failure is safer treated as
 * third-party than mislabeled a site issue.
 */
export function classifyParty(
  url: string | undefined,
  baseUrl: string,
): SignalParty {
  if (!url) return 'third';
  try {
    const host = new URL(url).hostname;
    const base = new URL(baseUrl).hostname;
    return registrableDomain(host) === registrableDomain(base)
      ? 'first'
      : 'third';
  } catch {
    return 'third';
  }
}
