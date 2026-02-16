'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [run, setRun] = useState<RunData | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [phase, setPhase] = useState<string>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchRun();
  }, [id]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const fetchRun = async () => {
    if (!id) return;
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

      const payload = geminiApiKey.trim()
        ? {
            runtimeOverrides: {
              llmProvider: 'gemini',
              geminiApiKey: geminiApiKey.trim(),
            },
          }
        : undefined;

      const response = await fetch(`/api/run/${id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
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
        <Link href="/">Back to Hub</Link>
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
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &larr; Back to Hub
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
              color: run.status === 'completed' ? 'var(--status-success)' :
                     run.status === 'failed' ? 'var(--status-danger)' :
                     run.status === 'running' ? 'var(--accent-primary)' : 'var(--text-muted)'
            }}>
              {run.status.toUpperCase()}
            </span>
            {run.status === 'running' && phase !== 'loading' && (
              <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>
                Phase: {phase}
              </span>
            )}
          </div>
          {run.status === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(100%, 420px)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Optional: your GEMINI_API_KEY"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    padding: '0.5rem 0.625rem',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--surface-card)',
                    color: 'var(--text-secondary)',
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowGeminiKey((v) => !v)}
                  style={{ padding: '0.5rem 0.75rem' }}
                >
                  {showGeminiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                Optional BYOK mode. If entered, this run uses your Gemini key instead of server default.
              </p>
              <button
                className="btn btn-primary"
                onClick={startSimulation}
                disabled={isStarting}
              >
                {isStarting ? 'Starting...' : 'Start Simulation'}
              </button>
            </div>
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
            <p style={{ color: 'var(--text-dim)' }}>
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
                  borderBottom: '1px solid var(--border)',
                  color: event.type === 'RUN_COMPLETED' ? 'var(--status-success)' :
                         event.type === 'RUN_FAILED' ? 'var(--status-danger)' :
                         event.type === 'AGENT_ACTION' ? 'var(--accent-primary)' :
                         event.type === 'VALIDATION_ERROR' ? 'var(--status-warning)' : 'var(--text-secondary)'
                }}
              >
                <span style={{ color: 'var(--text-dim)', marginRight: '0.5rem' }}>
                  [{new Date(event.timestamp).toLocaleTimeString()}]
                </span>
                <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                  {event.type}
                </span>
                {event.agentId && (
                  <span style={{ color: 'var(--accent-secondary)', marginRight: '0.5rem' }}>
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
              style={{ background: 'var(--border)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {showDiagnostics ? 'Hide' : 'Show Details'}
            </button>
          </div>

          {showDiagnostics && (
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--surface-card)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Duration</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {run.diagnostics.totalDurationMs ? formatDuration(run.diagnostics.totalDurationMs) : 'N/A'}
                  </div>
                </div>
                <div style={{ background: 'var(--surface-card)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Extraction Confidence</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: run.diagnostics.extractionConfidence && run.diagnostics.extractionConfidence >= 0.7 ? 'var(--status-success)' : run.diagnostics.extractionConfidence && run.diagnostics.extractionConfidence >= 0.4 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                    {run.diagnostics.extractionConfidence !== undefined ? `${(run.diagnostics.extractionConfidence * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                </div>
                <div style={{ background: 'var(--surface-card)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LLM Calls / Fallbacks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: run.diagnostics.fallbacksUsed > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                    {run.diagnostics.llmCalls} / {run.diagnostics.fallbacksUsed}
                  </div>
                </div>
              </div>

              {run.diagnostics.phaseTimings.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Phase Timings</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Phase</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.diagnostics.phaseTimings.map((timing, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{timing.phase.replace('_', ' ')}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--accent-primary)' }}>
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
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--status-warning)', marginBottom: '0.5rem' }}>Extraction Warnings</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {run.diagnostics.extractionWarnings.map((w, i) => (
                      <li key={i} style={{ color: 'var(--warn-text)', marginBottom: '0.25rem' }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {run.diagnostics.agentWarnings.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--status-warning)', marginBottom: '0.5rem' }}>Agent Warnings</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {run.diagnostics.agentWarnings.map((w, i) => (
                      <li key={i} style={{ color: 'var(--warn-text)', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--accent-secondary)' }}>[{w.agentId}]</span> {w.warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {run.diagnostics.errors.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--status-danger)', marginBottom: '0.5rem' }}>Errors</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {run.diagnostics.errors.map((e, i) => (
                      <li key={i} style={{ color: 'var(--danger-soft)', marginBottom: '0.25rem' }}>
                        {e.phase && <span style={{ color: 'var(--text-muted)' }}>[{e.phase}]</span>} {e.message}
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
