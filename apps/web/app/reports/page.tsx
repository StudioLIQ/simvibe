'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type RunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

type PlatformFilter = 'all' | 'nad_fun' | 'product_hunt' | 'generic';

interface RunListItem {
  id: string;
  status: RunStatus;
  createdAt: string;
  input: {
    tagline?: string;
    runMode?: string;
    platformMode?: string;
    tags?: string[];
    phSubmission?: {
      productName?: string;
    };
    nadFunSubmission?: {
      tokenName?: string;
      tokenSymbol?: string;
    };
  };
  report?: {
    overallScore?: number;
    tractionBand?: string;
  };
}

function isSeeded(run: RunListItem): boolean {
  const tags = Array.isArray(run.input?.tags) ? run.input.tags : [];
  return tags.some((tag) => tag === 'seed:ph' || tag.startsWith('seed:'));
}

function getTitle(run: RunListItem): string {
  const nadName = run.input?.nadFunSubmission?.tokenName?.trim();
  const nadSymbol = run.input?.nadFunSubmission?.tokenSymbol?.trim();
  if (nadName) return nadSymbol ? `${nadName} ($${nadSymbol})` : nadName;
  const phName = run.input?.phSubmission?.productName?.trim();
  if (phName) return phName;
  return run.input?.tagline || run.id;
}

function getPlatformMode(run: RunListItem): string {
  return run.input?.platformMode || 'generic';
}

function getPlatformBadge(mode: string): { label: string; color: string } {
  switch (mode) {
    case 'nad_fun': return { label: 'nad.fun', color: 'var(--accent-primary)' };
    case 'product_hunt': return { label: 'PH (legacy)', color: 'var(--text-dim)' };
    default: return { label: 'Generic', color: 'var(--text-muted)' };
  }
}

export default function ReportsPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [seededOnly, setSeededOnly] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/run?limit=300');
        if (!response.ok) {
          throw new Error(`Failed to load runs (${response.status})`);
        }

        const data = await response.json();
        const list = Array.isArray(data.runs) ? (data.runs as RunListItem[]) : [];

        if (!cancelled) {
          setRuns(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports.');
        }
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

  const completedReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return runs
      .filter((run) => run.status === 'completed' && run.report)
      .filter((run) => (seededOnly ? isSeeded(run) : true))
      .filter((run) => {
        if (platformFilter === 'all') return true;
        return getPlatformMode(run) === platformFilter;
      })
      .filter((run) => {
        if (!normalizedQuery) return true;
        const title = getTitle(run).toLowerCase();
        const tags = (run.input?.tags || []).join(' ').toLowerCase();
        return title.includes(normalizedQuery) || run.id.toLowerCase().includes(normalizedQuery) || tags.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
  }, [runs, query, seededOnly, platformFilter]);

  return (
    <main className="container">
      <header className="header" style={{ marginBottom: '1rem' }}>
        <div className="top-nav">
          <Link href="/">&larr; Hub</Link>
          <Link href="/new">Start Simulation</Link>
          <Link href="/personas">Personas</Link>
        </div>
        <h1>Reports</h1>
        <p>Track every completed simulation run from one dashboard.</p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="search">Search (title, run ID, tags)</label>
          <input
            id="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. conva, run_xxx, seed:ph"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {([
            { value: 'all' as PlatformFilter, label: 'All' },
            { value: 'nad_fun' as PlatformFilter, label: 'nad.fun' },
            { value: 'product_hunt' as PlatformFilter, label: 'PH (legacy)' },
            { value: 'generic' as PlatformFilter, label: 'Generic' },
          ]).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatformFilter(value)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '1rem',
                border: `1px solid ${platformFilter === value ? 'var(--accent-primary)' : 'var(--border)'}`,
                background: platformFilter === value ? 'var(--accent-primary-soft)' : 'transparent',
                color: platformFilter === value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: platformFilter === value ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={seededOnly}
            onChange={(e) => setSeededOnly(e.target.checked)}
          />
          Show seeded reports only
        </label>
      </div>

      <div className="card">
        {loading && <p className="hint">Loading reports...</p>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && completedReports.length === 0 && (
          <p className="hint">No reports match your filters.</p>
        )}

        {!loading && !error && completedReports.length > 0 && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {completedReports.map((run) => {
              const score = run.report?.overallScore;
              const traction = run.report?.tractionBand || '-';
              const tags = run.input?.tags || [];
              const badge = getPlatformBadge(getPlatformMode(run));

              return (
                <div
                  key={run.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    padding: '0.85rem',
                    background: 'var(--surface-card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 700 }}>{getTitle(run)}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.75rem',
                            border: `1px solid ${badge.color}`,
                            color: badge.color,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="hint" style={{ marginBottom: '0.3rem' }}>
                        {run.id} · {new Date(run.createdAt).toLocaleString()} · mode: {run.input?.runMode || '-'}
                      </div>
                      {tags.length > 0 && (
                        <div className="hint" style={{ marginBottom: '0.2rem' }}>tags: {tags.slice(0, 8).join(', ')}</div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {typeof score === 'number' ? score : '-'}
                      </div>
                      <div className="hint">{traction}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                    <Link href={`/run/${run.id}/report`} className="btn btn-primary" style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}>
                      Open Report
                    </Link>
                    <Link href={`/run/${run.id}`} className="btn" style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      Run Detail
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
