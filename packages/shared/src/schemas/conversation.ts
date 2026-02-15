import { z } from 'zod';
import { PersonaIdSchema } from './agent-output';

/**
 * A single comment or reply in the interaction thread.
 */
export const ThreadCommentSchema = z.object({
  id: z.string(),
  personaId: PersonaIdSchema,
  parentId: z.string().nullable(),
  content: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  trigger: z.string(),
  timestamp: z.number().int().nonnegative(),
});

/**
 * Influence weight between two personas.
 * Indicates how much persona A's comment influenced persona B.
 */
export const InfluenceEdgeSchema = z.object({
  from: PersonaIdSchema,
  to: PersonaIdSchema,
  weight: z.number().min(-1).max(1),
  reason: z.string(),
});

/**
 * A sentiment shift detected during the interaction.
 */
export const SentimentShiftSchema = z.object({
  personaId: PersonaIdSchema,
  triggeredBy: PersonaIdSchema,
  commentId: z.string(),
  direction: z.enum(['more_positive', 'more_negative', 'unchanged']),
  magnitude: z.number().min(0).max(1),
  reason: z.string(),
});

/**
 * A cascade trigger: a comment that caused significant downstream effects.
 */
export const CascadeTriggerSchema = z.object({
  commentId: z.string(),
  personaId: PersonaIdSchema,
  impact: z.enum(['positive', 'negative']),
  affectedPersonas: z.array(PersonaIdSchema),
  description: z.string(),
});

/**
 * Full conversation dynamics for a run.
 */
export const ConversationDynamicsSchema = z.object({
  comments: z.array(ThreadCommentSchema),
  influenceEdges: z.array(InfluenceEdgeSchema),
  sentimentShifts: z.array(SentimentShiftSchema),
  cascadeTriggers: z.array(CascadeTriggerSchema),
  topPersuasiveComments: z.array(z.object({
    commentId: z.string(),
    personaId: PersonaIdSchema,
    influenceScore: z.number(),
    content: z.string(),
  })),
  disagreementResolution: z.array(z.object({
    topic: z.string(),
    initialDisagreement: z.array(PersonaIdSchema),
    resolvedToward: z.enum(['positive', 'negative', 'unresolved']),
    keyComment: z.string().optional(),
  })),
});

export type ThreadComment = z.infer<typeof ThreadCommentSchema>;
export type InfluenceEdge = z.infer<typeof InfluenceEdgeSchema>;
export type SentimentShift = z.infer<typeof SentimentShiftSchema>;
export type CascadeTrigger = z.infer<typeof CascadeTriggerSchema>;
export type ConversationDynamics = z.infer<typeof ConversationDynamicsSchema>;
