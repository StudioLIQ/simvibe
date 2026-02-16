'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

interface RunLite {
  id: string;
  status: string;
  createdAt: string;
  report?: {
    overallScore?: number;
  };
  input?: {
    tags?: string[];
  };
}

function countSeededRuns(runs: RunLite[]): number {
  return runs.filter((run) => {
    const tags = Array.isArray(run.input?.tags) ? run.input!.tags! : [];
    return tags.some((tag) => tag.startsWith('seed:'));
  }).length;
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="quick-link-icon" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <path d="M9 10h6" />
      <path d="M9 14h3" />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="quick-link-icon" aria-hidden="true">
      <path d="M6 18l3.2-.8L18 8.4A3.8 3.8 0 1012.6 3L3.8 11.8 3 15z" />
      <path d="M11 7l6 6" />
    </svg>
  );
}

function PersonaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="quick-link-icon" aria-hidden="true">
      <path d="M8 12a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M16 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M3.5 19a4.5 4.5 0 019 0" />
      <path d="M13 19a3.5 3.5 0 017 0" />
    </svg>
  );
}

export default function HomePage() {
  const [runs, setRuns] = useState<RunLite[]>([]);
  const [personaCount, setPersonaCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/run?limit=60');
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data.runs) ? (data.runs as RunLite[]) : [];
        if (!cancelled) {
          setRuns(list);
        }
      } catch {
        // Keep landing usable even if list loading fails.
      }

      try {
        const diagnosticsRes = await fetch('/api/diagnostics');
        if (diagnosticsRes.ok) {
          const diagnostics = await diagnosticsRes.json();
          const count = diagnostics?.personaRegistry?.count;
          if (!cancelled && typeof count === 'number') {
            setPersonaCount(count);
          }
        }
      } catch {
        // Keep landing usable even if diagnostics fails.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const completed = runs.filter((run) => run.status === 'completed');
    const seeded = countSeededRuns(runs);
    return {
      totalRuns: runs.length,
      completedRuns: completed.length,
      seededRuns: seeded,
    };
  }, [runs]);

  const tickerItems = useMemo(() => {
    const recent = runs.slice(0, 12).map((run) => {
      const tags = Array.isArray(run.input?.tags) ? run.input.tags : [];
      const seeded = tags.some((tag) => tag.startsWith('seed:'));
      const score = typeof run.report?.overallScore === 'number' ? run.report.overallScore : null;
      const shortId = run.id.length > 12 ? run.id.slice(0, 12) : run.id;
      return `${shortId} · ${run.status.toUpperCase()} · ${score !== null ? `Score ${score}` : 'Scoring'}${seeded ? ' · SEEDED' : ''}`;
    });

    if (recent.length > 0) {
      return recent;
    }

    return [
      'nad.fun Signal Feed · Waiting for first run',
      'Launch Readiness · Awaiting simulation',
      'Persona Engine · 605 personas loaded',
      'Risk Radar · Monitoring thesis quality',
    ];
  }, [runs]);

  return (
    <main className="container">
      <header className="header header-hero">
        <div className="top-nav">
          <Link href="/new">Start Simulation</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/personas">Personas</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.35rem' }}>
          <Image src="/logo-mark.svg" alt="simvi.be logo" width={42} height={42} priority />
          <h1 style={{ marginBottom: 0 }}>simvi.be</h1>
        </div>
        <p>Predict nad.fun launch reaction before you go live.</p>
      </header>

      <section className="ticker-shell" aria-label="Live activity feed">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <span key={`${item}-${index}`} className="ticker-chip">{item}</span>
          ))}
        </div>
      </section>

      <div className="card card-highlight" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>Live Snapshot</h2>
        {loading ? (
          <p className="hint">Loading latest run metrics...</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-item">
              <div className="hint">Total Runs</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.totalRuns}</div>
            </div>
            <div className="stat-item">
              <div className="hint">Completed Reports</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.completedRuns}</div>
            </div>
            <div className="stat-item">
              <div className="hint">Seeded Detections</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.seededRuns}</div>
            </div>
            <div className="stat-item">
              <div className="hint">Active Personas</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{personaCount ?? '-'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>Action Board</h2>
        <div className="link-grid">
          <Link
            href="/reports"
            className="quick-link-card"
          >
            <div className="quick-link-title">
              <span className="quick-link-icon-wrap">
                <ReportsIcon />
              </span>
              <span>Explore Reports</span>
            </div>
            <p className="hint" style={{ margin: 0 }}>Review every completed simulation in one place.</p>
          </Link>

          <Link
            href="/new"
            className="quick-link-card quick-link-primary"
          >
            <div className="quick-link-title">
              <span className="quick-link-icon-wrap">
                <LaunchIcon />
              </span>
              <span>Start New Simulation</span>
            </div>
            <p className="hint" style={{ margin: 0 }}>Predict nad.fun token launch reaction before deployment.</p>
          </Link>

          <Link
            href="/personas"
            className="quick-link-card"
          >
            <div className="quick-link-title">
              <span className="quick-link-icon-wrap">
                <PersonaIcon />
              </span>
              <span>Persona Registry</span>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Search and inspect all personas. Currently loaded: {personaCount ?? '-'}.
            </p>
          </Link>
        </div>
      </div>

      <div className="card protocol-card">
        <h2 style={{ marginBottom: '0.45rem', fontSize: '1.2rem' }}>How The Protocol Works</h2>
        <p className="hint" style={{ marginBottom: '0.95rem' }}>
          We convert startup intuition into launch-grade decisions in five precise steps—so you can move from guesswork to go/no-go with confidence.
        </p>

        <div className="protocol-flow" aria-label="SimVibe protocol infographic">
          <article className="protocol-step">
            <span className="protocol-step-index">Step 01</span>
            <div className="protocol-step-body">
              <h3>Signal Capture</h3>
              <p className="protocol-step-summary">Convert your thesis, docs, and links into one clean launch brief.</p>
              <p className="protocol-step-detail">
                Convert your thesis, docs, and links into a structured launch brief before noise dilutes the signal.
              </p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">Step 02</span>
            <div className="protocol-step-body">
              <h3>Persona Simulation</h3>
              <p className="protocol-step-summary">Run the idea through personas that pressure-test your narrative.</p>
              <p className="protocol-step-detail">
                Put the concept in front of many personality types to expose blind spots and pressure-test your narrative.
              </p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">Step 03</span>
            <div className="protocol-step-body">
              <h3>Risk Scoring</h3>
              <p className="protocol-step-summary">Compare traction, credibility, and execution risk on one score.</p>
              <p className="protocol-step-detail">
                Score traction, credibility, and execution risk together so your team can compare opportunities objectively.
              </p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">Step 04</span>
            <div className="protocol-step-body">
              <h3>Strategic Polish</h3>
              <p className="protocol-step-summary">Get a ranked list of fixes to remove your highest risks first.</p>
              <p className="protocol-step-detail">
                Get a ranked action list that targets the biggest blockers first and removes costly launch risk quickly.
              </p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">Step 05</span>
            <div className="protocol-step-body">
              <h3>Actionable Report</h3>
              <p className="protocol-step-summary">Receive a direct go/no-go memo with your exact next move.</p>
              <p className="protocol-step-detail">
                Receive a final decision memo with go/no-go clarity, rationale, and the exact next move for launch prep.
              </p>
            </div>
          </article>
        </div>

        <div className="protocol-rail" aria-hidden="true">
          <span className="protocol-chip">INPUT BRIEF</span>
          <span className="protocol-chip">PERSONA SWARM</span>
          <span className="protocol-chip">RISK MODEL</span>
          <span className="protocol-chip">GO / NO-GO</span>
        </div>
      </div>
    </main>
  );
}
