import { NextRequest, NextResponse } from 'next/server';
import { createStorage, type StorageConfig } from '@simvibe/engine';
import { validateActualOutcomesInput, type ActualOutcomes } from '@simvibe/shared';

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
    const validation = validateActualOutcomesInput(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error },
        { status: 400 }
      );
    }

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

    const actuals: ActualOutcomes = {
      ...validation.data,
      submittedAt: new Date().toISOString(),
    };

    await storage.saveActuals(id, actuals);

    const predicted = {
      signupRate: run.report.metrics.expectedSignups,
      payRate: run.report.metrics.expectedPays,
      bounceRate: run.report.metrics.bounceRate,
    };

    const errors = {
      signupError: predicted.signupRate - actuals.signupRate,
      payError: predicted.payRate - actuals.payRate,
      bounceError: actuals.bounceRate !== undefined
        ? predicted.bounceRate - actuals.bounceRate
        : undefined,
      absoluteSignupError: Math.abs(predicted.signupRate - actuals.signupRate),
      absolutePayError: Math.abs(predicted.payRate - actuals.payRate),
      absoluteBounceError: actuals.bounceRate !== undefined
        ? Math.abs(predicted.bounceRate - actuals.bounceRate)
        : undefined,
    };

    await storage.close();

    return NextResponse.json({
      success: true,
      actuals,
      predicted,
      errors,
    });
  } catch (error) {
    console.error('Error saving actuals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save actuals' },
      { status: 500 }
    );
  }
}

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

    if (!run.actuals) {
      return NextResponse.json(
        { hasActuals: false }
      );
    }

    const predicted = run.report ? {
      signupRate: run.report.metrics.expectedSignups,
      payRate: run.report.metrics.expectedPays,
      bounceRate: run.report.metrics.bounceRate,
    } : null;

    const errors = predicted ? {
      signupError: predicted.signupRate - run.actuals.signupRate,
      payError: predicted.payRate - run.actuals.payRate,
      bounceError: run.actuals.bounceRate !== undefined
        ? predicted.bounceRate - run.actuals.bounceRate
        : undefined,
      absoluteSignupError: Math.abs(predicted.signupRate - run.actuals.signupRate),
      absolutePayError: Math.abs(predicted.payRate - run.actuals.payRate),
      absoluteBounceError: run.actuals.bounceRate !== undefined
        ? Math.abs(predicted.bounceRate - run.actuals.bounceRate)
        : undefined,
    } : null;

    return NextResponse.json({
      hasActuals: true,
      actuals: run.actuals,
      predicted,
      errors,
    });
  } catch (error) {
    console.error('Error fetching actuals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch actuals' },
      { status: 500 }
    );
  }
}
