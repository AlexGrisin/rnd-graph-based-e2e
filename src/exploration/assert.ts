/**
 * Lightweight assertion helper — replaces a runtime schema library for the POC.
 * Events are produced internally, so static TypeScript types cover their shape;
 * this guards only the few artifact-boundary invariants (plan §6, Increment 1).
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[exploration] ${message}`);
  }
}
