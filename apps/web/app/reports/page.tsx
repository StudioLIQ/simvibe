'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type RunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

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
  const phName = run.input?.phSubmission?.productName?.trim();
  if (phName) return phName;
  return run.input?.tagline || run.id;
}

export default function ReportsPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [seededOnly, setSeededOnly] = useState(false);

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
          setError(err instanceof Error ? err.message : '리포트 목록을 불러오지 못했습니다.');
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
  }, [runs, query, seededOnly]);

  return (
    <main className="container">
      <header className="header" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>&larr; 허브</Link>
          <span style={{ color: 'var(--text-dim)' }}>·</span>
          <Link href="/new" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>새 시뮬레이션</Link>
          <span style={{ color: 'var(--text-dim)' }}>·</span>
          <Link href="/personas" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Persona 목록</Link>
        </div>
        <h1>누적 리포트</h1>
        <p>완료된 런의 리포트를 한 곳에서 확인합니다.</p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="search">검색 (이름, runId, 태그)</label>
          <input
            id="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: conva, run_xxx, seed:ph"
          />
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={seededOnly}
            onChange={(e) => setSeededOnly(e.target.checked)}
          />
          시딩된 리포트만 보기
        </label>
      </div>

      <div className="card">
        {loading && <p className="hint">불러오는 중...</p>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && completedReports.length === 0 && (
          <p className="hint">조건에 맞는 리포트가 없습니다.</p>
        )}

        {!loading && !error && completedReports.length > 0 && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {completedReports.map((run) => {
              const score = run.report?.overallScore;
              const traction = run.report?.tractionBand || '-';
              const tags = run.input?.tags || [];

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
                      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{getTitle(run)}</div>
                      <div className="hint" style={{ marginBottom: '0.3rem' }}>
                        {run.id} · {new Date(run.createdAt).toLocaleString()} · mode: {run.input?.runMode || '-'} · platform: {run.input?.platformMode || 'generic'}
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
                      Report 보기
                    </Link>
                    <Link href={`/run/${run.id}`} className="btn" style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      Run 상세
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
