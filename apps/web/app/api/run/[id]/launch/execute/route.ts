import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  prepareLaunchExecution,
  isNadLaunchEnabled,
  preflightGateCheck,
  isMonadGateConfigured,
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

    // Check off-chain readiness gate - only allow if ready or draft
    if (run.launchReadiness?.status === 'not_ready') {
      await storage.close();
      return NextResponse.json(
        {
          error: 'Launch readiness gate is NOT READY. Fix blockers before executing.',
          blockers: run.launchReadiness.blockers,
          gateSource: 'offchain',
        },
        { status: 403 }
      );
    }

    // On-chain preflight: if Monad gate is configured, check isLaunchReady
    if (isMonadGateConfigured()) {
      const gateResult = await preflightGateCheck(id);
      if (gateResult.checked && !gateResult.ready) {
        await storage.close();
        return NextResponse.json(
          {
            error: 'On-chain readiness gate returned NOT READY. Attest readiness on Monad first.',
            gateSource: 'onchain',
            gateError: gateResult.error,
          },
          { status: 403 }
        );
      }
      // If check failed (network error etc.), log but don't block (defense in depth is off-chain gate above)
      if (!gateResult.checked && gateResult.error) {
        console.warn(`On-chain gate check failed (non-blocking): ${gateResult.error}`);
      }
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
