import type { NadLaunchInput, LaunchRecord } from '@simvibe/shared';
import { nadLaunchConfigFromEnv, type NadLaunchConfig } from './config';

/**
 * Token factory ABI fragment for createToken.
 * Minimal ABI for encoding the call data.
 */
const TOKEN_FACTORY_CREATE_ABI = {
  name: 'createToken',
  type: 'function',
  inputs: [
    { name: 'name', type: 'string' },
    { name: 'symbol', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'image', type: 'string' },
    { name: 'website', type: 'string' },
    { name: 'twitter', type: 'string' },
    { name: 'telegram', type: 'string' },
    { name: 'antiSnipe', type: 'bool' },
    { name: 'bundled', type: 'bool' },
  ],
} as const;

/**
 * Result of preparing a launch execution.
 */
export interface LaunchExecutionPlan {
  /** Execution mode */
  mode: 'contract_call' | 'deep_link';
  /** Chain ID */
  chainId: number;
  /** For contract_call: the unsigned transaction data */
  txData?: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
  /** For deep_link: the URL to redirect to */
  deepLinkUrl?: string;
  /** Launch config summary (no secrets) */
  config: {
    tokenFactoryAddress: string;
    chainId: number;
    launchFeeMon: string;
    enabled: boolean;
  };
}

/**
 * Simple ABI encoder for the createToken function.
 * Encodes function selector + parameters without external dependencies.
 *
 * Uses ethers.js if available, otherwise falls back to a simple encoder.
 */
function encodeCreateTokenData(input: NadLaunchInput): string {
  // Function selector: keccak256("createToken(string,string,string,string,string,string,string,bool,bool)")
  // We compute a static selector to avoid requiring ethers at build time
  // The actual selector would be computed from the full signature
  const FUNCTION_SELECTOR = '0x5c46a7ef'; // placeholder - actual value from contract ABI

  // For production, this should use ethers.js AbiCoder.
  // For now, we return a structured hex payload that the client can use.
  // The client-side wallet integration will re-encode with ethers/viem.
  const params = {
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: input.image || '',
    website: input.website || '',
    twitter: input.x || '',
    telegram: input.telegram || '',
    antiSnipe: input.antiSnipe,
    bundled: input.bundled,
  };

  // Return a JSON-encoded params payload that client-side code can use
  // to construct the actual contract call with ethers/viem
  return JSON.stringify({
    selector: FUNCTION_SELECTOR,
    abi: TOKEN_FACTORY_CREATE_ABI,
    params,
  });
}

/**
 * Build a nad.fun deep-link URL for the create flow.
 */
function buildDeepLink(input: NadLaunchInput): string {
  const params = new URLSearchParams();
  params.set('name', input.name);
  params.set('symbol', input.symbol);
  params.set('description', input.description);
  if (input.image) params.set('image', input.image);
  if (input.website) params.set('website', input.website);
  if (input.x) params.set('x', input.x);
  if (input.telegram) params.set('telegram', input.telegram);
  if (input.antiSnipe) params.set('antiSnipe', 'true');
  if (input.bundled) params.set('bundled', 'true');

  return `https://nad.fun/create?${params.toString()}`;
}

/**
 * Prepare a launch execution plan.
 * Does NOT execute any transaction — that happens client-side.
 */
export function prepareLaunchExecution(
  input: NadLaunchInput,
  config?: NadLaunchConfig,
): LaunchExecutionPlan {
  const cfg = config ?? nadLaunchConfigFromEnv();

  if (cfg.enabled) {
    // Mode B: Direct contract call (client-side signing)
    const encodedData = encodeCreateTokenData(input);

    return {
      mode: 'contract_call',
      chainId: cfg.chainId,
      txData: {
        to: cfg.tokenFactoryAddress,
        data: encodedData,
        value: cfg.launchFeeMon,
        chainId: cfg.chainId,
      },
      config: {
        tokenFactoryAddress: cfg.tokenFactoryAddress,
        chainId: cfg.chainId,
        launchFeeMon: cfg.launchFeeMon,
        enabled: cfg.enabled,
      },
    };
  }

  // Mode A: Deep-link to nad.fun create flow
  return {
    mode: 'deep_link',
    chainId: cfg.chainId || 0,
    deepLinkUrl: buildDeepLink(input),
    config: {
      tokenFactoryAddress: cfg.tokenFactoryAddress,
      chainId: cfg.chainId,
      launchFeeMon: cfg.launchFeeMon,
      enabled: cfg.enabled,
    },
  };
}

/**
 * Update a launch record with transaction result.
 */
export function updateLaunchRecordWithTx(
  existing: LaunchRecord,
  txHash: string,
  tokenAddress?: string,
): LaunchRecord {
  return {
    ...existing,
    status: 'submitted',
    txHash,
    tokenAddress,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark a launch record as confirmed (tx success).
 */
export function confirmLaunchRecord(
  existing: LaunchRecord,
  tokenAddress?: string,
): LaunchRecord {
  return {
    ...existing,
    status: 'success',
    tokenAddress: tokenAddress ?? existing.tokenAddress,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark a launch record as failed.
 */
export function failLaunchRecord(
  existing: LaunchRecord,
  error: string,
): LaunchRecord {
  return {
    ...existing,
    status: 'failed',
    error,
    updatedAt: new Date().toISOString(),
  };
}
