import { z } from 'zod';

/** Persona IDs are snake_case strings. No longer a fixed enum. */
export const PersonaIdSchema = z.string()
  .min(2, 'Persona ID too short')
  .max(100, 'Persona ID too long')
  .regex(/^[a-z][a-z0-9_]*$/, 'Persona ID must be snake_case');

/** Core 5 persona IDs for backward compatibility. */
export const CORE_PERSONA_IDS = [
  'cynical_engineer',
  'passionate_pm',
  'pragmatic_investor',
  'ruthless_marketer',
  'agency_owner',
] as const;

export const ActionTypeSchema = z.enum([
  'UPVOTE',
  'COMMENT',
  'SIGNUP',
  'PAY',
  'SHARE',
  'BOUNCE',
]);

export const ActionProbabilitySchema = z.object({
  action: ActionTypeSchema,
  probability: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export const ScanOutputSchema = z.object({
  phase: z.literal('scan'),
  productDefinition: z.string().min(1, 'Product definition is required'),
  suspicions: z.array(z.string()).min(1, 'At least 1 suspicion required').max(5),
});

export const SkimOutputSchema = z.object({
  phase: z.literal('skim'),
  trustBoosters: z.array(z.string()),
  trustKillers: z.array(z.string()),
  primaryFriction: z.string().min(1, 'Primary friction is required'),
  frictionCategory: z.enum([
    'unclear_icp',
    'vague_value_prop',
    'missing_proof',
    'pricing_concern',
    'trust_gap',
    'technical_doubt',
    'onboarding_friction',
    'other',
  ]),
});

export const DebateOutputSchema = z.object({
  phase: z.literal('debate'),
  question: z.string().min(1, 'Question is required'),
  challengedClaim: z.string().min(1, 'Challenged claim is required'),
  stanceUpdate: z.string().optional(),
});

export const ActionOutputSchema = z.object({
  phase: z.literal('action'),
  actions: z.array(ActionProbabilitySchema).min(1, 'At least 1 action required'),
  primaryAction: ActionTypeSchema,
  oneLineFix: z.string().min(1, 'One-line fix is required'),
});

export const AgentOutputSchema = z.object({
  personaId: PersonaIdSchema,
  runId: z.string(),
  timestamp: z.string().datetime(),
  scan: ScanOutputSchema,
  skim: SkimOutputSchema,
  debate: DebateOutputSchema.optional(),
  action: ActionOutputSchema,
  isFallback: z.boolean().default(false),
  fallbackReason: z.string().optional(),
});

export type PersonaId = z.infer<typeof PersonaIdSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type ActionProbability = z.infer<typeof ActionProbabilitySchema>;
export type ScanOutput = z.infer<typeof ScanOutputSchema>;
export type SkimOutput = z.infer<typeof SkimOutputSchema>;
export type DebateOutput = z.infer<typeof DebateOutputSchema>;
export type ActionOutput = z.infer<typeof ActionOutputSchema>;
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

export function createFallbackAgentOutput(personaId: PersonaId, runId: string, reason: string): AgentOutput {
  const now = new Date().toISOString();
  return {
    personaId,
    runId,
    timestamp: now,
    scan: {
      phase: 'scan',
      productDefinition: 'Unable to analyze product',
      suspicions: ['Analysis failed - see fallback reason'],
    },
    skim: {
      phase: 'skim',
      trustBoosters: [],
      trustKillers: ['Unable to complete analysis'],
      primaryFriction: 'Analysis incomplete',
      frictionCategory: 'other',
    },
    action: {
      phase: 'action',
      actions: [{ action: 'BOUNCE', probability: 1.0, reasoning: reason }],
      primaryAction: 'BOUNCE',
      oneLineFix: 'Unable to provide fix due to analysis failure',
    },
    isFallback: true,
    fallbackReason: reason,
  };
}

export function validateAgentOutput(data: unknown): { success: true; data: AgentOutput } | { success: false; error: string } {
  const result = AgentOutputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}

export function getAllPersonaIds(): PersonaId[] {
  return [...CORE_PERSONA_IDS] as PersonaId[];
}
