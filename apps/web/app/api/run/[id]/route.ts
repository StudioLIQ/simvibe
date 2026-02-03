import { NextRequest, NextResponse } from 'next/server';
import { createStorage, type StorageConfig } from '@simvibe/engine';

function getStorageConfig(): StorageConfig {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/simvibe.db';
  return {
    type: 'sqlite',
    sqlitePath: dbPath,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const storage = createStorage(getStorageConfig());

    try {
      const run = await storage.getRun(id);

      if (!run) {
        return NextResponse.json(
          { error: 'Run not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ run });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
