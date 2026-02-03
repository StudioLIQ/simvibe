import { NextRequest, NextResponse } from 'next/server';
import { validateRunInput } from '@simvibe/shared';
import { createStorage, type StorageConfig } from '@simvibe/engine';

function getStorageConfig(): StorageConfig {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/simvibe.db';
  return {
    type: 'sqlite',
    sqlitePath: dbPath,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateRunInput(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid input: ${validation.error}` },
        { status: 400 }
      );
    }

    const storage = createStorage(getStorageConfig());

    try {
      const run = await storage.createRun(validation.data);
      await storage.close();

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
    const storage = createStorage(getStorageConfig());

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
