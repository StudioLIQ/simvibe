import { NextRequest, NextResponse } from 'next/server';
import { validateRunInput } from '@simvibe/shared';
import { createStorage, storageConfigFromEnv, ensurePersonaRegistry, validatePersonaIds } from '@simvibe/engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateRunInput(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: `Invalid input: ${validation.error}`,
          apiVersion: 'v1',
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
