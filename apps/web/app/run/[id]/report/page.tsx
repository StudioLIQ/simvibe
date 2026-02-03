'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import type { Report, PersonaReport, FrictionItem } from '@simvibe/shared';

interface RunData {
  id: string;
  status: string;
  input: {
    tagline: string;
    description: string;
  };
  report?: Report;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>{score}</span>
      </div>
      <div style={{ background: '#333', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
        <div style={{ background: color, width: `${score}%`, height: '100%', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function FrictionCard({ friction }: { friction: FrictionItem }) {
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{
            background: '#333',
            padding: '0.125rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: '#888',
            marginRight: '0.5rem',
          }}>
            #{friction.rank}
          </span>
          <span style={{ fontWeight: 500 }}>{friction.trigger}</span>
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: friction.severity > 0.7 ? '#ef4444' : friction.severity > 0.4 ? '#eab308' : '#888',
        }}>
          {(friction.severity * 100).toFixed(0)}% severity
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#888' }}>
        Category: {friction.category}
      </div>
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
        Cited by: {friction.agentsCiting.join(', ')}
      </div>
    </div>
  );
}

function PersonaCard({ persona }: { persona: PersonaReport }) {
  const actionColor = persona.primaryAction === 'PAY' ? '#22c55e' :
                      persona.primaryAction === 'SIGNUP' ? '#0ea5e9' :
                      persona.primaryAction === 'BOUNCE' ? '#ef4444' : '#888';
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, color: '#a78bfa' }}>{persona.personaId}</span>
        {persona.isFallback && (
          <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: '#422006', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>
            FALLBACK
          </span>
        )}
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ color: '#888', fontSize: '0.875rem' }}>Primary Action: </span>
        <span style={{ color: actionColor, fontWeight: 500 }}>{persona.primaryAction}</span>
      </div>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        <span style={{ color: '#888' }}>Friction: </span>
        <span style={{ color: '#ccc' }}>{persona.primaryFriction}</span>
      </div>
      <div style={{
        background: '#0a0a0a',
        padding: '0.75rem',
        borderRadius: '4px',
        fontSize: '0.875rem',
        borderLeft: '3px solid #0ea5e9',
      }}>
        <strong style={{ color: '#0ea5e9' }}>Fix:</strong> {persona.oneLineFix}
      </div>
    </div>
  );
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchRun();
  }, [id]);

  const fetchRun = async () => {
    try {
      const response = await fetch(`/api/run/${id}`);
      if (!response.ok) {
        throw new Error('Run not found');
      }
      const data = await response.json();
      setRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    }
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
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

  if (!run.report) {
    return (
      <main className="container">
        <div className="error-message">
          Report not available yet. The simulation may still be running.
        </div>
        <Link href={`/run/${id}`}>View Run Status</Link>
      </main>
    );
  }

  const report = run.report;

  return (
    <main className="container">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href={`/run/${id}`} style={{ color: '#888', fontSize: '0.875rem' }}>
            &larr; Back to Run
          </Link>
          <button
            onClick={copyShareLink}
            className="btn"
            style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            {copied ? 'Copied!' : 'Copy Share Link'}
          </button>
        </div>
        <h1 style={{ marginTop: '0.5rem' }}>Simulation Report</h1>
        <p>{run.input.tagline}</p>
      </header>

      {report.warnings && report.warnings.length > 0 && (
        <div style={{
          background: '#422006',
          border: '1px solid #854d0e',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <strong style={{ color: '#fbbf24' }}>Warnings:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', color: '#fcd34d' }}>
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '3rem', fontWeight: 700, color: report.overallScore >= 70 ? '#22c55e' : report.overallScore >= 50 ? '#eab308' : '#ef4444' }}>
            {report.overallScore}
          </h2>
          <p style={{ color: '#888', marginBottom: '1rem' }}>Overall Score</p>
          <div style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            background: report.tractionBand === 'very_high' || report.tractionBand === 'high' ? '#14532d' :
                        report.tractionBand === 'moderate' ? '#422006' : '#450a0a',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: report.tractionBand === 'very_high' || report.tractionBand === 'high' ? '#86efac' :
                   report.tractionBand === 'moderate' ? '#fcd34d' : '#fca5a5',
          }}>
            {report.tractionBand.replace('_', ' ').toUpperCase()} TRACTION
          </div>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
            ({report.confidence} confidence)
          </span>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#888' }}>Score Breakdown</h3>
          <ScoreBar score={report.scores.clarity} label="Clarity" />
          <ScoreBar score={report.scores.credibility} label="Credibility" />
          <ScoreBar score={report.scores.differentiation} label="Differentiation" />
          <ScoreBar score={report.scores.pricingFraming} label="Pricing Framing" />
          <ScoreBar score={report.scores.conversionReadiness} label="Conversion Readiness" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Predicted Metrics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0ea5e9' }}>
              {report.metrics.expectedUpvotes.toFixed(1)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Upvotes</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#22c55e' }}>
              {(report.metrics.expectedSignups * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Signups</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#a78bfa' }}>
              {(report.metrics.expectedPays * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Pays</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>
              {(report.metrics.bounceRate * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Bounce</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#eab308' }}>
              {(report.metrics.shareRate * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Share</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Top Friction Points</h3>
          {report.frictionList.slice(0, 5).map((f) => (
            <FrictionCard key={f.rank} friction={f} />
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Recommended Fixes</h3>
          {report.oneLineFixes.slice(0, 5).map((fix) => (
            <div key={fix.priority} style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{
                  background: '#0ea5e9',
                  color: 'white',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {fix.priority}
                </span>
                <div>
                  <div style={{ fontSize: '0.875rem' }}>{fix.fix}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                    Source: {fix.source}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Persona Analysis</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {report.personaReports.map((persona) => (
            <PersonaCard key={persona.personaId} persona={persona} />
          ))}
        </div>
      </div>
    </main>
  );
}
