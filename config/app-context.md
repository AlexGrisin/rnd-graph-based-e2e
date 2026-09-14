# Application context — Beaverbrooks (BASE_URL)

Authored notes that ground the exploration agent. The `/explore` command reads
this profile before navigating. Edit it when the configured target site changes.

UK jewellery & watch retailer (rings, watches, necklaces, bracelets, earrings,
gifts). English UI, GBP, UK locale. Verified against robots.txt + sitemaps.

## Page types (URL shapes)

- **Home**: `BASE_URL` (`/`)
- **Category listing (PLP)**: `/<category>/<sub>/<sub>` — e.g.
  `/rings/engagement-rings`, `/watches/gold-watches/mens-watches`,
  `/jewellery/...`. Grids of product tiles. Top categories include rings,
  watches, jewellery, earrings, necklaces, bracelets, gifts.
- **Product (PDP)**: `/<8-digit-id>/<Product-Name>/p` — e.g.
  `/0149753/18ct-Yellow-Gold-Three-Stone-Diamond-Engagement-Ring/p`. The path is
  a numeric product id + slugged name and **ends in `/p`**.
- **Bag / cart**: `/bag`
- **Checkout**: `/checkout`
- **Account**: `/my-account`
- **Search**: `/search`

## Key flows & prerequisites

- **Add to bag** from a PDP. Some products require selecting an **option first**
  — most importantly a **ring size** for rings (analogous to a size selector).
  Watches/bracelets usually add without options. Clicking add-to-bag with a
  required option unset is a useful **negative probe** (expect an option prompt /
  no-op, not an add).
- After a successful add, the **bag counter increments** and a mini-bag/bag
  page shows the item (the update may be async — allow a moment).
- **Guest checkout**: reach `/bag` → `/checkout`; the checkout may gate on an
  email / account step. Fill fields with the tool's safe synthetic values, but
  **stop before payment** (Place order / Pay are auto-skipped).

## Overlays / consent

- **Cookiebot** cookie consent — auto-accepted (Allow all) and removed.
- Watch for newsletter / marketing modals; the generic overlay-clear handles
  most, but add site-specific selectors here if any block clicks.

## Notes for the explorer

- Sitemaps are **plain XML** (`sitemap-product.xml`, `sitemap-category.xml`, …),
  so product-URL seeding works — `explore pdp` can start on a real PDP.
- `robots.txt` disallows `/bag`, `/checkout`, `/my-account`, `/product/`,
  `/search` for crawlers. These are **advisory only** here (we explore visible
  links, not a crawl) — but be a good citizen: this is a live production site,
  so stay within the bounded budget.
