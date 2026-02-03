import { z } from 'zod';

/**
 * Chain receipt for tamper-evident proof of simulation run
 */
export const ChainReceiptSchema = z.object({
  // Hash of canonical run input JSON (sha256)
  runHash: z.string().regex(/^[a-f0-9]{64}$/, 'Must be valid SHA-256 hash'),
  // Hash of canonical report JSON (sha256)
  reportHash: z.string().regex(/^[a-f0-9]{64}$/, 'Must be valid SHA-256 hash'),
  // Timestamp when receipt was created
  timestamp: z.string().datetime(),
  // Chain transaction hash (if written to chain)
  txHash: z.string().optional(),
  // Chain ID where receipt was written
  chainId: z.number().int().positive().optional(),
  // Block number where receipt was included
  blockNumber: z.number().int().nonnegative().optional(),
  // Contract address that stores the receipt
  contractAddress: z.string().optional(),
});

export type ChainReceipt = z.infer<typeof ChainReceiptSchema>;

export function validateChainReceipt(
  data: unknown
): { success: true; data: ChainReceipt } | { success: false; error: string } {
  const result = ChainReceiptSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error: errorMessages };
}

/**
 * Create a receipt without chain data (for offline/disabled mode)
 */
export function createOfflineReceipt(
  runHash: string,
  reportHash: string
): ChainReceipt {
  return {
    runHash,
    reportHash,
    timestamp: new Date().toISOString(),
  };
}
