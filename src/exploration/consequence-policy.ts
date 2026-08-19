import type { VisibleAction } from './types.js';

/**
 * Consequence policy (plan FR-05, decision #4).
 *
 * Decides whether an action may cause a persistent external effect. Such actions
 * are SKIPPED and recorded as boundaries — the autonomous run never executes
 * them and never pauses to ask. This is a built-in policy, not a runtime input.
 *
 * Site-agnostic: rules match generic control names/roles, never specific URLs.
 */
export type ConsequenceVerdict = {
  consequential: boolean;
  reason?: string;
};

const RULES: ReadonlyArray<{ re: RegExp; reason: string }> = [
  {
    re: /\b(place( your)? order|submit order|complete (order|purchase))\b/,
    reason: 'order placement',
  },
  {
    re: /\b(pay|pay now|make payment|complete payment|confirm and pay)\b/,
    reason: 'payment',
  },
  { re: /\b(buy now|purchase now)\b/, reason: 'purchase' },
  // Login / sign up / register are intentionally NOT blocked — auth flows are
  // worth exploring. (Completing a real registration on a live site is bounded
  // by the skill prompt, not this gate.) Deleting/closing an account IS blocked
  // below as a destructive action.
  {
    re: /\b(delete|remove account|close account)\b/,
    reason: 'destructive action',
  },
  {
    re: /\b(save (card|payment|address)|add (card|payment method))\b/,
    reason: 'personal-data submission',
  },
  {
    // Sends a message on the user's behalf. Bare "send" is intended; word
    // boundaries keep "resend"/"sender" from matching.
    re: /\b(send|send message|send email|submit (enquiry|inquiry|message|form))\b/,
    reason: 'communication send',
  },
  {
    // Publishes user-visible content. Scoped to review/comment/publish to avoid
    // matching benign "post code" fields.
    re: /\b(submit review|write a review|post (a )?(review|comment)|publish)\b/,
    reason: 'content publish',
  },
];

/**
 * The consequence rules as serializable pattern sources, so a page-side guardrail
 * script can reconstruct the same matchers via `new RegExp(source, flags)`. This
 * keeps the browser-injected neutralization list in lockstep with the semantics
 * used everywhere else (report boundary marking, trace parsing).
 */
export const CONSEQUENCE_PATTERNS: ReadonlyArray<{
  source: string;
  flags: string;
  reason: string;
}> = RULES.map((r) => ({
  source: r.re.source,
  flags: r.re.flags.includes('i') ? r.re.flags : `${r.re.flags}i`,
  reason: r.reason,
}));

export function classifyConsequence(action: VisibleAction): ConsequenceVerdict {
  if (action.consequential) {
    return { consequential: true, reason: 'host-flagged' };
  }
  const name = action.name.toLowerCase();
  for (const rule of RULES) {
    if (rule.re.test(name)) {
      return { consequential: true, reason: rule.reason };
    }
  }
  return { consequential: false };
}
