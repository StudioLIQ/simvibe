import { NextRequest, NextResponse } from 'next/server';
import { createStorage, storageConfigFromEnv } from '@simvibe/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const storage = createStorage(storageConfigFromEnv());

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
