'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface PersonaItem {
  id: string;
  name: string;
  role: string;
  skepticismLevel: string;
  decisionStyle: string;
  budgetRange: { min: number; max: number };
  cryptoInvestmentExperience: string;
  degenLevel: string;
  prioritiesCount: number;
  redFlagsCount: number;
}

interface PersonaApiResponse {
  source: string;
  total: number;
  filtered: number;
  count: number;
  personas: PersonaItem[];
}

export default function PersonasPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PersonaApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query.trim();
        const url = q ? `/api/personas?q=${encodeURIComponent(q)}&limit=2000` : '/api/personas?limit=2000';
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to load personas (${res.status})`);
        }
        const data = (await res.json()) as PersonaApiResponse;
        if (!cancelled) {
          setResponse(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load personas');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void load();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const personas = response?.personas || [];

  const summary = useMemo(() => {
    const bySkepticism = personas.reduce<Record<string, number>>((acc, p) => {
      acc[p.skepticismLevel] = (acc[p.skepticismLevel] || 0) + 1;
      return acc;
    }, {});
    const byCryptoExperience = personas.reduce<Record<string, number>>((acc, p) => {
      acc[p.cryptoInvestmentExperience] = (acc[p.cryptoInvestmentExperience] || 0) + 1;
      return acc;
    }, {});
    const byDegen = personas.reduce<Record<string, number>>((acc, p) => {
      acc[p.degenLevel] = (acc[p.degenLevel] || 0) + 1;
      return acc;
    }, {});

    return {
      bySkepticism,
      byCryptoExperience,
      byDegen,
    };
  }, [personas]);

  return (
    <main className="container">
      <header className="header" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>&larr; 허브</Link>
          <span style={{ color: 'var(--text-dim)' }}>·</span>
          <Link href="/reports" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>누적 리포트</Link>
          <span style={{ color: 'var(--text-dim)' }}>·</span>
          <Link href="/new" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>새 시뮬레이션</Link>
        </div>
        <h1>Persona Registry</h1>
        <p>현재 로드된 Persona 목록과 특성을 조회합니다.</p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="persona-search">검색 (id / name / role / decisionStyle / crypto / degen)</label>
          <input
            id="persona-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: cynical, investor, procurement"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '0.7rem' }}>
            <div className="hint">총 Persona</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{response?.total ?? '-'}</div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '0.7rem' }}>
            <div className="hint">현재 결과</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{response?.count ?? '-'}</div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '0.7rem' }}>
            <div className="hint">High+ Skepticism</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              {(summary.bySkepticism.high || 0) + (summary.bySkepticism.very_high || 0)}
            </div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '0.7rem' }}>
            <div className="hint">High+ Crypto Exp</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              {(summary.byCryptoExperience.high || 0) + (summary.byCryptoExperience.very_high || 0)}
            </div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '0.7rem' }}>
            <div className="hint">High+ Degen</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              {(summary.byDegen.high || 0) + (summary.byDegen.extreme || 0)}
            </div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '0.7rem' }}>
            <div className="hint">Registry Source</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{response?.source || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        {loading && <p className="hint">불러오는 중...</p>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && personas.length === 0 && (
          <p className="hint">표시할 Persona가 없습니다.</p>
        )}

        {!loading && !error && personas.length > 0 && (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {personas.map((persona) => (
              <div
                key={persona.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '0.7rem',
                  padding: '0.8rem',
                  background: 'var(--surface-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{persona.name}</div>
                    <div className="hint" style={{ marginTop: '0.1rem' }}>{persona.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{persona.skepticismLevel}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>${persona.budgetRange.min} - ${persona.budgetRange.max}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      crypto {persona.cryptoInvestmentExperience} · degen {persona.degenLevel}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{persona.role}</div>

                <div className="hint" style={{ marginTop: '0.4rem' }}>
                  decision: {persona.decisionStyle} · priorities: {persona.prioritiesCount} · red flags: {persona.redFlagsCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
