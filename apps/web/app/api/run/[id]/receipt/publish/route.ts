import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  publishReceiptOnMonad,
  getMonadPublisherConfig,
  isMonadPublisherConfigured,
} from '@simvibe/engine';
import type { TractionBand } from '@simvibe/shared';

/**
 * POST /api/run/:id/receipt/publish
 *
 * Publish a simulation receipt to the SimVibeReceipt contract on Monad.
 *
 * - Validates run is completed with a report.
 * - Checks Monad publisher config is available.
 * - Idempotent: if receipt already published on-chain, returns existing data (200, not 409).
 * - Persists receipt + linkage fields in storage on success.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check Monad publisher configuration
    const config = getMonadPublisherConfig();
    if (!config) {
      return NextResponse.json(
        {
          error: 'Monad receipt publishing not configured',
          missing: [
            ...(!process.env.RECEIPT_CONTRACT_ADDRESS ? ['RECEIPT_CONTRACT_ADDRESS'] : []),
            ...(!process.env.RECEIPT_RPC_URL ? ['RECEIPT_RPC_URL'] : []),
            ...(!process.env.RECEIPT_PUBLISHER_KEY ? ['RECEIPT_PUBLISHER_KEY'] : []),
          ],
        },
        { status: 503 }
      );
    }

    const storage = createStorage(storageConfigFromEnv());
    const run = await storage.getRun(id);

    if (!run) {
      await storage.close();
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.status !== 'completed') {
      await storage.close();
      return NextResponse.json(
        { error: `Run is not completed (status: ${run.status})` },
        { status: 400 }
      );
    }

    if (!run.report) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run does not have a completed report' },
        { status: 400 }
      );
    }

    // If receipt already exists with txHash, return it (idempotent)
    if (run.receipt?.txHash) {
      await storage.close();
      return NextResponse.json({
        success: true,
        receipt: run.receipt,
        txHash: run.receipt.txHash,
        chainId: run.receipt.chainId,
        contractAddress: run.receipt.contractAddress,
        alreadyPublished: true,
        configured: true,
      });
    }

    // Extract traction band from report
    const tractionBand: TractionBand = run.report.tractionBand ?? 'moderate';

    // Publish to Monad
    const result = await publishReceiptOnMonad(
      id,
      run.input,
      run.report,
      tractionBand,
      config,
    );

    if (result.success) {
      // Persist receipt
      await storage.saveReceipt(id, result.receipt);
    }

    await storage.close();

    return NextResponse.json({
      success: result.success,
      receipt: result.receipt,
      txHash: result.txHash,
      chainId: result.chainId,
      blockNumber: result.blockNumber,
      contractAddress: config.contractAddress,
      alreadyPublished: result.alreadyPublished ?? false,
      configured: true,
      error: result.error,
    });
  } catch (error) {
    console.error('Error publishing receipt to Monad:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish receipt' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/run/:id/receipt/publish
 *
 * Check Monad receipt publisher status for this run.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const configured = isMonadPublisherConfigured();

    const storage = createStorage(storageConfigFromEnv());
    const run = await storage.getRun(id);
    await storage.close();

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({
      configured,
      hasReceipt: !!run.receipt?.txHash,
      receipt: run.receipt ?? null,
      receiptTxHash: run.receiptTxHash ?? null,
      receiptContract: run.receiptContract ?? null,
      receiptChainId: run.receiptChainId ?? null,
      receiptPublishedAt: run.receiptPublishedAt ?? null,
    });
  } catch (error) {
    console.error('Error checking receipt publish status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
