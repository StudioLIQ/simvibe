import { z } from 'zod';

export const LandingSectionSchema = z.object({
  type: z.enum(['hero', 'features', 'pricing', 'faq', 'testimonials', 'footer', 'other']),
  content: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const LandingExtractSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
  sections: z.array(LandingSectionSchema),
  rawText: z.string().optional(),
  extractedAt: z.string().datetime(),
  extractionMethod: z.enum(['firecrawl', 'jina', 'pasted', 'fallback']),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).optional(),
  failed: z.boolean().default(false),
  failureReason: z.string().optional(),
});

export type LandingSection = z.infer<typeof LandingSectionSchema>;
export type LandingExtract = z.infer<typeof LandingExtractSchema>;

export function createFailedExtract(reason: string): LandingExtract {
  return {
    sections: [],
    extractedAt: new Date().toISOString(),
    extractionMethod: 'fallback',
    confidence: 0,
    failed: true,
    failureReason: reason,
    warnings: [reason],
  };
}

export function validateLandingExtract(data: unknown): { success: true; data: LandingExtract } | { success: false; error: string } {
  const result = LandingExtractSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}
