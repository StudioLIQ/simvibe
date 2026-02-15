import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  updateLaunchRecordWithTx,
  confirmLaunchRecord,
  failLaunchRecord,
} from '@simvibe/engine';
import { createSimEvent, type LaunchRecord, type SimEventType } from '@simvibe/shared';

/**
 * POST /api/run/:id/launch/confirm
 * Client reports back with tx hash after wallet signing.
 * Body: { txHash: string, tokenAddress?: string, status?: 'submitted'|'success'|'failed', error?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Basic validation
    if (!body.txHash || typeof body.txHash !== 'string') {
      return NextResponse.json(
        { error: 'txHash is required and must be a string' },
        { status: 400 }
      );
    }

    const txHash: string = body.txHash;
    const tokenAddress: string | undefined = body.tokenAddress;
    const status: string = body.status || 'submitted';
    const txError: string | undefined = body.error;

    if (!['submitted', 'success', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: submitted, success, failed' },
        { status: 400 }
      );
    }

    const storage = createStorage(storageConfigFromEnv());
    const run = await storage.getRun(id);

    if (!run) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    if (!run.launchRecord) {
      await storage.close();
      return NextResponse.json(
        { error: 'No launch record found.' },
        { status: 400 }
      );
    }

    // Update record based on reported status
    let updatedRecord: LaunchRecord;
    let eventType: SimEventType;
    let eventMessage: string;

    switch (status) {
      case 'submitted':
        updatedRecord = updateLaunchRecordWithTx(run.launchRecord, txHash, tokenAddress);
        eventType = 'LAUNCH_SUBMITTED';
        eventMessage = `Launch transaction submitted: ${txHash}`;
        break;
      case 'success':
        updatedRecord = confirmLaunchRecord(
          updateLaunchRecordWithTx(run.launchRecord, txHash, tokenAddress),
          tokenAddress,
        );
        eventType = 'LAUNCH_CONFIRMED';
        eventMessage = `Launch confirmed! Token: ${tokenAddress || 'pending'}`;
        break;
      case 'failed':
        updatedRecord = failLaunchRecord(
          updateLaunchRecordWithTx(run.launchRecord, txHash, tokenAddress),
          txError || 'Transaction failed',
        );
        eventType = 'LAUNCH_FAILED';
        eventMessage = `Launch failed: ${txError || 'Transaction failed'}`;
        break;
      default:
        updatedRecord = updateLaunchRecordWithTx(run.launchRecord, txHash, tokenAddress);
        eventType = 'LAUNCH_SUBMITTED';
        eventMessage = `Launch transaction submitted: ${txHash}`;
    }

    // Persist record and emit timeline event
    await storage.saveLaunchRecord(id, updatedRecord);
    await storage.appendEvent(
      id,
      createSimEvent(id, eventType, {
        phase: 'launch',
        message: eventMessage,
        payload: {
          txHash,
          tokenAddress,
          status: updatedRecord.status,
          idempotencyKey: updatedRecord.idempotencyKey,
          error: updatedRecord.error,
        },
      }),
    );
    await storage.close();

    return NextResponse.json({
      success: true,
      launchRecord: updatedRecord,
    });
  } catch (error) {
    console.error('Error confirming launch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm launch' },
      { status: 500 }
    );
  }
}
