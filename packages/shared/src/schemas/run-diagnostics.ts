import { z } from 'zod';

export const PhaseTiming = z.object({
  phase: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
});

export const RunDiagnosticsSchema = z.object({
  runId: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  totalDurationMs: z.number().int().min(0).optional(),
  phaseTimings: z.array(PhaseTiming).default([]),
  extractionConfidence: z.number().min(0).max(1).optional().describe('How confident we are in the landing page extraction (0-1)'),
  extractionWarnings: z.array(z.string()).default([]),
  agentWarnings: z.array(z.object({
    agentId: z.string(),
    warning: z.string(),
  })).default([]),
  llmCalls: z.number().int().min(0).default(0),
  llmTokensUsed: z.number().int().min(0).optional(),
  retriesUsed: z.number().int().min(0).default(0),
  fallbacksUsed: z.number().int().min(0).default(0),
  errors: z.array(z.object({
    timestamp: z.string().datetime(),
    message: z.string(),
    phase: z.string().optional(),
    agentId: z.string().optional(),
  })).default([]),
});

export type PhaseTiming = z.infer<typeof PhaseTiming>;
export type RunDiagnostics = z.infer<typeof RunDiagnosticsSchema>;

export function createInitialDiagnostics(runId: string): RunDiagnostics {
  return {
    runId,
    startedAt: new Date().toISOString(),
    phaseTimings: [],
    extractionWarnings: [],
    agentWarnings: [],
    llmCalls: 0,
    retriesUsed: 0,
    fallbacksUsed: 0,
    errors: [],
  };
}

export function computeExtractionConfidence(
  hasTitle: boolean,
  sectionCount: number,
  hasPricing: boolean,
  hasFeatures: boolean,
  failed: boolean
): number {
  if (failed) return 0;

  let confidence = 0.3;

  if (hasTitle) confidence += 0.2;
  if (sectionCount >= 2) confidence += 0.15;
  if (sectionCount >= 4) confidence += 0.1;
  if (hasPricing) confidence += 0.15;
  if (hasFeatures) confidence += 0.1;

  return Math.min(1, confidence);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function validateRunDiagnostics(data: unknown): { success: true; data: RunDiagnostics } | { success: false; error: string } {
  const result = RunDiagnosticsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}
