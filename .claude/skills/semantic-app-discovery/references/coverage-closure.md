# XState Coverage Closure

Read this reference for full, comprehensive, or coverage-driven exploration and
before claiming that a page or flow is exhausted. Completeness means closure over
the visible, reachable, authorized, semantically meaningful application surface;
it is not a claim that hidden or inaccessible functionality does not exist.

## Temporary ledger

Keep the candidate list in the current session. For a campaign that must resume, use a redacted temporary ledger under `agents/TEMP/semantic-app-discovery/` and delete it after closure. Do not create a committed coverage file, validation inventory, or frontier artifact.

- The target XState machine contains accepted states, events, and transitions.
- Page objects, action maps, fixtures, and the state verifier contain accepted executable wiring.
- The temporary ledger records pending, blocked, and unavailable candidates during discovery.

`explored` means executed with sufficient evidence. `blocked` and `unavailable`
are explicit gaps, not exercised coverage. `pending` means the campaign is not
complete while that candidate remains safely reachable.

## State-surface audit

For every known state, restore its browser situation when possible, take a fresh snapshot, and inspect the meaningful surfaces
within the semantic target:

- primary content, forms, and contextual controls;
- header, account, and journey navigation;
- relevant footer, legal, privacy, terms, consent, support, delivery, returns,
  finance, warranty, and commerce navigation; and
- safely revealable menus, tabs, accordions, or disclosures that may expose
  business capabilities, refreshing the snapshot after each reveal.

Record one temporary candidate per normalized intent before exercising it. Do not equate a DOM inventory with business coverage, and do not create candidates for decorative, presentational, duplicate, or out-of-scope controls.

For each recognized state, capture the smallest directly observed page-object assertion contract for its essential business components and content. Record an integration gap when no stable locator can represent an essential component or when the assertion cannot prove the required behavior.

## Action and transition closure

A state is closed for events and transitions only when:

- every meaningful visible action or navigation intent is represented in the temporary ledger;
- every safe candidate has been executed from a recognized source page;
- each explored event has at least one directly observed outcome modeled as a transition, including meaningful same-state outcomes;
- materially different safe outcomes are represented by explicit events or deterministic guarded transitions;
- every integrated event has a replayable page-object method, live action-map handler, stub handler, and stable post-action assertion; and
- parameterized events have representative evidence that the generic browser method, destination equivalence, and postcondition work. Do not exercise every interchangeable value merely to inflate coverage.

If an action is visible but cannot be safely executed, preserve it as `blocked` or `unavailable`; do not mark it explored or omit it.

## Validation closure

For every meaningful form, input-bearing action, filter, eligibility rule, consent
gate, or disabled prerequisite, consider only applicable business validation
families:

- missing required input;
- invalid format;
- supported range or boundary behavior;
- field or option dependency;
- consent or eligibility requirement;
- disabled or unmet prerequisite;
- rejected submission or business error; and
- success confirmation when safe to exercise.

This is a semantic audit, not combinatorial fuzzing. Create a frontier candidate
only when visible UI evidence, an observed behavior, or the business meaning of the
capability supports the probe. Never invent unapproved values or infer a validation
as observed.

For every safe validation candidate:

1. Restore a known source condition and use approved test data.
2. Reuse the existing trigger action with validation-specific input overrides.
3. Execute the probe once and wait for a settled result.
4. Capture direct positive evidence and, when stable, negative or unchanged-page
   evidence.
5. Add a modeled state or transition only when the evidence is stable and the required browser assertion can be implemented.

Keep directly observed but currently unsupported assertions as reported integration gaps. Mark unexercised unsafe or data-starved probes `blocked` or `unavailable`; do not weaken assertions to make them executable.

## Campaign closure audit

Run breadth-first iterations over every known state. A newly observed state or newly discovered candidate resets closure and returns to the temporary ledger.

A full campaign may report closure only after:

- every known state has received a complete state-surface audit;
- every known state has a directly observed page-object assertion or an explicit integration gap;
- no safe reachable candidate remains pending;
- every explored event has an observed transition and complete integrated browser wiring;
- every safe validation candidate has been exercised from direct evidence;
- all blocked, unavailable, and integration gaps are reported explicitly; and
- two consecutive complete audit passes across known states discover no new meaningful candidates, unless the caller's budget ends earlier.

If the budget ends before closure, report `incomplete` and never claim full coverage. If no pending work remains but explicit gaps exist, report `complete_with_gaps`. Report `complete` only when closure passes without blocked, unavailable, or integration gaps in the requested scope.

## Final derived summary

Report a concise summary in the final response: closure status; states audited; events modeled; transitions observed; validations exercised; and remaining blocked, unavailable, or integration gaps. Counts summarize evidence; they do not replace the XState machine and executable repository wiring.
