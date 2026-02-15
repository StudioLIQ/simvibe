import { NextRequest, NextResponse } from 'next/server';
import { createStorage, storageConfigFromEnv, applyReportPatch } from '@simvibe/engine';
import { validateReportPatch } from '@simvibe/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  try {
    const body = await request.json();

    // Validate patch payload
    const patchValidation = validateReportPatch(body);
    if (!patchValidation.success) {
      return NextResponse.json(
        { error: `Invalid patch payload: ${patchValidation.error}` },
        { status: 400 }
      );
    }
    const patch = patchValidation.data;

    // Optional optimistic concurrency
    const expectedVersion = body.expectedVersion != null
      ? Number(body.expectedVersion)
      : undefined;

    const storage = createStorage(storageConfigFromEnv());
    try {
      // Load run
      const run = await storage.getRun(runId);
      if (!run) {
        return NextResponse.json(
          { error: 'Run not found', code: 'REPORT_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (!run.report) {
        return NextResponse.json(
          { error: 'Run has no report yet', code: 'REPORT_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Load lifecycle (default to open v1 if not yet initialized)
      const lifecycle = await storage.getReportLifecycle(runId) ?? {
        status: 'open' as const,
        version: 1,
        createdAt: run.report.generatedAt,
        updatedAt: run.report.generatedAt,
      };

      // Load existing revisions
      const revisions = await storage.getReportRevisions(runId);

      // Apply patch
      const patchOutput = applyReportPatch({
        report: run.report,
        lifecycle,
        revisions,
        patch,
        expectedVersion,
      });

      if (!patchOutput.result.success) {
        const rejection = patchOutput.result.rejection;
        const statusCode = rejection.code === 'VERSION_CONFLICT' ? 409
          : rejection.code === 'REPORT_FROZEN' || rejection.code === 'REPORT_PUBLISHED' ? 403
          : 400;
        return NextResponse.json(
          { error: rejection.message, code: rejection.code, details: rejection.details },
          { status: statusCode }
        );
      }

      // Persist updated report, lifecycle, and revision
      if (patchOutput.updatedReport) {
        await storage.saveReport(runId, patchOutput.updatedReport);
      }
      if (patchOutput.updatedLifecycle) {
        await storage.saveReportLifecycle(runId, patchOutput.updatedLifecycle);
      }
      if (patchOutput.newRevision) {
        await storage.appendReportRevision(runId, patchOutput.newRevision);
      }

      return NextResponse.json({
        success: true,
        newVersion: patchOutput.result.newVersion,
        revisionId: patchOutput.result.revisionId,
        conflict: patchOutput.conflict ? {
          section: patchOutput.conflict.section,
          existingAuthor: patchOutput.conflict.existingAuthor,
          escalatedToReview: true,
        } : undefined,
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error applying report patch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
