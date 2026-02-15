import { z } from 'zod';

// --- Report Status ---

export const ReportStatusSchema = z.enum(['open', 'review', 'frozen', 'published']);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

// --- Report Revision ---

export const ReportRevisionSchema = z.object({
  id: z.string(),
  version: z.number().int().min(1),
  author: z.string(), // e.g. 'system', 'user', 'persona:cynical_engineer', 'external:agent_123'
  source: z.string().optional(), // provenance detail
  timestamp: z.string().datetime(),
  reason: z.string(),
  patch: z.record(z.string(), z.unknown()), // section-scoped JSON patch
  sectionPath: z.string(), // target section e.g. 'frictionList', 'scores.clarity'
});

export type ReportRevision = z.infer<typeof ReportRevisionSchema>;

// --- Report Lifecycle ---

export const ReportLifecycleSchema = z.object({
  status: ReportStatusSchema,
  version: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  frozenAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
});

export type ReportLifecycle = z.infer<typeof ReportLifecycleSchema>;

// --- Validators ---

export function validateReportRevision(
  data: unknown
): { success: true; data: ReportRevision } | { success: false; error: string } {
  const result = ReportRevisionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error: errorMessages };
}

export function validateReportLifecycle(
  data: unknown
): { success: true; data: ReportLifecycle } | { success: false; error: string } {
  const result = ReportLifecycleSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error: errorMessages };
}
