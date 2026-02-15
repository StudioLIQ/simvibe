import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  validateNadLaunchInput,
  type NadLaunchInput,
  type LaunchRecord,
} from '@simvibe/shared';
import {
  createStorage,
  storageConfigFromEnv,
  evaluateLaunchReadiness,
  readinessPolicyFromEnv,
} from '@simvibe/engine';

/**
 * Build a draft NadLaunchInput from a completed run's report and input.
 */
function buildDraftLaunchInput(run: { input: { tagline: string; description: string; url?: string } }): NadLaunchInput {
  const tagline = run.input.tagline;
  const name = tagline.length > 100 ? tagline.slice(0, 97) + '...' : tagline;
  const words = tagline.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const symbol = words.map(w => w[0]).join('').toUpperCase().slice(0, 10) || 'TKN';

  return {
    name,
    symbol,
    description: run.input.description.slice(0, 1000),
    website: run.input.url || undefined,
    antiSnipe: false,
    bundled: false,
  };
}

/**
 * GET /api/run/:id/launch
 * Returns readiness assessment + draft launch payload for a completed run.
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

    // If already stored, return persisted data
    if (run.launchReadiness || run.launchInput) {
      await storage.close();

      // Re-evaluate readiness from current report if available
      const readiness = run.report
        ? evaluateLaunchReadiness(run.report, run.status, readinessPolicyFromEnv())
        : run.launchReadiness!;

      return NextResponse.json({
        readiness,
        launchInput: run.launchInput ?? buildDraftLaunchInput(run),
        launchRecord: run.launchRecord ?? null,
      });
    }

    // Build fresh: readiness from report (or minimal if no report)
    const policy = readinessPolicyFromEnv();
    const readiness = run.report
      ? evaluateLaunchReadiness(run.report, run.status, policy)
      : evaluateLaunchReadiness(
          { ...makeEmptyReport(run.id), overallScore: 0 } as any,
          run.status,
          policy,
        );
    const draftInput = buildDraftLaunchInput(run);

    await storage.close();

    return NextResponse.json({
      readiness,
      launchInput: draftInput,
      launchRecord: null,
    });
  } catch (error) {
    console.error('Error fetching launch data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch launch data' },
      { status: 500 }
    );
  }
}

/** Minimal report structure for readiness check when no report exists. */
function makeEmptyReport(runId: string) {
  return {
    runId,
    generatedAt: new Date().toISOString(),
    tractionBand: 'very_low' as const,
    confidence: 'low' as const,
    metrics: {
      expectedUpvotes: 0,
      expectedSignups: 0,
      expectedPays: 0,
      bounceRate: 1,
      shareRate: 0,
      disagreementScore: 1,
      uncertaintyScore: 1,
    },
    scores: {
      clarity: 0,
      credibility: 0,
      differentiation: 0,
      pricingFraming: 0,
      conversionReadiness: 0,
    },
    overallScore: 0,
    frictionList: [],
    personaReports: [],
    oneLineFixes: [],
    calibrationApplied: false,
  };
}

/**
 * POST /api/run/:id/launch
 * Stores user-confirmed launch payload (no tx execution yet).
 * Body: NadLaunchInput fields
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Validate launch input schema
    const validation = validateNadLaunchInput(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid launch input: ${validation.error}` },
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

    if (!run.report) {
      await storage.close();
      return NextResponse.json(
        { error: 'Run does not have a completed report yet. Complete the simulation first.' },
        { status: 400 }
      );
    }

    // Evaluate readiness using the real gate
    const readiness = evaluateLaunchReadiness(
      run.report,
      run.status,
      readinessPolicyFromEnv(),
    );

    // Create initial launch record as draft
    const now = new Date().toISOString();
    const launchRecord: LaunchRecord = {
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      idempotencyKey: `launch_${id}_${crypto.randomUUID().slice(0, 8)}`,
    };

    // Persist all three: readiness, input, and record
    await storage.saveLaunchReadiness(id, readiness);
    await storage.saveLaunchInput(id, validation.data);
    await storage.saveLaunchRecord(id, launchRecord);
    await storage.close();

    return NextResponse.json({
      success: true,
      readiness,
      launchInput: validation.data,
      launchRecord,
    });
  } catch (error) {
    console.error('Error saving launch data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save launch data' },
      { status: 500 }
    );
  }
}
