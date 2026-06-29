# No-LLM Exploration Loop Investigation

Investigation into whether XState graph APIs can replicate the LLM-driven coverage exploration loop used in a sibling project (ExplorerAgent pattern: graph YAML → Claude → scenario JSON → run → recompute gaps → iterate).

## TL;DR

The core loop is fully replicable with `@xstate/graph` APIs already in this codebase. What you lose is natural-language diversity; what you gain is determinism, provable completeness, and zero API latency.

---

## What the LLM loop does (decomposed)

| LLM responsibility                                                                         | Mechanical equivalent                                                                                                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Build prompt from graph YAML                                                               | `getAdjacencyMap(machine)` — exact same information, structured                                                                   |
| Detect coverage gaps (unvisited nodes, underweight transitions, underrepresented personas) | `CoverageTracker` class computing `visitedStates` + `traversedTransitions` sets against the full adjacency map                    |
| Generate scenario paths toward gaps                                                        | `getShortestPaths(machine, { toState: s => isUncovered(s) })` or `getSimplePaths(machine)`                                        |
| Persona / context variation                                                                | Explicit `PersonaConfig[]` matrix; `TraversalOptions.events` / `filterEvents` to vary which transitions are attempted per persona |
| Waypoints (must-pass intermediate states)                                                  | `getPathsFromEvents(machine, explicitEventSequence)` — already exported from `xstate/graph`                                       |
| Iterate until target met or budget exhausted                                               | `while (!tracker.isComplete(target) && iteration < maxIterations)`                                                                |

---

## XState graph API surface available

All exported from `xstate/graph` in `xstate@5.19.2`:

```
getShortestPaths(logic, options?)     — one BFS-minimal path per reachable state
getSimplePaths(logic, options?)       — ALL acyclic paths (combinatorial coverage)
getPathsFromEvents(logic, events[])   — resolve explicit event sequence into a path
getAdjacencyMap(logic)                — full {state → {event → nextState}} graph
```

Key `TraversalOptions` for gap-targeting:

```typescript
{
  toState:      (s) => uncoveredStates.has(s.value),    // steer toward gaps
  fromState:    specificSnapshot,                        // mid-journey start
  filterEvents: (s, e) => personaAllows(persona, e),    // persona filtering
  events:       (s) => personaEventSet(persona, s),     // per-state event override
  limit:        500,                                     // explosion guard
}
```

---

## Proposed architecture

Three new pieces on top of the existing path layer, all in `src/mbt/graph/`.

### 1. `CoverageTracker` (`src/mbt/graph/coverage-tracker.ts`)

```typescript
type TransitionKey = `${string}:${string}`;  // e.g. "login:SUBMIT"

class CoverageTracker {
  private stateVisits  = new Map<string, number>();
  private edgeVisits   = new Map<TransitionKey, number>();

  record(path: StatePath<...>): void {
    // walk path.steps, increment stateVisits and edgeVisits
  }

  gaps(adjacency: AdjacencyMap<...>, minVisits = 1): Array<{state: string, event: string}> {
    // return all (state, event) pairs where edgeVisits < minVisits
  }

  coverage(): { nodes: number; edges: number; nodesPct: number; edgesPct: number }
  isComplete(target: { nodeMin: number; edgeMin: number }): boolean
}
```

Direct analogue of what the LLM prompt receives as "coverage gaps" — except computed exactly.

### 2. `ExplorationLoop` (`src/mbt/graph/exploration-loop.ts`)

```typescript
async function runCoverageLoop(
  machine: AnyActorLogic,
  ctx: MbtContext,
  options: { actions: ActionMap; verifyState?: StateVerifier },
  budget: { maxIterations: number; targetEdgePct: number },
): Promise<CoverageReport> {
  const tracker = new CoverageTracker();
  const adjacency = getAdjacencyMap(machine, {});

  for (let i = 0; i < budget.maxIterations; i++) {
    const gaps = tracker.gaps(adjacency);
    if (!gaps.length) break;

    // target the most-uncovered transition's destination state
    const targetState = gaps[0].state;
    const paths = getShortestPaths(machine, {
      toState: (s) => serializeState(s) === targetState,
    });

    for (const path of paths) {
      await testPath(path, ctx, options);
      tracker.record(path);
    }

    if (tracker.coverage().edgesPct >= budget.targetEdgePct) break;
  }

  return tracker.coverage();
}
```

### 3. Persona matrix (optional, deterministic)

```typescript
type PersonaConfig = {
  name: string;
  credentials: { email: string; password: string };
  viewport?: { width: number; height: number };
  allowedEvents?: string[]; // restrict which transitions this persona takes
};

const personas: PersonaConfig[] = [
  { name: 'valid_user', credentials: validCreds },
  {
    name: 'invalid_user',
    credentials: badCreds,
    allowedEvents: ['GO_LOGIN', 'FAIL'],
  },
];

// Per persona:
// getShortestPaths(machine, { filterEvents: (s, e) => persona.allowedEvents?.includes(e.type) ?? true })
```

---

## Capability comparison

| Capability                        | LLM approach                         | No-LLM XState                                           |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Coverage-gap detection            | Inferred from prompt context         | Exact — computed from `getAdjacencyMap`                 |
| Coverage completeness guarantee   | Probabilistic                        | Provable — iterate until gaps set is empty              |
| Path variety                      | Linguistically varied                | Combinatorial — `getSimplePaths` for all acyclic routes |
| Persona simulation                | Free-form natural language           | Explicit `PersonaConfig[]`, deterministic               |
| Waypoints / specific journeys     | Optional JSON field                  | `getPathsFromEvents(machine, events[])`                 |
| Iteration budget                  | Time/iteration budget                | `maxIterations` + `targetEdgePct` threshold             |
| Scenario narrative (goal, intent) | Rich prose                           | None — paths described by step sequence                 |
| Emergent edge cases               | Yes — LLM can surface novel paths    | No — bounded to machine-defined state space             |
| Speed                             | Slow (API round-trips per iteration) | Fast (in-process graph traversal)                       |
| Cost                              | Token budget                         | Zero                                                    |
| Determinism                       | Non-deterministic                    | Fully deterministic                                     |
| Debugging                         | Hard — prompt/response opacity       | Easy — every path is a typed `StatePath`                |

---

## What cannot be replicated

Two capabilities are genuinely LLM-exclusive:

1. **Natural-language scenario intent** — "returning customer who forgot their password" produces the same mechanical path as "new user login error", but the narrative drives richer test reporting and human-readable failure stories. XState paths lose that context.

2. **Out-of-model exploration** — LLM can suggest behaviors not in the machine (e.g., submitting with empty fields). XState graph traversal is bounded by what the machine defines; if the edge isn't modelled, the loop won't find it.

---

## Recommendation

Build the no-LLM loop for systematic coverage — it replicates 80% of the value (gap detection, path variety, budget control) with zero API cost and provable completeness.

Split:

- **XState loop** — default mode, guaranteed coverage of every modelled transition
- **LLM generation** — optional exploratory mode for out-of-model behaviors and richer narrative

Implementation scope: three files (`coverage-tracker.ts`, `exploration-loop.ts`, persona types) entirely within `src/mbt/graph/`, with no changes to specs, page objects, or the machine itself.
