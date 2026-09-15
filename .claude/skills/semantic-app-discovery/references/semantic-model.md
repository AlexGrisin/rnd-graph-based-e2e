# Semantic XState Modeling

Read this reference before classifying candidates, pages, actions, transitions, or validations.

## States and equivalence

A state represents one meaningful, stable, testable user situation. It is not necessarily one browser page.

- Model `home`, `login`, `homeAuth`, `myAccount`, `pdp`, or `cart`, not a dropdown, toast, raw DOM tree, record instance, or other transient variation.
- Use a separate state for a stable same-page condition only when it changes the user's meaningful situation or needs distinct verification, such as a login error or authenticated home.
- Use a self-transition when the action leaves the same modeled situation intact.
- Use lower-camel-case state IDs that match state-verifier keys and path labels.

Compare state equivalence by business purpose, user situation, meaningful actions, preconditions, durable blockers, expected outcomes, and stable UI landmarks. Treat route family as browser evidence for a page-object assertion, not as machine data. Ignore presentation, transient notices, entity identity, incidental copy, raw DOM differences, and query or path values that only select instance data.

Reuse an equivalent state. Deduplicate events by normalized intent and equivalent source situation: `add current item to basket` and `add product to cart` are usually equivalent; `continue as guest` and `sign in to continue` are not. The discovery agent proposes equivalence; the reviewer approves source changes.

## Browser evidence and essential content

A page assertion is the smallest stable set of directly observed components and content required to verify a modeled state. Store selectors and assertions only in the relevant Playwright page object.

- Product details commonly require product identity, price, gallery, and the availability or purchase capability appropriate to the modeled situation.
- Product listings commonly require listing identity, a results region, and a representative product card only when the modeled situation guarantees non-empty results.
- Store details commonly require store identity, address, contact details, and opening-hours information.
- Authentication pages commonly require their primary form and meaningful account-recovery or account-navigation capability.

Capture only directly observed, stable business essentials. Ignore decorative imagery, transient promotions, recommendations, personalization, instance-specific text, and optional content. Browser evidence is not machine context, an event, or a separate persistent artifact.

Only claim what the assertion proves. Visibility does not prove an image resource loaded, a displayed value is correct, or a collection has an exact count. Report unsupported evidence as an integration gap rather than weakening the claim.

## Parameterized events

Treat a changing category, product, store, brand, region, or other interchangeable entity label as input data rather than part of the action ID when all of these are true:

- the controls appear in an equivalent source-page context with equivalent prerequisites;
- they express the same business intent and use the same interaction shape;
- their observed destinations are equivalent states with outcomes that differ only by the selected instance; and
- one page-object method and stable postcondition can represent the supported values.

For example, `browse_watches`, `browse_jewellery`, and `browse_gifts` should normally become `browse_category` with a `category` input. Keep `browse_brands` separate when it opens a materially different brand-directory page. Keep separate actions when destination purpose, prerequisite, authorization, side effect, or business outcome differs.

Use a typed event payload only when the value materially affects modeled behavior. Keep values, selectors, URLs, and approved data sources out of the machine context unless the state transition needs that domain value. If one generic action cannot be represented with stable browser behavior, keep the events separate or report the candidate as unavailable.

## Events and transitions

An event is a business intent or a controlled, observable outcome—not a raw browser operation.

- Group all low-level operations serving one intent. Prefer `provide_delivery_address` over separate focus, fill, suggestion, and save actions.
- Ignore menus, help disclosures, hovering, scrolling, and toast dismissal unless they enable or block a meaningful intent.
- Use stable `UPPER_SNAKE_CASE` event types, such as `GO_LOGIN`, `OPEN_PDP`, or `ADD_TO_CART`.
- Name a parameterized event for the shared intent, not a representative value: use `BROWSE_CATEGORY`, not `BROWSE_WATCHES`.
- Add transitions under `states.<state>.on` in the target machine.
- Prefer separate explicit events for separately controlled outcomes. Use guards only when typed context makes the condition deterministic and graph traversal remains meaningful.
- Keep selectors, DOM paths, snapshot refs, instance URLs, test values, and evidence text out of event IDs and machine context.
- Keep the machine pure: no Playwright imports, locators, URLs, credentials, or environment reads.

## Meaningful navigation

Treat visible navigation as a candidate when it exposes or changes a material customer journey, account or authentication state, form alternative, legal/privacy/compliance/consent information, eligibility, delivery, returns, finance, warranty, support, commerce state, or other user goal.

- Consider page content, forms, headers, account navigation, and contextually relevant footers. “All business-related capabilities” includes relevant legal, privacy, terms, consent, account, help, and policy navigation.
- Revealing a menu or disclosure is a discovery operation, not a graph action or state. Refresh the snapshot afterward.
- Ignore decorative home links, same-page anchors, social/share links, and generic global navigation unless relevant to the requested scope.
- Add a transition only after activating the visible control and directly observing the destination situation. Keep unexecuted candidates in the temporary ledger.
- Prefer same-domain read-only navigation. Block unauthorized new-tab or cross-origin destinations.
- Deduplicate global navigation across equivalent pages unless its context, availability, prerequisite, or outcome differs. Registration-linked privacy is contextually distinct from an unrelated footer link.
- Use event IDs such as `OPEN_PRIVACY_POLICY` or `GO_LOGIN`, not `CLICK_LINK` or a URL.

## Validations and error outcomes

Actively exercise safe, business-relevant rules such as required inputs, formats, ranges, field dependencies, eligibility, consent, disabled prerequisites, and error or success feedback. Ignore technical HTML constraints without business meaning.

Keep conditional business rules distinct from static page assertions. Model a validation outcome as a state or self-transition only when it is stable, directly observed, path-relevant, and can be verified through a page object.

- Visible requirements and inferred rules are candidates, not observed behavior.
- Record a validation only after a safe semantic action directly produces observable feedback, rejection, a disabled outcome, or confirmed success condition.
- Prefer reversible probes such as empty required fields, approved invalid formats, and unmet prerequisites when they cannot cause an external side effect.
- Use only approved test data. Never fabricate credentials, personal data, OTPs, secrets, or boundary values.
- Keep unsafe, forbidden, blocked, or data-starved probes out of the machine and report their status in the final result.
- Deduplicate by equivalent state, normalized rule intent, affected capability, and expected outcome.
- Put the observable assertion in the owning page object's `should*` method and register it in `state-verifier.ts` when a distinct state is needed.
- Do not create a validation inventory, YAML sidecar, or generic validator registry.
