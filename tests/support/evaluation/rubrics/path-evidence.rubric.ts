import type { JudgeRubric } from '../judge-client.js';

export const pathEvidenceRubric = {
  id: 'path-evidence',
  instructions: [
    'Evaluate visual evidence against every configured criterion.',
    'Score each criterion independently from 0 to 1.',
    'Mark a criterion not_observable when evidence is missing or ambiguous.',
    'Use the image index and label metadata to map screenshots to route states.',
    'Treat expectedContext as the expected XState context after its route event.',
    'Use expectedContext when its effect is visible, but do not require context fields to appear on pages without a relevant indicator.',
    'Do not produce the final verdict; it is calculated by the client.',
  ],
  criteria: [
    {
      id: 'route-node-correspondence',
      description:
        'Each supplied screenshot visibly matches its mapped expected route state and does not contradict its expected context.',
      weight: 0.45,
      required: true,
    },
    {
      id: 'final-state-appropriate',
      description:
        'The final screenshot visibly supports the final expected state and context as the appropriate outcome of the ordered events.',
      weight: 0.35,
      required: true,
    },
    {
      id: 'evidence-complete',
      description:
        'Screenshots contain enough visible information to evaluate the route.',
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
