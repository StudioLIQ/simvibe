'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

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

type SortKey = 'id_asc' | 'budget_desc' | 'skepticism_desc' | 'red_flags_desc';

const SKEPTICISM_RANK: Record<string, number> = {
  very_low: 0,
  low: 1,
  moderate: 2,
  medium: 2,
  high: 3,
  very_high: 4,
  extreme: 5,
};

interface PersonaPreset {
  id: string;
  label: string;
  hint: string;
  state: {
    query: string;
    skepticismFilter: string;
    cryptoFilter: string;
    degenFilter: string;
    decisionFilter: string;
    sortBy: SortKey;
  };
}

const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'high_skepticism',
    label: 'High Skepticism',
    hint: 'Filter skeptical evaluators first',
    state: {
      query: '',
      skepticismFilter: 'high_plus',
      cryptoFilter: 'all',
      degenFilter: 'all',
      decisionFilter: 'all',
      sortBy: 'skepticism_desc',
    },
  },
  {
    id: 'whale_segment',
    label: 'Whale Segment',
    hint: 'High crypto + high degen sorted by budget',
    state: {
      query: '',
      skepticismFilter: 'all',
      cryptoFilter: 'high_plus',
      degenFilter: 'high_plus',
      decisionFilter: 'all',
      sortBy: 'budget_desc',
    },
  },
  {
    id: 'risk_audit',
    label: 'Risk Audit',
    hint: 'Most red-flag-heavy personas first',
    state: {
      query: '',
      skepticismFilter: 'all',
      cryptoFilter: 'all',
      degenFilter: 'all',
      decisionFilter: 'all',
      sortBy: 'red_flags_desc',
    },
  },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toLabel(value: string): string {
  if (value === 'high_plus') return 'High+';
  if (value === 'all') return 'All';
  return value
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function skepticismRank(value: string): number {
  return SKEPTICISM_RANK[value] ?? 1;
}

function isHighPlus(value: string): boolean {
  return skepticismRank(value) >= 3;
}

function isSortKey(value: string | null): value is SortKey {
  return value === 'id_asc' || value === 'budget_desc' || value === 'skepticism_desc' || value === 'red_flags_desc';
}

export default function PersonasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initializedFromUrl = useRef(false);

  const [query, setQuery] = useState('');
  const [skepticismFilter, setSkepticismFilter] = useState('all');
  const [cryptoFilter, setCryptoFilter] = useState('all');
  const [degenFilter, setDegenFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('id_asc');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [urlSyncReady, setUrlSyncReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PersonaApiResponse | null>(null);

  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;

    const queryParam = searchParams.get('q');
    const skepticismParam = searchParams.get('skepticism');
    const cryptoParam = searchParams.get('crypto');
    const degenParam = searchParams.get('degen');
    const decisionParam = searchParams.get('decision');
    const sortParam = searchParams.get('sort');

    if (queryParam) setQuery(queryParam);
    if (skepticismParam) setSkepticismFilter(normalize(skepticismParam));
    if (cryptoParam) setCryptoFilter(normalize(cryptoParam));
    if (degenParam) setDegenFilter(normalize(degenParam));
    if (decisionParam) setDecisionFilter(normalize(decisionParam));
    if (isSortKey(sortParam)) setSortBy(sortParam);

    setUrlSyncReady(true);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/personas?limit=5000');
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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (skepticismFilter !== 'all') params.set('skepticism', skepticismFilter);
    if (cryptoFilter !== 'all') params.set('crypto', cryptoFilter);
    if (degenFilter !== 'all') params.set('degen', degenFilter);
    if (decisionFilter !== 'all') params.set('decision', decisionFilter);
    if (sortBy !== 'id_asc') params.set('sort', sortBy);
    return params.toString();
  }, [query, skepticismFilter, cryptoFilter, degenFilter, decisionFilter, sortBy]);

  useEffect(() => {
    if (!urlSyncReady) return;

    const timer = setTimeout(() => {
      const current = searchParams.toString();
      if (current === queryString) return;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }, 180);

    return () => clearTimeout(timer);
  }, [urlSyncReady, searchParams, queryString, router, pathname]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 1300);
    return () => clearTimeout(timer);
  }, [copyState]);

  const personas = response?.personas ?? [];

  const skepticismOptions = useMemo(
    () =>
      Array.from(new Set(personas.map((persona) => persona.skepticismLevel)))
        .sort((a, b) => skepticismRank(a) - skepticismRank(b)),
    [personas],
  );

  const cryptoOptions = useMemo(
    () =>
      Array.from(new Set(personas.map((persona) => persona.cryptoInvestmentExperience)))
        .sort((a, b) => a.localeCompare(b)),
    [personas],
  );

  const degenOptions = useMemo(
    () =>
      Array.from(new Set(personas.map((persona) => persona.degenLevel)))
        .sort((a, b) => a.localeCompare(b)),
    [personas],
  );

  const decisionOptions = useMemo(
    () =>
      Array.from(new Set(personas.map((persona) => persona.decisionStyle)))
        .sort((a, b) => a.localeCompare(b)),
    [personas],
  );

  const filteredPersonas = useMemo(() => {
    const normalizedQuery = normalize(query);

    const next = personas.filter((persona) => {
      if (skepticismFilter === 'high_plus' && !isHighPlus(persona.skepticismLevel)) return false;
      if (skepticismFilter !== 'all' && skepticismFilter !== 'high_plus' && persona.skepticismLevel !== skepticismFilter) return false;

      if (cryptoFilter === 'high_plus' && !isHighPlus(persona.cryptoInvestmentExperience)) return false;
      if (cryptoFilter !== 'all' && cryptoFilter !== 'high_plus' && persona.cryptoInvestmentExperience !== cryptoFilter) return false;

      if (degenFilter === 'high_plus' && !isHighPlus(persona.degenLevel)) return false;
      if (degenFilter !== 'all' && degenFilter !== 'high_plus' && persona.degenLevel !== degenFilter) return false;

      if (decisionFilter !== 'all' && persona.decisionStyle !== decisionFilter) return false;

      if (!normalizedQuery) return true;

      const haystack = normalize(
        `${persona.id} ${persona.name} ${persona.role} ${persona.decisionStyle} ` +
          `${persona.cryptoInvestmentExperience} ${persona.degenLevel} ${persona.skepticismLevel}`,
      );
      return haystack.includes(normalizedQuery);
    });

    next.sort((a, b) => {
      if (sortBy === 'budget_desc') {
        const diff = b.budgetRange.max - a.budgetRange.max;
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      if (sortBy === 'skepticism_desc') {
        const diff = skepticismRank(b.skepticismLevel) - skepticismRank(a.skepticismLevel);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      if (sortBy === 'red_flags_desc') {
        const diff = b.redFlagsCount - a.redFlagsCount;
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      return a.id.localeCompare(b.id);
    });

    return next;
  }, [personas, query, skepticismFilter, cryptoFilter, degenFilter, decisionFilter, sortBy]);

  const summary = useMemo(() => {
    const bySkepticism = filteredPersonas.reduce<Record<string, number>>((acc, persona) => {
      acc[persona.skepticismLevel] = (acc[persona.skepticismLevel] || 0) + 1;
      return acc;
    }, {});

    const averageMaxBudget = filteredPersonas.length > 0
      ? Math.round(
          filteredPersonas.reduce((acc, persona) => acc + persona.budgetRange.max, 0) /
            filteredPersonas.length,
        )
      : 0;

    return {
      bySkepticism,
      averageMaxBudget,
    };
  }, [filteredPersonas]);

  const activeFilters = useMemo(() => {
    const chips: string[] = [];
    if (skepticismFilter !== 'all') chips.push(`Skepticism: ${toLabel(skepticismFilter)}`);
    if (cryptoFilter !== 'all') chips.push(`Crypto: ${toLabel(cryptoFilter)}`);
    if (degenFilter !== 'all') chips.push(`Degen: ${toLabel(degenFilter)}`);
    if (decisionFilter !== 'all') chips.push(`Decision: ${toLabel(decisionFilter)}`);
    return chips;
  }, [skepticismFilter, cryptoFilter, degenFilter, decisionFilter]);

  const activePresetId = useMemo(() => {
    const found = PERSONA_PRESETS.find((preset) => {
      return preset.state.query === query
        && preset.state.skepticismFilter === skepticismFilter
        && preset.state.cryptoFilter === cryptoFilter
        && preset.state.degenFilter === degenFilter
        && preset.state.decisionFilter === decisionFilter
        && preset.state.sortBy === sortBy;
    });
    return found?.id ?? null;
  }, [query, skepticismFilter, cryptoFilter, degenFilter, decisionFilter, sortBy]);

  const applyPreset = (preset: PersonaPreset) => {
    setQuery(preset.state.query);
    setSkepticismFilter(preset.state.skepticismFilter);
    setCryptoFilter(preset.state.cryptoFilter);
    setDegenFilter(preset.state.degenFilter);
    setDecisionFilter(preset.state.decisionFilter);
    setSortBy(preset.state.sortBy);
  };

  const clearFilters = () => {
    setQuery('');
    setSkepticismFilter('all');
    setCryptoFilter('all');
    setDegenFilter('all');
    setDecisionFilter('all');
    setSortBy('id_asc');
  };

  const copyShareLink = async () => {
    try {
      const url = `${window.location.origin}${pathname}${queryString ? `?${queryString}` : ''}`;
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <main className="container">
      <header className="header header-hero persona-hero" style={{ marginBottom: '1rem' }}>
        <div className="top-nav">
          <Link href="/">&larr; Hub</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/new">Start Simulation</Link>
        </div>
        <h1>Persona Registry</h1>
        <p>Search, segment, and inspect personas by skepticism, budget power, and decision behavior.</p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="persona-search">Search (id / name / role / decision style / crypto / degen)</label>
          <input
            id="persona-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. cynical, investor, procurement"
          />
        </div>

        <div className="persona-preset-grid">
          {PERSONA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`persona-preset-btn ${activePresetId === preset.id ? 'persona-preset-btn--active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              <span>{preset.label}</span>
              <small>{preset.hint}</small>
            </button>
          ))}
        </div>

        <div className="persona-filter-grid">
          <div className="form-group">
            <label htmlFor="persona-filter-skepticism">Skepticism</label>
            <select
              id="persona-filter-skepticism"
              value={skepticismFilter}
              onChange={(e) => setSkepticismFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="high_plus">High+</option>
              {skepticismOptions.map((value) => (
                <option key={value} value={value}>{toLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="persona-filter-crypto">Crypto Experience</label>
            <select
              id="persona-filter-crypto"
              value={cryptoFilter}
              onChange={(e) => setCryptoFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="high_plus">High+</option>
              {cryptoOptions.map((value) => (
                <option key={value} value={value}>{toLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="persona-filter-degen">Degen Level</label>
            <select
              id="persona-filter-degen"
              value={degenFilter}
              onChange={(e) => setDegenFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="high_plus">High+</option>
              {degenOptions.map((value) => (
                <option key={value} value={value}>{toLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="persona-filter-decision">Decision Style</label>
            <select
              id="persona-filter-decision"
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
            >
              <option value="all">All</option>
              {decisionOptions.map((value) => (
                <option key={value} value={value}>{toLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="persona-filter-sort">Sort</label>
            <select
              id="persona-filter-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              <option value="id_asc">ID (A-Z)</option>
              <option value="budget_desc">Budget (High to Low)</option>
              <option value="skepticism_desc">Skepticism (High to Low)</option>
              <option value="red_flags_desc">Red Flags (High to Low)</option>
            </select>
          </div>

          <div className="persona-actions">
            <button type="button" className="btn" onClick={copyShareLink}>Copy Share Link</button>
            <button type="button" className="btn" onClick={clearFilters}>Reset Filters</button>
          </div>
        </div>

        {copyState === 'copied' && <p className="hint">Share link copied.</p>}
        {copyState === 'error' && <p className="hint">Could not copy link. Copy from the address bar.</p>}

        {activeFilters.length > 0 && (
          <div className="persona-active-filters">
            {activeFilters.map((value) => (
              <span key={value} className="persona-badge">{value}</span>
            ))}
          </div>
        )}
      </div>

      <div className="persona-summary-grid" style={{ marginBottom: '1rem' }}>
        <div className="persona-stat-card">
          <div className="persona-stat-label">Total Personas</div>
          <div className="persona-stat-value">{response?.total ?? '-'}</div>
        </div>
        <div className="persona-stat-card">
          <div className="persona-stat-label">Showing</div>
          <div className="persona-stat-value">{filteredPersonas.length}</div>
        </div>
        <div className="persona-stat-card">
          <div className="persona-stat-label">High+ Skepticism</div>
          <div className="persona-stat-value">
            {(summary.bySkepticism.high || 0) + (summary.bySkepticism.very_high || 0)}
          </div>
        </div>
        <div className="persona-stat-card">
          <div className="persona-stat-label">Avg Max Budget</div>
          <div className="persona-stat-value">${summary.averageMaxBudget || 0}</div>
        </div>
        <div className="persona-stat-card">
          <div className="persona-stat-label">Registry Source</div>
          <div className="persona-stat-value persona-stat-value--small">{response?.source || '-'}</div>
        </div>
      </div>

      <div className="card">
        {loading && <p className="hint">Loading personas...</p>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && filteredPersonas.length === 0 && (
          <p className="hint">No personas to display.</p>
        )}

        {!loading && !error && filteredPersonas.length > 0 && (
          <div className="persona-list">
            <p className="hint">Showing {filteredPersonas.length} of {personas.length} personas.</p>
            {filteredPersonas.map((persona) => (
              <article key={persona.id} className="persona-card">
                <div className="persona-card-head">
                  <div>
                    <h3 className="persona-title">{persona.name}</h3>
                    <div className="persona-id">{persona.id}</div>
                  </div>
                  <div className="persona-badge-row">
                    <span className="persona-badge">Skepticism: {toLabel(persona.skepticismLevel)}</span>
                    <span className="persona-badge">Crypto: {toLabel(persona.cryptoInvestmentExperience)}</span>
                    <span className="persona-badge">Degen: {toLabel(persona.degenLevel)}</span>
                  </div>
                </div>

                <p className="persona-role">{persona.role}</p>
                <div className="persona-meta">
                  <span>Budget: ${persona.budgetRange.min} - ${persona.budgetRange.max}</span>
                  <span>Decision: {toLabel(persona.decisionStyle)}</span>
                  <span>Priorities: {persona.prioritiesCount}</span>
                  <span>Red Flags: {persona.redFlagsCount}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
