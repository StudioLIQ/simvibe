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

      <div className="card">
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>Production Endpoints</h2>
        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <li>Web: <code>https://simvibe.studioliq.com</code></li>
          <li>API: <code>https://api-simvibe.studioliq.com</code></li>
          <li>Diagnostics: <code>/api/diagnostics</code></li>
        </ul>
      </div>
    </main>
  );
}
