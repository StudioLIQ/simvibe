'use client';

import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import type { Report, SimEventType, PersonaId, ActionType, SimPhase, RunDiagnostics } from '@simvibe/shared';
import { formatDuration } from '@simvibe/shared';

interface RunData {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: {
    tagline: string;
    description: string;
  };
  report?: Report;
  diagnostics?: RunDiagnostics;
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
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

      {run.diagnostics && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showDiagnostics ? '1rem' : 0 }}>
            <h2 style={{ fontSize: '1.125rem' }}>Diagnostics</h2>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="btn"
              style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {showDiagnostics ? 'Hide' : 'Show Details'}
            </button>
          </div>

          {showDiagnostics && (
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: '#1a1a1a', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Total Duration</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0ea5e9' }}>
                    {run.diagnostics.totalDurationMs ? formatDuration(run.diagnostics.totalDurationMs) : 'N/A'}
                  </div>
                </div>
                <div style={{ background: '#1a1a1a', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Extraction Confidence</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: run.diagnostics.extractionConfidence && run.diagnostics.extractionConfidence >= 0.7 ? '#22c55e' : run.diagnostics.extractionConfidence && run.diagnostics.extractionConfidence >= 0.4 ? '#eab308' : '#ef4444' }}>
                    {run.diagnostics.extractionConfidence !== undefined ? `${(run.diagnostics.extractionConfidence * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                </div>
                <div style={{ background: '#1a1a1a', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>LLM Calls / Fallbacks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: run.diagnostics.fallbacksUsed > 0 ? '#f59e0b' : '#22c55e' }}>
                    {run.diagnostics.llmCalls} / {run.diagnostics.fallbacksUsed}
                  </div>
                </div>
              </div>

              {run.diagnostics.phaseTimings.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#888', marginBottom: '0.5rem' }}>Phase Timings</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: '#888', fontWeight: 500 }}>Phase</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem', color: '#888', fontWeight: 500 }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.diagnostics.phaseTimings.map((timing, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '0.5rem', color: '#ccc', textTransform: 'capitalize' }}>{timing.phase.replace('_', ' ')}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: '#0ea5e9' }}>
                            {timing.durationMs !== undefined ? formatDuration(timing.durationMs) : 'In progress'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {run.diagnostics.extractionWarnings.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#f59e0b', marginBottom: '0.5rem' }}>Extraction Warnings</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {run.diagnostics.extractionWarnings.map((w, i) => (
                      <li key={i} style={{ color: '#fcd34d', marginBottom: '0.25rem' }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {run.diagnostics.agentWarnings.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', color: '#f59e0b', marginBottom: '0.5rem' }}>Agent Warnings</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {run.diagnostics.agentWarnings.map((w, i) => (
                      <li key={i} style={{ color: '#fcd34d', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#a78bfa' }}>[{w.agentId}]</span> {w.warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {run.diagnostics.errors.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: '#ef4444', marginBottom: '0.5rem' }}>Errors</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {run.diagnostics.errors.map((e, i) => (
                      <li key={i} style={{ color: '#fca5a5', marginBottom: '0.25rem' }}>
                        {e.phase && <span style={{ color: '#888' }}>[{e.phase}]</span>} {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
