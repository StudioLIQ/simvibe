import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  validateNadLaunchInput,
  type NadLaunchInput,
  type LaunchReadiness,
  type LaunchRecord,
} from '@simvibe/shared';
import {
  createStorage,
  storageConfigFromEnv,
} from '@simvibe/engine';

/**
 * Build a draft NadLaunchInput from a completed run's report and input.
 */
function buildDraftLaunchInput(run: { input: { tagline: string; description: string; url?: string }; report?: { overallScore?: number } }): NadLaunchInput {
  const tagline = run.input.tagline;
  // Derive a token name from tagline (first 2–3 words, max 100 chars)
  const name = tagline.length > 100 ? tagline.slice(0, 97) + '...' : tagline;
  // Derive a symbol from first letters of tagline words (max 10 chars)
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
 * Build a basic readiness assessment from the run's report.
 * (SIM-037 will implement the full gate logic; this is a minimal placeholder.)
 */
function buildBasicReadiness(run: { report?: { overallScore?: number }; status: string }): LaunchReadiness {
  const blockers: LaunchReadiness['blockers'] = [];

  if (run.status !== 'completed') {
    blockers.push({
      code: 'run_not_completed',
      message: 'Simulation run has not completed yet.',
      severity: 'critical',
    });
  }

  if (!run.report) {
    blockers.push({
      code: 'no_report',
      message: 'No simulation report available.',
      severity: 'critical',
    });
  }

  const hasCriticalBlockers = blockers.some(b => b.severity === 'critical');

  return {
    status: hasCriticalBlockers ? 'not_ready' : 'ready',
    blockers,
    confidence: run.report ? 0.5 : 0,
    recommendedActions: hasCriticalBlockers
      ? ['Complete the simulation run before launching.']
      : ['Review the full readiness gate in a future iteration (SIM-037).'],
    evaluatedAt: new Date().toISOString(),
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
      return NextResponse.json({
        readiness: run.launchReadiness ?? buildBasicReadiness(run),
        launchInput: run.launchInput ?? buildDraftLaunchInput(run),
        launchRecord: run.launchRecord ?? null,
      });
    }

    // Build fresh draft
    const readiness = buildBasicReadiness(run);
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

    // Evaluate readiness
    const readiness = buildBasicReadiness(run);

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
