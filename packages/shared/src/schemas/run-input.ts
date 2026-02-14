import { z } from 'zod';

export const PricingModelSchema = z.enum([
  'free',
  'freemium',
  'subscription',
  'one_time',
  'usage_based',
  'custom',
]);

export const RunModeSchema = z.enum(['quick', 'deep']).default('quick');

export const RunInputSchema = z.object({
  tagline: z.string().min(1, 'Tagline is required').max(200, 'Tagline too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  url: z.string().url('Invalid URL').optional(),
  pricingModel: PricingModelSchema,
  pricePoints: z.array(z.object({
    tier: z.string(),
    price: z.number().nonnegative(),
    currency: z.string().default('USD'),
    period: z.enum(['monthly', 'yearly', 'one_time', 'per_unit']).optional(),
  })).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  competitors: z.array(z.object({
    name: z.string(),
    summary: z.string().optional(),
  })).optional(),
  pastedContent: z.string().optional(),
  runMode: RunModeSchema.optional(),
});

export type PricingModel = z.infer<typeof PricingModelSchema>;
export type RunMode = z.infer<typeof RunModeSchema>;
export type RunInput = z.infer<typeof RunInputSchema>;

export function validateRunInput(data: unknown): { success: true; data: RunInput } | { success: false; error: string } {
  const result = RunInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}
