/**
 * Monad on-chain readiness gate client.
 *
 * Calls the deployed SimVibeGate contract to verify launch readiness.
 * Falls back to off-chain check when gate contract is not configured.
 */

export interface MonadGateConfig {
  contractAddress: string;
  rpcUrl: string;
}

export interface MonadGateResult {
  checked: boolean;
  ready: boolean;
  source: 'onchain' | 'offchain' | 'unconfigured';
  error?: string;
}

const GATE_ABI = [
  'function isLaunchReady(bytes32 runId) external view returns (bool)',
  'function getAttestation(bytes32 runId) external view returns (tuple(bytes32 runId, bytes32 policyHash, bool ready, uint64 timestamp, address attester))',
];

/**
 * Read Monad gate config from environment.
 * Uses GATE_CONTRACT_ADDRESS + RECEIPT_RPC_URL (shared RPC).
 */
export function getMonadGateConfig(): MonadGateConfig | null {
  const contractAddress = process.env.GATE_CONTRACT_ADDRESS;
  const rpcUrl = process.env.RECEIPT_RPC_URL;

  if (!contractAddress || !rpcUrl) {
    return null;
  }

  return { contractAddress, rpcUrl };
}

/**
 * Check if Monad gate is configured.
 */
export function isMonadGateConfigured(): boolean {
  return getMonadGateConfig() !== null;
}

/**
 * Check on-chain readiness for a run.
 *
 * @param runId The off-chain run ID string (will be keccak256-hashed for on-chain lookup).
 * @param config Gate contract config.
 * @returns Gate check result.
 */
export async function checkOnchainReadiness(
  runId: string,
  config: MonadGateConfig,
): Promise<MonadGateResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ethers: any;
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    ethers = await dynamicImport('ethers');
  } catch {
    return {
      checked: false,
      ready: false,
      source: 'onchain',
      error: 'ethers package not installed',
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const contract = new ethers.Contract(config.contractAddress, GATE_ABI, provider);

    const runIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(runId));
    const ready = await contract.isLaunchReady(runIdBytes32);

    return {
      checked: true,
      ready: Boolean(ready),
      source: 'onchain',
    };
  } catch (err) {
    return {
      checked: false,
      ready: false,
      source: 'onchain',
      error: `On-chain gate check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Perform preflight gate check for launch execution.
 *
 * Priority:
 * 1. If Monad gate is configured, check on-chain first.
 * 2. If on-chain check fails or is not configured, report source as offchain/unconfigured.
 */
export async function preflightGateCheck(
  runId: string,
): Promise<MonadGateResult> {
  const config = getMonadGateConfig();

  if (!config) {
    return {
      checked: false,
      ready: false,
      source: 'unconfigured',
    };
  }

  return checkOnchainReadiness(runId, config);
}
