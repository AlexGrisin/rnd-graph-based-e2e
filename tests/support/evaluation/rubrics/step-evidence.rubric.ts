import type { JudgeRubric } from '../judge-client.js';

export const stepEvidenceRubric = {
  id: 'step-evidence',
  instructions: [
    'Evaluate one verified XState transition and its screenshot.',
    'Score each criterion independently from 0 to 1.',
    'Mark a criterion not_observable when evidence is missing or ambiguous.',
    'Use the action, target, and screenshot metadata to map evidence to the transition.',
    'Treat expectedContext as the expected XState context after the action.',
    'Use expectedContext when its effect is visible, but do not require context fields to appear without a relevant indicator.',
    'Do not produce the final verdict; it is calculated by the client.',
  ],
  criteria: [
    {
      id: 'target-state-visible',
      description:
        'The screenshot visibly supports the expected target state after the action.',
      weight: 0.5,
      required: true,
    },
    {
      id: 'context-effect-consistent',
      description:
        'The screenshot does not contradict a visible effect of the expected XState context.',
      weight: 0.3,
      required: true,
    },
    {
      id: 'step-evidence-sufficient',
      description:
        'The screenshot contains enough visible information to assess the verified transition.',
      weight: 0.2,
      required: false,
    },
  ],
  thresholds: {
    passAtOrAbove: 0.8,
    failBelow: 0.5,
    requiredAtOrAbove: 0.6,
    minConfidence: 0.7,
  },
} satisfies JudgeRubric;
