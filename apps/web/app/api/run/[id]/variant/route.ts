import { NextRequest, NextResponse } from 'next/server';
import { createStorage, type StorageConfig } from '@simvibe/engine';

function getStorageConfig(): StorageConfig {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/simvibe.db';
  return {
    type: 'sqlite',
    sqlitePath: dbPath,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { tagline, description } = body;

    if (!tagline?.trim()) {
      return NextResponse.json(
        { error: 'Tagline is required' },
        { status: 400 }
      );
    }

    const storage = createStorage(getStorageConfig());

    try {
      const originalRun = await storage.getRun(id);

      if (!originalRun) {
        return NextResponse.json(
          { error: 'Original run not found' },
          { status: 404 }
        );
      }

      const variantInput = {
        ...originalRun.input,
        tagline: tagline.trim(),
        ...(description?.trim() ? { description: description.trim() } : {}),
      };

      const variantRun = await storage.createRun(variantInput);

      return NextResponse.json({
        runId: variantRun.id,
        originalRunId: id,
        changes: {
          tagline: {
            from: originalRun.input.tagline,
            to: tagline.trim(),
          },
          ...(description?.trim() && description.trim() !== originalRun.input.description ? {
            description: {
              from: originalRun.input.description,
              to: description.trim(),
            },
          } : {}),
        },
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error creating variant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
