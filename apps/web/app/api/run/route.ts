import { NextRequest, NextResponse } from 'next/server';
import { validateRunInput } from '@simvibe/shared';
import { createStorage, storageConfigFromEnv, ensurePersonaRegistry, validatePersonaIds } from '@simvibe/engine';

/**
 * Normalize legacy PH payloads for backward compatibility.
 * - If `phSubmission` is present but `platformMode` is missing/default, auto-set to 'product_hunt'.
 * - If PH-era fields like `phSubmission.phTagline` exist without `platformMode`, infer PH mode.
 */
function normalizeLegacyPayload(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...body };

  // Auto-detect legacy PH payload: phSubmission present but platformMode missing
  if (normalized.phSubmission && !normalized.platformMode) {
    normalized.platformMode = 'product_hunt';
    normalized._migrationHint = 'platformMode auto-set to product_hunt (legacy compat). Please send platformMode explicitly.';
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const body = normalizeLegacyPayload(rawBody);

    const validation = validateRunInput(body);
    if (!validation.success) {
      // Add migration guidance to validation errors
      const migrationHint = typeof body._migrationHint === 'string' ? body._migrationHint : undefined;
      return NextResponse.json(
        {
          error: `Invalid input: ${validation.error}`,
          ...(migrationHint ? { migrationHint } : {}),
          apiVersion: 'v1',
          note: 'Default platformMode is now nad_fun. Send platformMode=product_hunt explicitly for PH submissions.',
        },
        { status: 400 }
      );
    }

    // Validate persona IDs against registry before creating the run
    if (validation.data.personaIds && validation.data.personaIds.length > 0) {
      await ensurePersonaRegistry();
      const check = validatePersonaIds(validation.data.personaIds);
      if (!check.valid) {
        return NextResponse.json(
          {
            error: `Unknown persona IDs: ${check.missing.join(', ')}`,
            availablePersonas: check.available,
            totalAvailable: check.total,
          },
          { status: 400 }
        );
      }
    }

    const storage = createStorage(storageConfigFromEnv());

    try {
      const run = await storage.createRun(validation.data);

      return NextResponse.json({
        runId: run.id,
        status: run.status,
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error creating run:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    const storage = createStorage(storageConfigFromEnv());

    try {
      const runs = await storage.listRuns(limit);
      return NextResponse.json({ runs });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error listing runs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
