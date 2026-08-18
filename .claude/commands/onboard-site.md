---
description: Recon a new target site and settle the autonomous-exploration harness context for it — robots/sitemap/cookie recon, rewrite config/app-context.md, adjust only the harness bits that differ, then smoke-test. Run once when BASE_URL changes.
argument-hint: <base-url>  e.g. https://www.beaverbrooks.co.uk/
---

You are **onboarding a new target site** for the autonomous exploration harness.
Goal: from a base URL, learn the site's real shape and **settle its context** so
`/explore` runs well — with the least code change. The exploration core
(`src/exploration/*`) is site-agnostic and needs nothing; only a few adapters +
the authored profile are site-specific.

**Target:** `$ARGUMENTS` (the new base URL). If empty, ask for it.

Work through the steps, reporting what you found and changed. The Beaverbrooks
onboarding is the worked example these files already reflect.

## 1. Point the harness at the site

Set `BASE_URL` in `.env` (create from `.env.example` if missing):

```bash
grep -q '^BASE_URL=' .env 2>/dev/null && \
  sed -i '' "s|^BASE_URL=.*|BASE_URL=$ARGUMENTS|" .env || \
  printf 'BASE_URL=%s\n' "$ARGUMENTS" >> .env
grep BASE_URL .env
```

Also update the fallback default in `.env.example` and the two live specs
(`tests/exploration-live/*.spec.ts`) for the next person — cosmetic, env wins.

## 2. Recon the site (facts, not guesses)

```bash
# origin for the fetches
ORIGIN=$(node -e "console.log(new URL('$ARGUMENTS').origin)")

# robots.txt → sitemaps + disallowed areas
curl -s --max-time 15 -A "Mozilla/5.0" "$ORIGIN/robots.txt" | sed -n '1,50p'

# cookie / consent tech (drives overlay handling)
curl -s --max-time 20 -A "Mozilla/5.0" "$ORIGIN/" | \
  grep -oiE "onetrust|cookiebot|cybot|civicuk|cookielaw|usercentrics|trustarc|osano|quantcast|didomi|klaro" | sort -u

# product + category URL shapes (from a product/category sitemap if present)
curl -s --max-time 20 -A "Mozilla/5.0" "$ORIGIN/sitemap-product.xml" 2>/dev/null | grep -oE "<loc>[^<]+</loc>" | head -5
curl -s --max-time 20 -A "Mozilla/5.0" "$ORIGIN/sitemap-category.xml" 2>/dev/null | grep -oE "<loc>[^<]+</loc>" | head -5
```

If those sitemap names 404, get the real ones from the `Sitemap:` lines in
robots.txt and fetch those. Note the shapes: what a **PDP** URL looks like, what
a **listing** looks like, and the cart / checkout / account / search paths.

## 3. Rewrite the authored profile (the main deliverable)

Rewrite **`config/app-context.md`** for this site from what recon proved — page
types + URL shapes, key flows and **prerequisites** (e.g. a required size/option
before add-to-bag), the consent/overlay tech, and any known third-party vendors.
This is what grounds the decider; keep it accurate (mark anything unverified as
"likely"). It is loaded automatically by the live specs.

## 4. Adjust harness adapters ONLY where recon shows a mismatch

Change these **only if** the site differs from the current defaults:

- **Product-URL heuristic** — `src/exploration/sitemap.ts` `defaultIsProductUrl`.
  Verify it matches this site's PDP shape (test a real product URL). Extend the
  regex if not (e.g. `/p`-suffix, numeric-id segment). If `productUrls` comes
  back empty in the smoke test, this is why.
- **Consent / overlays** — `tests/support/exploration/playwright-host.ts`
  `dismissOverlays()`. Add this site's cookie-accept selector if it uses a CMP
  not already handled (OneTrust, Cookiebot). Add its consent/analytics vendor
  hostnames to `OVERLAY_NOISE`.
- **Locale field values** — same file, `synthesizeFieldValue()`. Set
  phone/postcode/city/street for the site's country so form fills validate.
- **⚠️ Language** — if the UI is **not English**, `consequence-policy.ts` `RULES`
  (and intent keywords) are English-pattern based and will **miss consequential
  buttons** — a safety gap. Localize the order/pay/account/etc. terms first.

Leave `src/exploration/*` logic otherwise untouched — party classification,
sitemap loading, and app-profile derive from `BASE_URL` automatically.

## 5. Validate

```bash
npx tsc --noEmit 2>&1 | grep -E "exploration|playwright-host" || echo "types ok"
npx playwright test --project=exploration --reporter=line 2>&1 | tail -2   # browser-free suite
```

Then a **bounded live smoke test** and check it actually settled:

```bash
EXPLORE_TARGET="explore pdp" npx playwright test --project=exploration-live \
  tests/exploration-live/explore.live.spec.ts --reporter=line 2>&1 | grep -E "explore\]|passed|failed"
DIR=$(ls -d artifacts/exploration/live-* | tail -1)
python3 -c "import json;g=json.load(open('$DIR/graph.json'));[print(' ',n['url']) for n in g['nodes']]"
python3 -c "import json,os;p='$DIR/routes.json';d=json.load(open(p)) if os.path.exists(p) else {};print('product-like URLs:',len(d.get('productUrls',[])),'| sitemap errors:',d.get('errors',[])[:2])"
```

Confirm: states are on the new origin, `productUrls` > 0 (sitemap seed works),
and for `explore pdp` the entry landed on a real PDP. If cookies re-blocked
clicks or no PDP was reached, revisit step 4.

## 6. Report & hand off

Summarize what was found (URL shapes, consent tech, language) and exactly which
files changed. The site is now settled; `/explore <target>` (pdp, cart, guest
checkout, search) is ready. Report honestly if anything is still shaky (e.g.
sitemap seed didn't work, or a non-English UI needs policy localization).
