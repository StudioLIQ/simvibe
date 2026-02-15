import type { RunInput, Report, ChainReceipt, TractionBand } from '@simvibe/shared';
import { createOfflineReceipt } from '@simvibe/shared';
import { hashRunInput, hashReport } from './hash';

/**
 * Monad receipt publisher configuration (from RECEIPT_* env vars).
 */
export interface MonadPublisherConfig {
  contractAddress: string;
  rpcUrl: string;
  publisherKey: string;
  chainId?: number;
}

/**
 * Result of a Monad receipt publish attempt.
 */
export interface MonadPublishResult {
  success: boolean;
  receipt: ChainReceipt;
  txHash?: string;
  chainId?: number;
  blockNumber?: number;
  error?: string;
  alreadyPublished?: boolean;
}

/**
 * Map TractionBand enum to uint8 score band for on-chain storage.
 */
export function tractionBandToScoreBand(band: TractionBand): number {
  const mapping: Record<TractionBand, number> = {
    very_low: 0,
    low: 1,
    moderate: 2,
    high: 3,
    very_high: 4,
  };
  return mapping[band] ?? 2; // default to moderate if unknown
}

/**
 * Read Monad publisher config from environment.
 */
export function getMonadPublisherConfig(): MonadPublisherConfig | null {
  const contractAddress = process.env.RECEIPT_CONTRACT_ADDRESS;
  const rpcUrl = process.env.RECEIPT_RPC_URL;
  const publisherKey = process.env.RECEIPT_PUBLISHER_KEY;

  if (!contractAddress || !rpcUrl || !publisherKey) {
    return null;
  }

  return {
    contractAddress,
    rpcUrl,
    publisherKey,
    chainId: process.env.RECEIPT_CHAIN_ID ? parseInt(process.env.RECEIPT_CHAIN_ID, 10) : undefined,
  };
}

/**
 * Check if Monad receipt publishing is configured.
 */
export function isMonadPublisherConfigured(): boolean {
  return getMonadPublisherConfig() !== null;
}

/**
 * Frozen ABI fragment for SimVibeReceipt contract (from contracts/spec/abi.json).
 */
const RECEIPT_ABI = [
  'function publishReceipt(bytes32 runId, bytes32 inputHash, bytes32 reportHash, uint8 scoreBand) external',
  'function hasReceipt(bytes32 runId) external view returns (bool)',
  'function getReceipt(bytes32 runId) external view returns (tuple(bytes32 runId, bytes32 inputHash, bytes32 reportHash, uint8 scoreBand, uint64 timestamp, address publisher))',
  'event ReceiptPublished(bytes32 indexed runId, bytes32 indexed inputHash, bytes32 reportHash, uint8 scoreBand, uint64 timestamp, address indexed publisher)',
];

/**
 * Publish a simulation receipt to the SimVibeReceipt contract on Monad.
 *
 * - Computes runId = keccak256(runIdString)
 * - Computes inputHash = SHA-256(canonical run input)
 * - Computes reportHash = SHA-256(canonical report)
 * - Maps tractionBand to scoreBand (0..4)
 * - Calls publishReceipt on the contract
 *
 * Idempotency: checks hasReceipt before calling publishReceipt.
 * If already published, returns the existing receipt without re-publishing.
 */
export async function publishReceiptOnMonad(
  runId: string,
  input: RunInput,
  report: Report,
  tractionBand: TractionBand,
  config: MonadPublisherConfig,
): Promise<MonadPublishResult> {
  const inputHash = hashRunInput(input);
  const reportHash = hashReport(report);

  // Dynamic import ethers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ethers: any;
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    ethers = await dynamicImport('ethers');
  } catch {
    return {
      success: false,
      receipt: createOfflineReceipt(inputHash, reportHash),
      error: 'ethers package not installed. Run: pnpm add ethers',
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.publisherKey, provider);
    const contract = new ethers.Contract(config.contractAddress, RECEIPT_ABI, wallet);

    // Compute on-chain runId = keccak256(runIdString)
    const runIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(runId));

    // Check if already published (idempotency)
    const alreadyExists = await contract.hasReceipt(runIdBytes32);
    if (alreadyExists) {
      // Fetch existing receipt data
      const existing = await contract.getReceipt(runIdBytes32);
      const network = await provider.getNetwork();

      return {
        success: true,
        receipt: {
          runHash: inputHash,
          reportHash,
          timestamp: new Date(Number(existing.timestamp) * 1000).toISOString(),
          chainId: Number(network.chainId),
          contractAddress: config.contractAddress,
        },
        chainId: Number(network.chainId),
        alreadyPublished: true,
      };
    }

    // Publish receipt
    const scoreBand = tractionBandToScoreBand(tractionBand);
    const tx = await contract.publishReceipt(
      runIdBytes32,
      `0x${inputHash}`,
      `0x${reportHash}`,
      scoreBand,
    );

    const txReceipt = await tx.wait();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    const receipt: ChainReceipt = {
      runHash: inputHash,
      reportHash,
      timestamp: new Date().toISOString(),
      txHash: txReceipt.hash,
      chainId,
      blockNumber: txReceipt.blockNumber,
      contractAddress: config.contractAddress,
    };

    return {
      success: true,
      receipt,
      txHash: txReceipt.hash,
      chainId,
      blockNumber: txReceipt.blockNumber,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Check for known revert reasons
    if (errorMessage.includes('DuplicateRunId')) {
      return {
        success: false,
        receipt: createOfflineReceipt(inputHash, reportHash),
        error: 'Receipt already published on-chain (DuplicateRunId)',
        alreadyPublished: true,
      };
    }

    return {
      success: false,
      receipt: createOfflineReceipt(inputHash, reportHash),
      error: `Monad publish failed: ${errorMessage}`,
    };
  }
}
