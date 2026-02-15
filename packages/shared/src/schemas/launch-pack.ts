import { z } from 'zod';

/**
 * Product Hunt launch report pack — submission-ready artifacts
 * generated from simulation friction findings and agent outputs.
 */

export const TaglineCandidateSchema = z.object({
  tagline: z.string(),
  rationale: z.string(),
  addressesFriction: z.string().optional(),
});

export const DescriptionCandidateSchema = z.object({
  description: z.string(),
  rationale: z.string(),
  focusArea: z.string(),
});

export const MakerCommentRewriteSchema = z.object({
  comment: z.string(),
  strategy: z.string(),
  strengthens: z.string(),
});

export const ObjectionSnippetSchema = z.object({
  objection: z.string(),
  response: z.string(),
  source: z.string(),
});

export const LaunchPackSchema = z.object({
  taglineCandidates: z.array(TaglineCandidateSchema),
  descriptionCandidates: z.array(DescriptionCandidateSchema),
  makerCommentRewrites: z.array(MakerCommentRewriteSchema),
  objectionHandling: z.array(ObjectionSnippetSchema),
  generatedAt: z.string().datetime(),
});

export type TaglineCandidate = z.infer<typeof TaglineCandidateSchema>;
export type DescriptionCandidate = z.infer<typeof DescriptionCandidateSchema>;
export type MakerCommentRewrite = z.infer<typeof MakerCommentRewriteSchema>;
export type ObjectionSnippet = z.infer<typeof ObjectionSnippetSchema>;
export type LaunchPack = z.infer<typeof LaunchPackSchema>;
