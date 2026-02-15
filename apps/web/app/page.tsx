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
    return tags.some((tag) => tag === 'seed:ph' || tag.startsWith('seed:'));
  }).length;
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

  return (
    <main className="container">
      <header className="header header-hero">
        <div className="top-nav">
          <Link href="/new">Start Simulation</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/personas">Personas</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.35rem' }}>
          <Image src="/logo.png" alt="simvi.be logo" width={42} height={42} priority />
          <h1 style={{ marginBottom: 0 }}>simvi.be</h1>
        </div>
        <p>Predict nad.fun launch reaction before you go live.</p>
      </header>

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
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Explore Reports</div>
            <p className="hint" style={{ margin: 0 }}>Review every completed simulation in one place.</p>
          </Link>

          <Link
            href="/new"
            className="quick-link-card quick-link-primary"
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Start New Simulation</div>
            <p className="hint" style={{ margin: 0 }}>Predict nad.fun token launch reaction before deployment.</p>
          </Link>

          <Link
            href="/personas"
            className="quick-link-card"
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Persona Registry</div>
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
