import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  prepareLaunchExecution,
  isNadLaunchEnabled,
} from '@simvibe/engine';

/**
 * POST /api/run/:id/launch/execute
 * Returns unsigned tx data (or deep-link) for client-side wallet signing.
 * Does NOT execute any transaction on the server.
 */
export async function POST(
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

    if (!run.launchInput) {
      await storage.close();
      return NextResponse.json(
        { error: 'No launch payload saved. Save a launch payload first via POST /api/run/:id/launch.' },
        { status: 400 }
      );
    }

    if (!run.launchRecord) {
      await storage.close();
      return NextResponse.json(
        { error: 'No launch record found. Save a launch payload first.' },
        { status: 400 }
      );
    }

    // Check readiness gate - only allow if ready or draft
    if (run.launchReadiness?.status === 'not_ready') {
      await storage.close();
      return NextResponse.json(
        {
          error: 'Launch readiness gate is NOT READY. Fix blockers before executing.',
          blockers: run.launchReadiness.blockers,
        },
        { status: 403 }
      );
    }

    // Prevent re-execution of already submitted/successful launches
    if (run.launchRecord.status === 'submitted' || run.launchRecord.status === 'success') {
      await storage.close();
      return NextResponse.json(
        {
          error: `Launch already ${run.launchRecord.status}. Use the idempotency key for status checks.`,
          launchRecord: run.launchRecord,
        },
        { status: 409 }
      );
    }

    // Update record to confirmed (user intends to execute)
    const confirmedRecord = {
      ...run.launchRecord,
      status: 'confirmed' as const,
      updatedAt: new Date().toISOString(),
    };
    await storage.saveLaunchRecord(id, confirmedRecord);

    // Prepare execution plan (unsigned tx data or deep-link)
    const plan = prepareLaunchExecution(run.launchInput);

    await storage.close();

    return NextResponse.json({
      success: true,
      plan,
      launchRecord: confirmedRecord,
      idempotencyKey: confirmedRecord.idempotencyKey,
      nadLaunchEnabled: isNadLaunchEnabled(),
    });
  } catch (error) {
    console.error('Error preparing launch execution:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare launch execution' },
      { status: 500 }
    );
  }
}
