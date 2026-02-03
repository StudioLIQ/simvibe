import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  type StorageConfig,
  createReceipt,
  isChainReceiptEnabled,
} from '@simvibe/engine';

function getStorageConfig(): StorageConfig {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/simvibe.db';
  return {
    type: 'sqlite',
    sqlitePath: dbPath,
  };
}

/**
 * POST /api/run/:id/receipt
 * Create a chain receipt for a completed run.
 * - Computes sha256 hashes of run input and report
 * - If ENABLE_CHAIN_RECEIPT=true, writes to chain
 * - Stores receipt in run record
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const storage = createStorage(getStorageConfig());
    const run = await storage.getRun(id);

    if (!run) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    if (!run.report) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run does not have a completed report yet' },
        { status: 400 }
      );
    }

    // Check if receipt already exists
    if (run.receipt) {
      await storage.close();
      return NextResponse.json({
        success: true,
        receipt: run.receipt,
        message: 'Receipt already exists',
        chainEnabled: isChainReceiptEnabled(),
      });
    }

    // Create receipt (will write to chain if enabled)
    const result = await createReceipt(run.input, run.report);

    // Save receipt to storage
    await storage.saveReceipt(id, result.receipt);
    await storage.close();

    return NextResponse.json({
      success: result.success,
      receipt: result.receipt,
      chainEnabled: isChainReceiptEnabled(),
      error: result.error,
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create receipt' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/run/:id/receipt
 * Get the receipt for a run if it exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const storage = createStorage(getStorageConfig());
    const run = await storage.getRun(id);

    if (!run) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    await storage.close();

    if (!run.receipt) {
      return NextResponse.json({
        hasReceipt: false,
        chainEnabled: isChainReceiptEnabled(),
      });
    }

    return NextResponse.json({
      hasReceipt: true,
      receipt: run.receipt,
      chainEnabled: isChainReceiptEnabled(),
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch receipt' },
      { status: 500 }
    );
  }
}
