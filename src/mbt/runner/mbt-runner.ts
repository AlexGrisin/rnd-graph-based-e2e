import { createActor } from 'xstate';
import type { AnyActorLogic, EventObject } from 'xstate';
import type { StatePath } from 'xstate/graph';
import { walkStrategyMachine } from '../../machines/walk-strategy.machine.js';
import { getAllShortestPaths } from '../graph/path-generator.js';
import { testPath } from '../graph/test-model-factory.js';
import type { MbtContext, MbtRunOptions, MbtRunResult } from '../types.js';

function getSnapshotStateValue(snapshot: unknown): string {
  const value = (snapshot as { value: string | Record<string, string> }).value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export class MbtRunner {
  constructor(private readonly logic: AnyActorLogic) {}

  getShortestPaths() {
    return getAllShortestPaths(this.logic);
  }

  async runShortestPaths(
    ctx: MbtContext,
    options: MbtRunOptions,
  ): Promise<MbtRunResult> {
    const paths = this.getShortestPaths();

    const visited = new Set<string>();
    let stepsExecuted = 0;

    for (const path of paths) {
      await testPath(path, ctx, {
        actions: options.actions,
        verifyState: options.verifyState,
        onStateVisited: (stateValue) => {
          visited.add(stateValue);
          options.onStateVisited?.(stateValue);
        },
      });
      stepsExecuted += path.steps.length;
    }

    return {
      pathsExecuted: paths.length,
      stepsExecuted,
      visitedStates: [...visited],
      success: true,
    };
  }

  async runWithStrategy(
    ctx: MbtContext,
    options: MbtRunOptions,
    paths?: Array<StatePath<unknown, EventObject>>,
  ): Promise<MbtRunResult> {
    const strategyPaths = paths ?? this.getShortestPaths();
    const strategyActor = createActor(walkStrategyMachine);

    strategyActor.start();
    strategyActor.send({ type: 'START', paths: strategyPaths });

    const visited = new Set<string>();
    let stepsExecuted = 0;
    let pathsExecuted = 0;

    for (const path of strategyPaths) {
      if (!strategyActor.getSnapshot().matches('walking')) {
        break;
      }

      try {
        await testPath(path, ctx, {
          actions: options.actions,
          verifyState: options.verifyState,
          onStateVisited: (stateValue) => {
            visited.add(stateValue);
            options.onStateVisited?.(stateValue);
          },
        });

        stepsExecuted += path.steps.length;
        pathsExecuted += 1;

        const finalState = getSnapshotStateValue(path.state);
        strategyActor.send({ type: 'PATH_COMPLETE', finalState });
      } catch (error) {
        strategyActor.send({
          type: 'FAIL',
          reason: error instanceof Error ? error.message : String(error),
        });
        break;
      }
    }

    const finalSnapshot = strategyActor.getSnapshot();
    const success = finalSnapshot.matches('done');

    return {
      pathsExecuted,
      stepsExecuted,
      visitedStates: [...visited],
      success,
      error: finalSnapshot.context.lastError ?? undefined,
    };
  }
}
