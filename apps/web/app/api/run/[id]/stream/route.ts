import { NextRequest } from 'next/server';
import { createStorage, type StorageConfig } from '@simvibe/engine';

function getStorageConfig(): StorageConfig {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/simvibe.db';
  return {
    type: 'sqlite',
    sqlitePath: dbPath,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastEventCount = 0;
      let pollCount = 0;
      const maxPolls = 300;

      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        try {
          const storage = createStorage(getStorageConfig());
          try {
            const run = await storage.getRun(id);

            if (!run) {
              sendEvent({ type: 'error', message: 'Run not found' });
              controller.close();
              return;
            }

            if (run.events.length > lastEventCount) {
              const newEvents = run.events.slice(lastEventCount);
              for (const event of newEvents) {
                sendEvent(event);
              }
              lastEventCount = run.events.length;
            }

            if (run.status === 'completed' || run.status === 'failed') {
              sendEvent({
                type: 'stream_end',
                status: run.status,
                report: run.report,
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
