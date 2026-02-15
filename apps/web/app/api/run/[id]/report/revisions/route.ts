import { NextRequest, NextResponse } from 'next/server';
import { createStorage, storageConfigFromEnv } from '@simvibe/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  try {
    const storage = createStorage(storageConfigFromEnv());
    try {
      // Check run exists
      const status = await storage.getRunStatus(runId);
      if (!status) {
        return NextResponse.json(
          { error: 'Run not found' },
          { status: 404 }
        );
      }

      // Load lifecycle
      const lifecycle = await storage.getReportLifecycle(runId);

      // Load revisions
      const revisions = await storage.getReportRevisions(runId);

      return NextResponse.json({
        runId,
        lifecycle: lifecycle ?? null,
        revisions,
        count: revisions.length,
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error fetching report revisions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
