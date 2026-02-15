/**
 * nad.fun launch configuration from environment.
 */
export interface NadLaunchConfig {
  /** TokenFactory contract address */
  tokenFactoryAddress: string;
  /** Chain ID (e.g., 10143 for Monad Devnet) */
  chainId: number;
  /** Default launch fee in MON (wei string). Optional guardrail. */
  launchFeeMon: string;
  /** RPC URL for the target chain */
  rpcUrl: string;
  /** Whether nad.fun launch is enabled */
  enabled: boolean;
}

export function nadLaunchConfigFromEnv(): NadLaunchConfig {
  const tokenFactoryAddress = process.env.NAD_TOKEN_FACTORY_ADDRESS || '';
  const chainId = parseInt(process.env.NAD_CHAIN_ID || '0', 10);
  const launchFeeMon = process.env.NAD_LAUNCH_FEE_MON || '0';
  const rpcUrl = process.env.NAD_RPC_URL || '';
  const enabled = !!(tokenFactoryAddress && chainId && rpcUrl);

  return {
    tokenFactoryAddress,
    chainId,
    launchFeeMon,
    rpcUrl,
    enabled,
  };
}

export function isNadLaunchEnabled(): boolean {
  return nadLaunchConfigFromEnv().enabled;
}
