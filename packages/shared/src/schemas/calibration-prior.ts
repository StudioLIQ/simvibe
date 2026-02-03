import { z } from 'zod';

export const CalibrationPriorSchema = z.object({
  key: z.string().describe('Calibration key: category_pricing_model (e.g., "saas_subscription")'),
  signupMultiplier: z.number().min(0).max(5).default(1.0).describe('Multiplier to adjust predicted signup rate'),
  payMultiplier: z.number().min(0).max(5).default(1.0).describe('Multiplier to adjust predicted pay rate'),
  bounceMultiplier: z.number().min(0).max(5).default(1.0).describe('Multiplier to adjust predicted bounce rate'),
  sampleCount: z.number().int().min(0).default(0).describe('Number of actual outcomes used for calibration'),
  lastUpdated: z.string().datetime().describe('When the prior was last updated'),
});

export type CalibrationPrior = z.infer<typeof CalibrationPriorSchema>;

export function validateCalibrationPrior(data: unknown): { success: true; data: CalibrationPrior } | { success: false; error: string } {
  const result = CalibrationPriorSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}

export function createDefaultCalibrationPrior(key: string): CalibrationPrior {
  return {
    key,
    signupMultiplier: 1.0,
    payMultiplier: 1.0,
    bounceMultiplier: 1.0,
    sampleCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

export function getCalibrationKey(category: string, pricingModel: string): string {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '_');
  const normalizedPricing = pricingModel.toLowerCase().replace(/\s+/g, '_');
  return `${normalizedCategory}_${normalizedPricing}`;
}

const LEARNING_RATE = 0.2;
const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 3.0;

export function updateCalibrationPrior(
  prior: CalibrationPrior,
  predicted: { signupRate: number; payRate: number; bounceRate: number },
  actual: { signupRate: number; payRate: number; bounceRate?: number }
): CalibrationPrior {
  const newSampleCount = prior.sampleCount + 1;
  const weight = Math.min(LEARNING_RATE, 1 / newSampleCount);

  const computeNewMultiplier = (
    currentMultiplier: number,
    predictedValue: number,
    actualValue: number | undefined
  ): number => {
    if (actualValue === undefined || predictedValue === 0) {
      return currentMultiplier;
    }
    const ratio = actualValue / (predictedValue * currentMultiplier);
    const adjustment = 1 + (ratio - 1) * weight;
    const newMultiplier = currentMultiplier * adjustment;
    return Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, newMultiplier));
  };

  return {
    key: prior.key,
    signupMultiplier: computeNewMultiplier(prior.signupMultiplier, predicted.signupRate, actual.signupRate),
    payMultiplier: computeNewMultiplier(prior.payMultiplier, predicted.payRate, actual.payRate),
    bounceMultiplier: computeNewMultiplier(prior.bounceMultiplier, predicted.bounceRate, actual.bounceRate),
    sampleCount: newSampleCount,
    lastUpdated: new Date().toISOString(),
  };
}

export interface CalibratedMetrics {
  rawSignups: number;
  rawPays: number;
  rawBounce: number;
  calibratedSignups: number;
  calibratedPays: number;
  calibratedBounce: number;
  calibrationApplied: boolean;
  priorKey: string;
  sampleCount: number;
}

export function applyCalibration(
  rawMetrics: { signupRate: number; payRate: number; bounceRate: number },
  prior: CalibrationPrior | null
): CalibratedMetrics {
  if (!prior || prior.sampleCount === 0) {
    return {
      rawSignups: rawMetrics.signupRate,
      rawPays: rawMetrics.payRate,
      rawBounce: rawMetrics.bounceRate,
      calibratedSignups: rawMetrics.signupRate,
      calibratedPays: rawMetrics.payRate,
      calibratedBounce: rawMetrics.bounceRate,
      calibrationApplied: false,
      priorKey: prior?.key || 'none',
      sampleCount: 0,
    };
  }

  return {
    rawSignups: rawMetrics.signupRate,
    rawPays: rawMetrics.payRate,
    rawBounce: rawMetrics.bounceRate,
    calibratedSignups: Math.min(1, rawMetrics.signupRate * prior.signupMultiplier),
    calibratedPays: Math.min(1, rawMetrics.payRate * prior.payMultiplier),
    calibratedBounce: Math.min(1, rawMetrics.bounceRate * prior.bounceMultiplier),
    calibrationApplied: true,
    priorKey: prior.key,
    sampleCount: prior.sampleCount,
  };
}
