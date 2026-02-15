import { NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  getActiveStorageBackend,
  getPersonaRegistry,
  ensurePersonaRegistry,
  getCostGuardState,
} from '@simvibe/engine';

/**
 * GET /api/diagnostics
 * Returns startup diagnostics: storage backend, persona registry source, Node version, etc.
 */
export async function GET() {
  const storageConfig = storageConfigFromEnv();
  const nodeVersion = process.version;
  const demoMode = process.env.DEMO_MODE === 'true';

  let storageStatus: string;
  let storageError: string | undefined;
  try {
    const storage = createStorage(storageConfig);
    storageStatus = getActiveStorageBackend();
    await storage.close();
  } catch (err) {
    storageStatus = 'error';
    storageError = err instanceof Error ? err.message : String(err);
  }

  let registrySource: string;
  let registryCount = 0;
  try {
    await ensurePersonaRegistry();
    const registry = getPersonaRegistry();
    registryCount = registry.size;
    registrySource = registryCount > 0 ? 'loaded' : 'empty';
  } catch {
    registrySource = 'error';
  }

  return NextResponse.json({
    nodeVersion,
    demoMode,
    storage: {
      configuredType: storageConfig.type,
      activeBackend: storageStatus,
      error: storageError,
    },
    personaRegistry: {
      source: registrySource,
      count: registryCount,
    },
    costGuard: {
      ...getCostGuardState(),
      dailyTokenLimit: parseInt(process.env.LLM_DAILY_TOKEN_LIMIT || '0', 10),
      dailyCostLimitUsd: parseFloat(process.env.LLM_DAILY_COST_LIMIT_USD || '0'),
    },
    env: {
      DATABASE_URL: maskSecret(process.env.DATABASE_URL),
      LLM_PROVIDER: process.env.LLM_PROVIDER || 'gemini',
      LLM_MODEL: process.env.LLM_MODEL || '(default)',
      DEMO_MODE: process.env.DEMO_MODE || 'false',
      PERSONAS_DIR: process.env.PERSONAS_DIR || '(default)',
    },
    supportedNodeVersions: '>=18.0.0 (tested on 18.x, 20.x, 22.x)',
  });
}

function maskSecret(value?: string): string {
  if (!value) return '(not set)';
  if (value === 'memory' || value === 'memory://') return value;
  if (value.startsWith('postgres://') || value.startsWith('postgresql://')) {
    return value.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
  return value;
}
