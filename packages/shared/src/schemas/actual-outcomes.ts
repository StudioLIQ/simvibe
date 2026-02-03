import { z } from 'zod';

export const ActualOutcomesSchema = z.object({
  signupRate: z.number().min(0).max(1).describe('Actual signup conversion rate (0-1)'),
  payRate: z.number().min(0).max(1).describe('Actual pay conversion rate (0-1)'),
  bounceRate: z.number().min(0).max(1).optional().describe('Actual bounce rate (0-1)'),
  notes: z.string().max(500).optional().describe('Optional notes about the actuals'),
  submittedAt: z.string().datetime().describe('When actuals were submitted'),
});

export type ActualOutcomes = z.infer<typeof ActualOutcomesSchema>;

export const ActualOutcomesInputSchema = z.object({
  signupRate: z.number().min(0).max(1),
  payRate: z.number().min(0).max(1),
  bounceRate: z.number().min(0).max(1).optional(),
  notes: z.string().max(500).optional(),
});

export type ActualOutcomesInput = z.infer<typeof ActualOutcomesInputSchema>;

export function validateActualOutcomes(data: unknown): { success: true; data: ActualOutcomes } | { success: false; error: string } {
  const result = ActualOutcomesSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}

export function validateActualOutcomesInput(data: unknown): { success: true; data: ActualOutcomesInput } | { success: false; error: string } {
  const result = ActualOutcomesInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}

export interface PredictionError {
  signupError: number;
  payError: number;
  bounceError?: number;
  absoluteSignupError: number;
  absolutePayError: number;
  absoluteBounceError?: number;
}

export function computePredictionError(
  predicted: { signupRate: number; payRate: number; bounceRate: number },
  actual: ActualOutcomes
): PredictionError {
  const signupError = predicted.signupRate - actual.signupRate;
  const payError = predicted.payRate - actual.payRate;
  const bounceError = actual.bounceRate !== undefined
    ? predicted.bounceRate - actual.bounceRate
    : undefined;

  return {
    signupError,
    payError,
    bounceError,
    absoluteSignupError: Math.abs(signupError),
    absolutePayError: Math.abs(payError),
    absoluteBounceError: bounceError !== undefined ? Math.abs(bounceError) : undefined,
  };
}
