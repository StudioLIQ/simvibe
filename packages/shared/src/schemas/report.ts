import { z } from 'zod';
import { PersonaIdSchema, ActionTypeSchema } from './agent-output';
import { RunModeSchema, PlatformModeSchema } from './run-input';
import { DiffusionTimelineSchema } from './diffusion';
import { PersonaSetNameSchema, PersonaSnapshotsSchema } from './persona-snapshot';
import { ConversationDynamicsSchema } from './conversation';
import { LaunchPackSchema } from './launch-pack';

export const TractionBandSchema = z.enum([
  'very_low',
  'low',
  'moderate',
  'high',
  'very_high',
]);

export const ConfidenceLevelSchema = z.enum([
  'low',
  'medium',
  'high',
]);

export const FrictionItemSchema = z.object({
  rank: z.number().int().positive(),
  trigger: z.string(),
  category: z.string(),
  evidence: z.array(z.string()),
  agentsCiting: z.array(PersonaIdSchema),
  severity: z.number().min(0).max(1),
});

export const PersonaReportSchema = z.object({
  personaId: PersonaIdSchema,
  primaryAction: ActionTypeSchema,
  actionProbabilities: z.record(ActionTypeSchema, z.number()),
  primaryFriction: z.string(),
  oneLineFix: z.string(),
  trustBoosters: z.array(z.string()),
  trustKillers: z.array(z.string()),
  isFallback: z.boolean().default(false),
});

export const AggregatedMetricsSchema = z.object({
  expectedUpvotes: z.number().min(0),
  expectedSignups: z.number().min(0).max(1),
  expectedPays: z.number().min(0).max(1),
  bounceRate: z.number().min(0).max(1),
  shareRate: z.number().min(0).max(1),
  disagreementScore: z.number().min(0).max(1),
  uncertaintyScore: z.number().min(0).max(1),
});

export const ScoreBreakdownSchema = z.object({
  clarity: z.number().min(0).max(100),
  credibility: z.number().min(0).max(100),
  differentiation: z.number().min(0).max(100),
  pricingFraming: z.number().min(0).max(100),
  conversionReadiness: z.number().min(0).max(100),
});

export const MomentumRiskSchema = z.object({
  flag: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  detail: z.string(),
});

export const PHForecastSchema = z.object({
  upvotesByWindow: z.object({
    firstHour: z.number().min(0),
    first4Hours: z.number().min(0),
    first24Hours: z.number().min(0),
  }),
  commentVelocity: z.object({
    expectedComments24h: z.number().min(0),
    peakHour: z.number().int().min(0).max(23),
  }),
  momentumRisks: z.array(MomentumRiskSchema),
  makerCommentImpact: z.enum(['none', 'weak', 'moderate', 'strong']).optional(),
  topicFitScore: z.number().min(0).max(1).optional(),
});

export const ReportSchema = z.object({
  runId: z.string(),
  generatedAt: z.string().datetime(),
  tractionBand: TractionBandSchema,
  confidence: ConfidenceLevelSchema,
  metrics: AggregatedMetricsSchema,
  scores: ScoreBreakdownSchema,
  overallScore: z.number().min(0).max(100),
  frictionList: z.array(FrictionItemSchema),
  personaReports: z.array(PersonaReportSchema),
  oneLineFixes: z.array(z.object({
    fix: z.string(),
    source: PersonaIdSchema,
    priority: z.number().int().positive(),
  })),
  warnings: z.array(z.string()).optional(),
  calibrationApplied: z.boolean().default(false),
  rawMetrics: AggregatedMetricsSchema.optional(),
  variantOf: z.string().optional(),
  runMode: RunModeSchema.optional(),
  earlyStopReason: z.string().optional(),
  executedPersonaIds: z.array(PersonaIdSchema).optional(),
  personaSet: PersonaSetNameSchema.optional(),
  personaSnapshots: PersonaSnapshotsSchema.optional(),
  diffusion: DiffusionTimelineSchema.optional(),
  platformMode: PlatformModeSchema.optional(),
  phForecast: PHForecastSchema.optional(),
  conversationDynamics: ConversationDynamicsSchema.optional(),
  launchPack: LaunchPackSchema.optional(),
});

export type MomentumRisk = z.infer<typeof MomentumRiskSchema>;
export type PHForecast = z.infer<typeof PHForecastSchema>;
export type TractionBand = z.infer<typeof TractionBandSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type FrictionItem = z.infer<typeof FrictionItemSchema>;
export type PersonaReport = z.infer<typeof PersonaReportSchema>;
export type AggregatedMetrics = z.infer<typeof AggregatedMetricsSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type Report = z.infer<typeof ReportSchema>;

export function validateReport(data: unknown): { success: true; data: Report } | { success: false; error: string } {
  const result = ReportSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}
