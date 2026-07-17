# Example: purchase journey (this repo)

Captured from the home → PDP → cart → checkout (no payment) POC.

## Gate A (intent) — locked decisions

- Separate auth and purchase machines
- MVP reach PDP via **direct `PRODUCT_PATH`** (not search/catalog)
- Final state: `checkout` (shipping / secure checkout; no payment)

## Probe findings

| Screen   | URL pattern              | Notes                                                                           |
| -------- | ------------------------ | ------------------------------------------------------------------------------- |
| Home     | `/en_nl`                 | Existing `HomePage`                                                             |
| PDP      | `/shop/men/jeans/...`    | Need width + length (`data-testid`: `width-size`, `length-size`, `add-to-cart`) |
| Cart     | `/checkout/shopping-bag` | Assert non-empty; “Proceed to checkout”                                         |
| Checkout | `/checkout/shipping`     | Guest form `#guestform.email` then shipping; overlays include Exponea           |

## Gate B — machine

```
home --OPEN_PDP--> pdp --ADD_TO_CART--> cart --GO_CHECKOUT--> checkout (final)
```

Assertions:

- `pdp` — URL `/shop/` + add-to-cart visible
- `cart` — shopping bag URL + not empty + proceed link
- `checkout` — `/checkout/shipping` + Secure checkout / Delivery heading

## Glue files added

- `src/machines/app-purchase.machine.ts`
- `tests/support/pages/pdp.page.ts`, `cart.page.ts`, `checkout.page.ts`
- `tests/support/actions/app-purchase.actions.ts` + stub events
- `tests/mbt/purchase-graph-driven.spec.ts`
- `tests/support/config/app-product.ts`

## Validation commands

```bash
npm test -- --project=stub
npm test -- --project=app --grep "Purchase graph-driven.*→ checkout"
```

## Stabilization lessons (encode in future runs)

- Extend stub `createMockPage` when POMs use `getByTestId` / `locator`
- Dismiss Exponea as well as OneTrust/push
- Wait for cart **badge count**, not only navigation
- Checkout CTA click may need fallback (`goto /checkout/shipping`) then guest email submit
