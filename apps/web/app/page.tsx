'use client';

import Link from 'next/link';
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
      <header className="header" style={{ marginBottom: '1.25rem' }}>
        <h1>simvi.be</h1>
        <p>배포 리허설 허브: 누적 리포트 확인과 새 시뮬레이션 실행을 분리했습니다.</p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>현재 상태</h2>
        {loading ? (
          <p className="hint">최근 런 집계 불러오는 중...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.65rem', padding: '0.75rem' }}>
              <div className="hint">누적 런</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.totalRuns}</div>
            </div>
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.65rem', padding: '0.75rem' }}>
              <div className="hint">완료 리포트</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.completedRuns}</div>
            </div>
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.65rem', padding: '0.75rem' }}>
              <div className="hint">시드 감지</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary.seededRuns}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>빠른 이동</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Link
            href="/reports"
            style={{
              display: 'block',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1rem',
              background: 'var(--surface-subtle)',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>누적 리포트 보기</div>
            <p className="hint" style={{ margin: 0 }}>완료된 시뮬레이션 리포트를 모아서 확인합니다.</p>
          </Link>

          <Link
            href="/new"
            style={{
              display: 'block',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1rem',
              background: 'var(--accent-primary-soft)',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>새 시뮬레이션 시작</div>
            <p className="hint" style={{ margin: 0 }}>Product Hunt/Generic 입력으로 새 런을 생성합니다.</p>
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>운영 경로</h2>
        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <li>웹: <code>https://simvibe.studioliq.com</code></li>
          <li>API: <code>https://api-simvibe.studioliq.com</code></li>
          <li>진단: <code>/api/diagnostics</code></li>
        </ul>
      </div>
    </main>
  );
}
