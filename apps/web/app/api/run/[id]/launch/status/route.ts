import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
} from '@simvibe/engine';

/**
 * GET /api/run/:id/launch/status
 * Lightweight endpoint for polling launch state.
 * Returns: launchRecord + recent launch events.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const storage = createStorage(storageConfigFromEnv());
    const run = await storage.getRun(id);

    if (!run) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Filter launch-related events
    const launchEvents = run.events.filter(
      (e) => e.type === 'LAUNCH_SUBMITTED' || e.type === 'LAUNCH_CONFIRMED' || e.type === 'LAUNCH_FAILED'
    );

    await storage.close();

    // Provide next action guidance for failed launches
    let nextAction: string | null = null;
    if (run.launchRecord?.status === 'failed') {
      nextAction = 'The launch transaction failed. You can retry by clicking "Execute Launch on nad.fun" again, or fix the issue and re-submit.';
    } else if (run.launchRecord?.status === 'submitted') {
      nextAction = 'Transaction is pending confirmation. Check your wallet or block explorer for the latest status.';
    }

    return NextResponse.json({
      launchRecord: run.launchRecord ?? null,
      launchReadiness: run.launchReadiness ?? null,
      launchInput: run.launchInput ?? null,
      events: launchEvents,
      nextAction,
    });
  } catch (error) {
    console.error('Error fetching launch status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch launch status' },
      { status: 500 }
    );
  }
}
