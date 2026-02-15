import { z } from 'zod';

// --- NadLaunchInput: fields required by nad.fun token launch ---

export const NadLaunchInputSchema = z.object({
  name: z.string().min(1).max(100).describe('Token name'),
  symbol: z.string().min(1).max(10).toUpperCase().describe('Token symbol (ticker)'),
  image: z.string().url().optional().describe('Token image URL'),
  description: z.string().min(1).max(1000).describe('Token description'),
  x: z.string().url().optional().describe('X (Twitter) URL'),
  telegram: z.string().url().optional().describe('Telegram group URL'),
  website: z.string().url().optional().describe('Project website URL'),
  antiSnipe: z.boolean().default(false).describe('Enable anti-snipe protection'),
  bundled: z.boolean().default(false).describe('Enable bundled launch'),
});

export type NadLaunchInput = z.infer<typeof NadLaunchInputSchema>;

// --- LaunchReadiness: gate check result from report metrics ---

export const LaunchReadinessStatusSchema = z.enum(['ready', 'not_ready']);
export type LaunchReadinessStatus = z.infer<typeof LaunchReadinessStatusSchema>;

export const LaunchBlockerSchema = z.object({
  code: z.string().describe('Machine-readable blocker code'),
  message: z.string().describe('Human-readable explanation'),
  severity: z.enum(['critical', 'warning']),
});

export type LaunchBlocker = z.infer<typeof LaunchBlockerSchema>;

export const LaunchReadinessSchema = z.object({
  status: LaunchReadinessStatusSchema,
  blockers: z.array(LaunchBlockerSchema).default([]),
  confidence: z.number().min(0).max(1).describe('Readiness confidence score'),
  recommendedActions: z.array(z.string()).default([]).describe('Suggested steps before launch'),
  evaluatedAt: z.string().describe('ISO timestamp of evaluation'),
});

export type LaunchReadiness = z.infer<typeof LaunchReadinessSchema>;

// --- LaunchRecord: persisted launch execution state ---

export const LaunchStatusSchema = z.enum([
  'draft',       // payload prepared but not submitted
  'confirmed',   // user confirmed payload, ready to execute
  'submitted',   // tx submitted to chain
  'success',     // tx confirmed on chain
  'failed',      // tx failed or execution error
]);

export type LaunchStatus = z.infer<typeof LaunchStatusSchema>;

export const LaunchRecordSchema = z.object({
  status: LaunchStatusSchema,
  txHash: z.string().optional().describe('Transaction hash if submitted'),
  tokenAddress: z.string().optional().describe('Deployed token contract address'),
  createdAt: z.string().describe('ISO timestamp of record creation'),
  updatedAt: z.string().describe('ISO timestamp of last update'),
  error: z.string().optional().describe('Error message if failed'),
  idempotencyKey: z.string().describe('Unique key to prevent duplicate launches'),
});

export type LaunchRecord = z.infer<typeof LaunchRecordSchema>;

// --- Validation helpers ---

export function validateNadLaunchInput(data: unknown) {
  const result = NadLaunchInputSchema.safeParse(data);
  if (result.success) {
    return { success: true as const, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false as const, error: errorMessages };
}

export function validateLaunchReadiness(data: unknown) {
  const result = LaunchReadinessSchema.safeParse(data);
  if (result.success) {
    return { success: true as const, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false as const, error: errorMessages };
}

export function validateLaunchRecord(data: unknown) {
  const result = LaunchRecordSchema.safeParse(data);
  if (result.success) {
    return { success: true as const, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false as const, error: errorMessages };
}
