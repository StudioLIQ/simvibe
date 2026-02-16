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

function IntakeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="protocol-step-icon" aria-hidden="true">
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

function SimulateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="protocol-step-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" />
    </svg>
  );
}

function ScoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="protocol-step-icon" aria-hidden="true">
      <path d="M4 18h16" />
      <rect x="6" y="11" width="3" height="5" rx="1" />
      <rect x="11" y="8" width="3" height="8" rx="1" />
      <rect x="16" y="6" width="3" height="10" rx="1" />
    </svg>
  );
}

function PatchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="protocol-step-icon" aria-hidden="true">
      <path d="M6 12l4 4L18 8" />
      <path d="M4 6h6M14 18h6" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" className="protocol-step-icon" aria-hidden="true">
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4" />
      <path d="M10 14h6M10 18h4" />
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
          Signal in, persona swarm simulation, calibrated launch report out.
        </p>

        <div className="protocol-flow" aria-label="SimVibe protocol infographic">
          <article className="protocol-step">
            <span className="protocol-step-index">01</span>
            <span className="protocol-step-icon-wrap"><IntakeIcon /></span>
            <div className="protocol-step-body">
              <h3>Ingest</h3>
              <p>Token thesis, URL and narrative are normalized into a launch brief.</p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">02</span>
            <span className="protocol-step-icon-wrap"><SimulateIcon /></span>
            <div className="protocol-step-body">
              <h3>Simulate</h3>
              <p>Multi-agent personas react with realistic sentiment and objections.</p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">03</span>
            <span className="protocol-step-icon-wrap"><ScoreIcon /></span>
            <div className="protocol-step-body">
              <h3>Score</h3>
              <p>Traction, risk and confidence metrics are computed and weighted.</p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">04</span>
            <span className="protocol-step-icon-wrap"><PatchIcon /></span>
            <div className="protocol-step-body">
              <h3>Refine</h3>
              <p>Weak points get patch suggestions before final recommendation.</p>
            </div>
          </article>

          <article className="protocol-step">
            <span className="protocol-step-index">05</span>
            <span className="protocol-step-icon-wrap"><ReportIcon /></span>
            <div className="protocol-step-body">
              <h3>Launch Report</h3>
              <p>Decision-ready summary with rationale and next action checklist.</p>
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
