import { z } from 'zod';
import { PersonaIdSchema, ActionTypeSchema } from './agent-output';

/**
 * A single tick in the diffusion timeline.
 * Each tick represents one agent's action and its effect on world state.
 */
export const DiffusionTickSchema = z.object({
  tick: z.number().int().nonnegative(),
  personaId: PersonaIdSchema,
  action: ActionTypeSchema,
  originalProbability: z.number().min(0).max(1),
  adjustedProbability: z.number().min(0).max(1),
  socialProofScore: z.number(),
  worldState: z.object({
    upvotes: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
    negativeSignals: z.number().int().nonnegative(),
    signups: z.number().int().nonnegative(),
    pays: z.number().int().nonnegative(),
    bounces: z.number().int().nonnegative(),
  }),
  inflectionReason: z.string().optional(),
});

/**
 * Diffusion-adjusted forecast: baseline (no social proof) vs adjusted.
 */
export const DiffusionForecastSchema = z.object({
  baseline: z.object({
    expectedSignups: z.number().min(0).max(1),
    expectedPays: z.number().min(0).max(1),
    bounceRate: z.number().min(0).max(1),
    expectedUpvotes: z.number().min(0),
  }),
  diffusionAdjusted: z.object({
    expectedSignups: z.number().min(0).max(1),
    expectedPays: z.number().min(0).max(1),
    bounceRate: z.number().min(0).max(1),
    expectedUpvotes: z.number().min(0),
  }),
  upliftSignups: z.number(),
  upliftPays: z.number(),
  upliftBounce: z.number(),
});

/**
 * Full diffusion timeline for a run.
 */
export const DiffusionTimelineSchema = z.object({
  ticks: z.array(DiffusionTickSchema),
  forecast: DiffusionForecastSchema,
  inflectionPoints: z.array(z.object({
    tick: z.number().int().nonnegative(),
    reason: z.string(),
    impact: z.enum(['positive', 'negative']),
  })),
  totalTicks: z.number().int().nonnegative(),
});

export type DiffusionTick = z.infer<typeof DiffusionTickSchema>;
export type DiffusionForecast = z.infer<typeof DiffusionForecastSchema>;
export type DiffusionTimeline = z.infer<typeof DiffusionTimelineSchema>;
