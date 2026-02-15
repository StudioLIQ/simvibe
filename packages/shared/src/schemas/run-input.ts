import { z } from 'zod';
import { PersonaIdSchema } from './agent-output';
import { PersonaSetNameSchema } from './persona-snapshot';

export const PricingModelSchema = z.enum([
  'free',
  'freemium',
  'subscription',
  'one_time',
  'usage_based',
  'custom',
]);

export const RunModeSchema = z.enum(['quick', 'deep']).default('quick');

export const PlatformModeSchema = z.enum(['generic', 'nad_fun']).default('nad_fun');

export const NadFunSubmissionSchema = z.object({
  tokenName: z.string().max(100, 'Token name max 100 chars').optional(),
  tokenSymbol: z.string().max(10, 'Token symbol max 10 chars').optional(),
  launchThesis: z.string().max(1000, 'Launch thesis max 1000 chars').optional(),
  distributionPlan: z.string().max(1000, 'Distribution plan max 1000 chars').optional(),
  tokenNarrative: z.string().max(1000, 'Token narrative max 1000 chars').optional(),
  riskAssumptions: z.string().max(1000, 'Risk assumptions max 1000 chars').optional(),
  antiSnipe: z.boolean().optional(),
  bundled: z.boolean().optional(),
});

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
  personaIds: z.array(PersonaIdSchema).min(1).optional(),
  personaSet: PersonaSetNameSchema.optional(),
  // Platform-specific submission fields
  platformMode: PlatformModeSchema.optional(),
  nadFunSubmission: NadFunSubmissionSchema.optional(),
}).refine(
  (data) => {
    // In nad.fun mode, allow running without URL if nad.fun fields are provided
    if (data.platformMode === 'nad_fun') {
      const hasNadFun = data.nadFunSubmission &&
        (data.nadFunSubmission.launchThesis || data.nadFunSubmission.tokenNarrative || data.nadFunSubmission.tokenName);
      return !!(data.url || data.pastedContent || hasNadFun);
    }
    // Generic mode: require URL or pastedContent (existing behavior)
    return !!(data.url || data.pastedContent);
  },
  {
    message: 'Provide a URL, pasted content, or platform-specific listing fields',
    path: ['url'],
  },
);

export type PricingModel = z.infer<typeof PricingModelSchema>;
export type RunMode = z.infer<typeof RunModeSchema>;
export type PlatformMode = z.infer<typeof PlatformModeSchema>;
export type NadFunSubmission = z.infer<typeof NadFunSubmissionSchema>;
export type RunInput = z.infer<typeof RunInputSchema>;

export function validateRunInput(data: unknown): { success: true; data: RunInput } | { success: false; error: string } {
  const result = RunInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}
