import { NextRequest, NextResponse } from 'next/server';
import { createStorage, storageConfigFromEnv, transitionLifecycle, getAllowedTransitions } from '@simvibe/engine';
import type { ReportStatus } from '@simvibe/shared';

const VALID_STATUSES: ReportStatus[] = ['open', 'review', 'frozen', 'published'];

/**
 * POST /api/run/:id/report/lifecycle
 * Transition report lifecycle status.
 * Body: { targetStatus: ReportStatus, actor?: string, reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  try {
    const body = await request.json();
    const { targetStatus, actor, reason } = body;

    if (!targetStatus || !VALID_STATUSES.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Invalid targetStatus. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const storage = createStorage(storageConfigFromEnv());
    try {
      const run = await storage.getRun(runId);
      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      if (!run.report) {
        return NextResponse.json({ error: 'Run has no report yet' }, { status: 404 });
      }

      // Load or default lifecycle
      const lifecycle = await storage.getReportLifecycle(runId) ?? {
        status: 'open' as const,
        version: 1,
        createdAt: run.report.generatedAt,
        updatedAt: run.report.generatedAt,
      };

      // Perform transition
      const result = transitionLifecycle(
        lifecycle,
        targetStatus,
        runId,
        actor || 'user',
        reason
      );

      if (!result.success) {
        return NextResponse.json(
          {
            error: result.error,
            currentStatus: lifecycle.status,
            allowedTransitions: getAllowedTransitions(lifecycle.status),
          },
          { status: 409 }
        );
      }

      // Persist updated lifecycle
      if (result.lifecycle) {
        await storage.saveReportLifecycle(runId, result.lifecycle);
      }

      // Persist audit event
      if (result.event) {
        await storage.appendEvent(runId, result.event);
      }

      return NextResponse.json({
        success: true,
        lifecycle: result.lifecycle,
        allowedTransitions: getAllowedTransitions(result.lifecycle!.status),
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error transitioning report lifecycle:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/run/:id/report/lifecycle
 * Get current lifecycle status and allowed transitions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  try {
    const storage = createStorage(storageConfigFromEnv());
    try {
      const lifecycle = await storage.getReportLifecycle(runId);

      if (!lifecycle) {
        return NextResponse.json({
          lifecycle: null,
          allowedTransitions: ['review', 'frozen'],
          message: 'No lifecycle initialized (defaults to open)',
        });
      }

      return NextResponse.json({
        lifecycle,
        allowedTransitions: getAllowedTransitions(lifecycle.status),
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error fetching report lifecycle:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
