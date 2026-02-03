import type { RunInput, PricingModel } from '@simvibe/shared';

export interface CreateRunRequest {
  tagline: string;
  description: string;
  url?: string;
  pricingModel: PricingModel;
  pricePoints?: { tier: string; price: number; currency?: string; period?: string }[];
  category?: string;
  tags?: string[];
  pastedContent?: string;
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
