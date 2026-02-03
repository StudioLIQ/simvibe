'use client';

import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import type { Report, SimEventType, PersonaId, ActionType, SimPhase } from '@simvibe/shared';

interface RunData {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: {
    tagline: string;
    description: string;
  };
  report?: Report;
  error?: string;
}

interface StreamEvent {
  id: string;
  runId: string;
  type: SimEventType | 'stream_end' | 'stream_timeout' | 'error';
  phase?: SimPhase;
  agentId?: PersonaId;
  timestamp: string;
  message?: string;
  action?: ActionType;
  probability?: number;
  status?: string;
  report?: Report;
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<RunData | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [phase, setPhase] = useState<string>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRun();
  }, [id]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const fetchRun = async () => {
    try {
      const response = await fetch(`/api/run/${id}`);
      if (!response.ok) {
        throw new Error('Run not found');
      }
      const data = await response.json();
      setRun(data.run);

      if (data.run.status === 'running') {
        connectToStream();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    }
  };

  const startSimulation = async () => {
    if (!run || run.status !== 'pending') return;

    setIsStarting(true);
    setError(null);

    try {
      connectToStream();

      const response = await fetch(`/api/run/${id}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start simulation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation');
      eventSourceRef.current?.close();
    } finally {
      setIsStarting(false);
    }
  };

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/run/${id}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamEvent;

        if (data.type === 'stream_end') {
          setRun((prev) => prev ? {
            ...prev,
            status: data.status as RunData['status'],
            report: data.report,
          } : null);
          eventSource.close();
          return;
        }

        if (data.type === 'error') {
          setError(data.message || 'Stream error');
          eventSource.close();
          return;
        }

        if (data.type === 'PHASE_START' && data.phase) {
          setPhase(data.phase);
        }

        setEvents((prev) => [...prev, data]);

        if (data.type === 'RUN_STARTED') {
          setRun((prev) => prev ? { ...prev, status: 'running' } : null);
        }
      } catch (e) {
        console.error('Failed to parse event:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  if (error && !run) {
    return (
      <main className="container">
        <div className="error-message">{error}</div>
        <Link href="/">Back to Home</Link>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="container">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <Link href="/" style={{ color: '#888', fontSize: '0.875rem' }}>
          &larr; Back to Home
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>Simulation Run</h1>
        <p>{run.input.tagline}</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Status:</strong>{' '}
            <span style={{
              color: run.status === 'completed' ? '#22c55e' :
                     run.status === 'failed' ? '#ef4444' :
                     run.status === 'running' ? '#0ea5e9' : '#888'
            }}>
              {run.status.toUpperCase()}
            </span>
            {run.status === 'running' && phase !== 'loading' && (
              <span style={{ marginLeft: '1rem', color: '#888' }}>
                Phase: {phase}
              </span>
            )}
          </div>
          {run.status === 'pending' && (
            <button
              className="btn btn-primary"
              onClick={startSimulation}
              disabled={isStarting}
            >
              {isStarting ? 'Starting...' : 'Start Simulation'}
            </button>
          )}
          {run.status === 'completed' && run.report && (
            <Link href={`/run/${id}/report`} className="btn btn-primary">
              View Report
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Event Timeline</h2>
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}>
          {events.length === 0 ? (
            <p style={{ color: '#666' }}>
              {run.status === 'pending'
                ? 'Click "Start Simulation" to begin'
                : 'Waiting for events...'}
            </p>
          ) : (
            events.map((event, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid #333',
                  color: event.type === 'RUN_COMPLETED' ? '#22c55e' :
                         event.type === 'RUN_FAILED' ? '#ef4444' :
                         event.type === 'AGENT_ACTION' ? '#0ea5e9' :
                         event.type === 'VALIDATION_ERROR' ? '#f59e0b' : '#ccc'
                }}
              >
                <span style={{ color: '#666', marginRight: '0.5rem' }}>
                  [{new Date(event.timestamp).toLocaleTimeString()}]
                </span>
                <span style={{ color: '#888', marginRight: '0.5rem' }}>
                  {event.type}
                </span>
                {event.agentId && (
                  <span style={{ color: '#a78bfa', marginRight: '0.5rem' }}>
                    [{event.agentId}]
                  </span>
                )}
                {event.message && (
                  <span>{event.message}</span>
                )}
                {event.type === 'AGENT_ACTION' && event.action && (
                  <span style={{ marginLeft: '0.5rem' }}>
                    Action: {event.action} ({((event.probability || 0) * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            ))
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>
    </main>
  );
}
