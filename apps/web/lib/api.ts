import type { RunInput, PricingModel, RunMode, PlatformMode, PHSubmission, PersonaSetName } from '@simvibe/shared';

export interface CreateRunRequest {
  tagline: string;
  description: string;
  url?: string;
  pricingModel: PricingModel;
  pricePoints?: { tier: string; price: number; currency?: string; period?: string }[];
  category?: string;
  tags?: string[];
  pastedContent?: string;
  runMode?: RunMode;
  personaIds?: string[];
  personaSet?: PersonaSetName;
  platformMode?: PlatformMode;
  phSubmission?: PHSubmission;
}

export interface CreateRunResponse {
  runId: string;
  status: string;
}

export async function createRun(input: CreateRunRequest): Promise<CreateRunResponse> {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create run');
  }

  return response.json();
}
