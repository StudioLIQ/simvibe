import { NextRequest, NextResponse } from 'next/server';
import { createStorage, storageConfigFromEnv } from '@simvibe/engine';

/**
 * GET /api/run/[id]/launch-pack
 * Returns the launch pack from a completed PH-mode run as JSON or markdown.
 * Query params: ?format=json|markdown (default: json)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storage = createStorage(storageConfigFromEnv());

    try {
      const run = await storage.getRun(params.id);
      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }

      if (!run.report) {
        return NextResponse.json(
          { error: 'Run has no report yet. Start the run first.' },
          { status: 404 }
        );
      }

      if (!run.report.launchPack) {
        return NextResponse.json(
          { error: 'No launch pack available. Launch pack is only generated for Product Hunt mode runs.' },
          { status: 404 }
        );
      }

      const format = request.nextUrl.searchParams.get('format') || 'json';

      if (format === 'markdown') {
        const md = formatLaunchPackMarkdown(run.report.launchPack, run.report.runId);
        return new NextResponse(md, {
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `inline; filename="launch-pack-${params.id}.md"`,
          },
        });
      }

      return NextResponse.json({
        runId: params.id,
        launchPack: run.report.launchPack,
      });
    } finally {
      await storage.close();
    }
  } catch (error) {
    console.error('Error fetching launch pack:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function formatLaunchPackMarkdown(
  lp: NonNullable<import('@simvibe/shared').Report['launchPack']>,
  runId: string
): string {
  const lines: string[] = [];
  lines.push(`# Product Hunt Launch Pack`);
  lines.push(`Run: ${runId} | Generated: ${new Date(lp.generatedAt).toLocaleString()}`);
  lines.push('');

  lines.push(`## Tagline Candidates`);
  for (const tc of lp.taglineCandidates) {
    lines.push(`\n### "${tc.tagline}"`);
    lines.push(`- **Rationale:** ${tc.rationale}`);
    if (tc.addressesFriction) lines.push(`- **Addresses:** ${tc.addressesFriction}`);
  }

  lines.push(`\n## Description Candidates`);
  for (const dc of lp.descriptionCandidates) {
    lines.push(`\n### [${dc.focusArea}]`);
    lines.push(dc.description);
    lines.push(`- **Rationale:** ${dc.rationale}`);
  }

  lines.push(`\n## Maker First Comment Options`);
  for (const mc of lp.makerCommentRewrites) {
    lines.push(`\n### Strategy: ${mc.strategy}`);
    lines.push(`*Strengthens: ${mc.strengthens}*`);
    lines.push('```');
    lines.push(mc.comment);
    lines.push('```');
  }

  lines.push(`\n## Objection Handling`);
  for (const oh of lp.objectionHandling) {
    lines.push(`\n**Q: "${oh.objection}"**`);
    lines.push(`A: ${oh.response}`);
    lines.push(`*Source: ${oh.source}*`);
  }

  return lines.join('\n');
}
