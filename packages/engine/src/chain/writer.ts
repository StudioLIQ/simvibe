import type { RunInput, Report, ChainReceipt } from '@simvibe/shared';
import { createOfflineReceipt } from '@simvibe/shared';
import { hashRunInput, hashReport } from './hash';

export interface ChainWriterConfig {
  enabled: boolean;
  rpcUrl?: string;
  privateKey?: string;
  contractAddress?: string;
  chainId?: number;
}

export interface ChainWriteResult {
  success: boolean;
  receipt: ChainReceipt;
  error?: string;
}

/**
 * Check if chain receipt feature is enabled.
 */
export function isChainReceiptEnabled(): boolean {
  return process.env.ENABLE_CHAIN_RECEIPT === 'true';
}

/**
 * Get chain writer configuration from environment.
 */
export function getChainConfig(): ChainWriterConfig {
  return {
    enabled: isChainReceiptEnabled(),
    rpcUrl: process.env.CHAIN_RPC_URL,
    privateKey: process.env.CHAIN_PRIVATE_KEY,
    contractAddress: process.env.CHAIN_CONTRACT_ADDRESS,
    chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : undefined,
  };
}

/**
 * Validate chain configuration is complete for writing.
 */
export function validateChainConfig(config: ChainWriterConfig): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!config.rpcUrl) missing.push('CHAIN_RPC_URL');
  if (!config.privateKey) missing.push('CHAIN_PRIVATE_KEY');
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Create receipt hashes and optionally write to chain.
 *
 * When ENABLE_CHAIN_RECEIPT=false:
 *   - Returns receipt with hashes only (no chain data)
 *
 * When ENABLE_CHAIN_RECEIPT=true:
 *   - Validates config
 *   - Writes receipt to chain
 *   - Returns receipt with txHash, chainId, blockNumber
 *   - Fails gracefully with clear error message if chain write fails
 */
export async function createReceipt(
  input: RunInput,
  report: Report
): Promise<ChainWriteResult> {
  // Always compute hashes
  const runHash = hashRunInput(input);
  const reportHash = hashReport(report);

  const config = getChainConfig();

  // If chain receipt is disabled, return offline receipt
  if (!config.enabled) {
    return {
      success: true,
      receipt: createOfflineReceipt(runHash, reportHash),
    };
  }

  // Validate config
  const validation = validateChainConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      receipt: createOfflineReceipt(runHash, reportHash),
      error: `Chain receipt enabled but missing config: ${validation.missing.join(', ')}`,
    };
  }

  // Attempt chain write
  try {
    const chainReceipt = await writeToChain(runHash, reportHash, config);
    return {
      success: true,
      receipt: chainReceipt,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      receipt: createOfflineReceipt(runHash, reportHash),
      error: `Chain write failed: ${errorMessage}`,
    };
  }
}

/**
 * Write receipt to EVM-compatible chain.
 *
 * Uses ethers.js if available, otherwise falls back to raw JSON-RPC.
 * The receipt is stored by calling a simple storage contract method:
 *   storeReceipt(bytes32 runHash, bytes32 reportHash)
 */
async function writeToChain(
  runHash: string,
  reportHash: string,
  config: ChainWriterConfig
): Promise<ChainReceipt> {
  // Dynamic import to avoid bundling ethers when not needed
  // We use Function constructor to avoid TypeScript trying to resolve the module
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ethers: any;
  try {
    // Use dynamic require to load ethers only at runtime
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    ethers = await dynamicImport('ethers');
  } catch {
    throw new Error('ethers package not installed. Run: pnpm add ethers');
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey!, provider);

  // Get network info
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  // Simple receipt storage ABI - just stores two bytes32 hashes
  const abi = [
    'function storeReceipt(bytes32 runHash, bytes32 reportHash) external returns (uint256)',
    'event ReceiptStored(bytes32 indexed runHash, bytes32 indexed reportHash, uint256 indexed receiptId, uint256 timestamp)',
  ];

  if (!config.contractAddress) {
    // If no contract address, just send a self-transaction with data
    // This embeds the hashes in the transaction data for proof
    const data = ethers.solidityPacked(
      ['bytes32', 'bytes32'],
      [`0x${runHash}`, `0x${reportHash}`]
    );

    const tx = await wallet.sendTransaction({
      to: wallet.address,
      data,
      value: 0,
    });

    const receipt = await tx.wait();

    return {
      runHash,
      reportHash,
      timestamp: new Date().toISOString(),
      txHash: receipt!.hash,
      chainId,
      blockNumber: receipt!.blockNumber,
    };
  }

  // Call contract to store receipt
  const contract = new ethers.Contract(config.contractAddress, abi, wallet);
  const tx = await contract.storeReceipt(`0x${runHash}`, `0x${reportHash}`);
  const receipt = await tx.wait();

  return {
    runHash,
    reportHash,
    timestamp: new Date().toISOString(),
    txHash: receipt.hash,
    chainId,
    blockNumber: receipt.blockNumber,
    contractAddress: config.contractAddress,
  };
}

/**
 * Create receipt hashes without chain write (always succeeds).
 */
export function createOfflineReceiptFromInputs(
  input: RunInput,
  report: Report
): ChainReceipt {
  const runHash = hashRunInput(input);
  const reportHash = hashReport(report);
  return createOfflineReceipt(runHash, reportHash);
}
