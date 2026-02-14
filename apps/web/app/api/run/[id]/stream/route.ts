import { NextRequest } from 'next/server';
import { createStorage, storageConfigFromEnv } from '@simvibe/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const since = request.nextUrl.searchParams.get('since') ?? undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastEventId: string | undefined = since;
      let pollCount = 0;
      const maxPolls = 600; // 5 minutes at 500ms interval

      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        try {
          const storage = createStorage(storageConfigFromEnv());
          try {
            // Lightweight status check first
            const status = await storage.getRunStatus(id);

            if (!status) {
              sendEvent({ type: 'error', message: 'Run not found' });
              controller.close();
              return;
            }

            // Get events since cursor
            const events = await storage.getEventsSince(id, lastEventId);

            if (events.length > 0) {
              for (const event of events) {
                sendEvent(event);
              }
              lastEventId = events[events.length - 1].id;
            }

            if (status === 'completed' || status === 'failed') {
              // Fetch report for stream_end
              const run = await storage.getRun(id);
              sendEvent({
                type: 'stream_end',
                status,
                report: run?.report,
              });
              controller.close();
              return;
            }

            pollCount++;
            if (pollCount >= maxPolls) {
              sendEvent({ type: 'stream_timeout' });
              controller.close();
              return;
            }

            setTimeout(poll, 500);
          } finally {
            await storage.close();
          }
        } catch (error) {
          console.error('Stream poll error:', error);
          sendEvent({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.close();
        }
      };

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
