/**
 * robots.txt + sitemap coverage hints (plan §4 "Sitemap catalogue").
 *
 * ADVISORY ONLY. These hints seed intent resolution (§3) and coverage
 * reporting; they NEVER gate a browser navigation. The HTTP boundary is
 * injectable (`fetchText`) so the recorder core stays offline-testable.
 */

export type FetchText = (
  url: string,
  opts: { timeoutMs: number; maxBytes: number },
) => Promise<string>;

export type CoverageHints = {
  robotsUrl: string;
  sitemapUrls: string[];
  /** Sample of discovered page URLs (capped). */
  urls: string[];
  /** URLs heuristically classified as product/PDP pages. */
  productUrls: string[];
  truncated: boolean;
  errors: string[];
};

export type LoadHintsOptions = {
  fetchText?: FetchText;
  timeoutMs?: number;
  maxBytes?: number;
  /** Max sitemap documents to fetch (including nested indexes). */
  maxSitemaps?: number;
  /** Max page URLs to retain. */
  maxUrls?: number;
  /** Predicate deciding whether a URL looks like a product/PDP page. */
  isProductUrl?: (url: string) => boolean;
};

const DEFAULTS = {
  timeoutMs: 8_000,
  maxBytes: 2_000_000,
  maxSitemaps: 5,
  maxUrls: 500,
};

/** Default product heuristic — advisory, deliberately loose. */
export function defaultIsProductUrl(url: string): boolean {
  return (
    /\/(shop|product|products|p)\//i.test(url) || // path segment
    /\/p\/?(?:[?#]|$)/i.test(url) || // ends in /p (Beaverbrooks, SFCC)
    /-p-?\d{3,}/i.test(url) || // -p-123 style
    /\/\d{6,}\//.test(url) // numeric SKU/id segment
  );
}

/** Bounded-read fetch over global `fetch` (Node 18+). */
export const defaultFetchText: FetchText = async (
  url,
  { timeoutMs, maxBytes },
) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const reader = res.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let out = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return out;
};

function originOf(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

function parseRobotsSitemaps(robots: string): string[] {
  const out: string[] = [];
  for (const line of robots.split('\n')) {
    const m = line.match(/^\s*sitemap:\s*(\S+)/i);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

/**
 * Load advisory coverage hints for a site. Failures are captured in `errors`
 * and never thrown — missing hints must not break exploration.
 */
export async function loadCoverageHints(
  baseUrl: string,
  options: LoadHintsOptions = {},
): Promise<CoverageHints> {
  const fetchText = options.fetchText ?? defaultFetchText;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const maxSitemaps = options.maxSitemaps ?? DEFAULTS.maxSitemaps;
  const maxUrls = options.maxUrls ?? DEFAULTS.maxUrls;
  const isProductUrl = options.isProductUrl ?? defaultIsProductUrl;

  const origin = originOf(baseUrl);
  const robotsUrl = `${origin}/robots.txt`;
  const errors: string[] = [];

  let sitemapUrls: string[] = [];
  try {
    const robots = await fetchText(robotsUrl, { timeoutMs, maxBytes });
    sitemapUrls = parseRobotsSitemaps(robots);
  } catch (err) {
    errors.push(`robots: ${(err as Error).message}`);
  }
  if (sitemapUrls.length === 0) {
    sitemapUrls = [`${origin}/sitemap.xml`];
  }

  const urls: string[] = [];
  const queue = [...sitemapUrls];
  const fetchedSitemaps: string[] = [];
  let truncated = false;

  while (queue.length > 0 && fetchedSitemaps.length < maxSitemaps) {
    const sm = queue.shift() as string;
    fetchedSitemaps.push(sm);
    let xml = '';
    try {
      xml = await fetchText(sm, { timeoutMs, maxBytes });
    } catch (err) {
      errors.push(`sitemap ${sm}: ${(err as Error).message}`);
      continue;
    }
    for (const loc of extractLocs(xml)) {
      if (loc.endsWith('.xml')) {
        if (
          fetchedSitemaps.length + queue.length < maxSitemaps &&
          !queue.includes(loc)
        ) {
          queue.push(loc);
        }
        continue;
      }
      if (urls.length >= maxUrls) {
        truncated = true;
        break;
      }
      urls.push(loc);
    }
    if (truncated) break;
  }
  if (queue.length > 0) truncated = true;

  return {
    robotsUrl,
    sitemapUrls: fetchedSitemaps,
    urls,
    productUrls: urls.filter(isProductUrl),
    truncated,
    errors,
  };
}
