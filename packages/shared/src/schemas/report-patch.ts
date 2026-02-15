import { z } from 'zod';

// --- Patchable Report Sections ---
// Only these top-level report sections can be targeted by patches.
export const PATCHABLE_SECTIONS = [
  'tractionBand',
  'confidence',
  'metrics',
  'scores',
  'overallScore',
  'frictionList',
  'personaReports',
  'oneLineFixes',
  'warnings',
  'phForecast',
  'nadFunForecast',
  'launchPack',
  'conversationDynamics',
] as const;

export const PatchableSectionSchema = z.enum(PATCHABLE_SECTIONS);
export type PatchableSection = z.infer<typeof PatchableSectionSchema>;

// --- Patch Operation Types ---

export const PatchOpTypeSchema = z.enum(['replace', 'merge', 'append', 'remove_item']);
export type PatchOpType = z.infer<typeof PatchOpTypeSchema>;

// --- Patch Operation ---
// A single operation within a report patch.

export const PatchOperationSchema = z.object({
  op: PatchOpTypeSchema,
  path: z.string(), // dot-path within the section, e.g. '' (whole section), 'clarity', '[0].trigger'
  value: z.unknown().optional(), // required for replace/merge/append; omitted for remove_item
});

export type PatchOperation = z.infer<typeof PatchOperationSchema>;

// --- Patch Provenance ---
// Who submitted this patch and with what confidence.

export const PatchProvenanceSchema = z.object({
  agentId: z.string(), // e.g. 'system', 'user', 'persona:cynical_engineer', 'external:agent_123'
  source: z.string(), // e.g. 'simulation_rerun', 'manual_edit', 'external_agent', 'calibration'
  confidence: z.number().min(0).max(1).optional(), // how confident the author is in this patch
});

export type PatchProvenance = z.infer<typeof PatchProvenanceSchema>;

// --- Report Patch (the submission payload) ---

export const ReportPatchSchema = z.object({
  section: PatchableSectionSchema,
  operations: z.array(PatchOperationSchema).min(1).max(50),
  reason: z.string().min(1).max(1000),
  provenance: PatchProvenanceSchema,
});

export type ReportPatch = z.infer<typeof ReportPatchSchema>;

// --- Patch Rejection Codes ---

export const PATCH_REJECTION_CODES = {
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  REPORT_FROZEN: 'REPORT_FROZEN',
  REPORT_PUBLISHED: 'REPORT_PUBLISHED',
  INVALID_SECTION: 'INVALID_SECTION',
  INVALID_OPERATION: 'INVALID_OPERATION',
  SCHEMA_VIOLATION: 'SCHEMA_VIOLATION',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  UNAUTHORIZED_AGENT: 'UNAUTHORIZED_AGENT',
} as const;

export type PatchRejectionCode = typeof PATCH_REJECTION_CODES[keyof typeof PATCH_REJECTION_CODES];

export const PatchRejectionSchema = z.object({
  code: z.enum([
    'REPORT_NOT_FOUND',
    'REPORT_FROZEN',
    'REPORT_PUBLISHED',
    'INVALID_SECTION',
    'INVALID_OPERATION',
    'SCHEMA_VIOLATION',
    'VERSION_CONFLICT',
    'UNAUTHORIZED_AGENT',
  ]),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type PatchRejection = z.infer<typeof PatchRejectionSchema>;

// --- Patch Result ---

export const PatchResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    newVersion: z.number().int().min(1),
    revisionId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    rejection: PatchRejectionSchema,
  }),
]);

export type PatchResult = z.infer<typeof PatchResultSchema>;

// --- Validators ---

export function validateReportPatch(
  data: unknown
): { success: true; data: ReportPatch } | { success: false; error: string } {
  const result = ReportPatchSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error: errorMessages };
}

/**
 * Check if a report status allows patches (only 'open' and 'review' are writable).
 */
export function isReportWritable(status: string): boolean {
  return status === 'open' || status === 'review';
}

/**
 * Get the rejection for a non-writable report status.
 */
export function getStatusRejection(status: string): PatchRejection | null {
  if (status === 'frozen') {
    return {
      code: 'REPORT_FROZEN',
      message: 'Report is frozen. Unfreeze before submitting patches.',
    };
  }
  if (status === 'published') {
    return {
      code: 'REPORT_PUBLISHED',
      message: 'Report is published and immutable. No patches allowed.',
    };
  }
  return null;
}
