'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { PricingModel, RunMode, PersonaSetName } from '@simvibe/shared';
import { createRun } from '@/lib/api';

const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'one_time', label: 'One-time payment' },
  { value: 'usage_based', label: 'Usage-based' },
  { value: 'custom', label: 'Custom' },
];

const DEMO_REQUEST_INPUT: {
  tagline: string;
  description: string;
  url: string;
  pricingModel: PricingModel;
  category: string;
  tags: string;
  pastedContent: string;
  runMode: RunMode;
  personaSet: PersonaSetName;
  customPersonaIds: string;
  tokenName: string;
  tokenSymbol: string;
  launchThesis: string;
  distributionPlan: string;
  tokenNarrative: string;
  riskAssumptions: string;
  antiSnipe: boolean;
  bundled: boolean;
} = {
  tagline: 'The first meme-curated culture token on Monad',
  description:
    'MonadMemes aggregates and rewards the best community memes on Monad. Holders vote on meme contests, and top creators earn token rewards from a community treasury. Every chain needs its culture layer, and MonadMemes is the cultural heartbeat of Monad.',
  url: '',
  pricingModel: 'free',
  category: 'Meme',
  tags: 'Meme, Community, Monad, Culture',
  pastedContent: '',
  runMode: 'quick',
  personaSet: 'nad_fun_quick',
  customPersonaIds: '',
  tokenName: 'MonadMemes',
  tokenSymbol: 'MMEME',
  launchThesis:
    'Meme culture drives early adoption in every L1 ecosystem. MonadMemes captures that energy by tokenizing meme curation and turning attention into governance power.',
  distributionPlan:
    'Launch via nad.fun with anti-snipe enabled. Seed first 200 holders from Monad Discord meme channels, coordinate CT meme account raids, and run weekly meme contests with token rewards.',
  tokenNarrative:
    'Every chain needs its culture layer. MonadMemes is the cultural heartbeat of Monad where the community decides what is funny and what spreads.',
  riskAssumptions:
    'High churn risk typical of meme tokens, reliance on social momentum, possible sniper pressure at launch, and copycat competition if narrative traction appears.',
  antiSnipe: true,
  bundled: false,
};

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [pricingModel, setPricingModel] = useState<PricingModel>('freemium');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [runMode, setRunMode] = useState<RunMode>('quick');
  const [personaSet, setPersonaSet] = useState<PersonaSetName | ''>('');
  const [customPersonaIds, setCustomPersonaIds] = useState('');
  // nad.fun fields
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [launchThesis, setLaunchThesis] = useState('');
  const [distributionPlan, setDistributionPlan] = useState('');
  const [tokenNarrative, setTokenNarrative] = useState('');
  const [riskAssumptions, setRiskAssumptions] = useState('');
  const [antiSnipe, setAntiSnipe] = useState(false);
  const [bundled, setBundled] = useState(false);
  const [personaCount, setPersonaCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPersonaCount = async () => {
      try {
        const res = await fetch('/api/diagnostics');
        if (!res.ok) return;
        const data = await res.json();
        const count = data?.personaRegistry?.count;
        if (!cancelled && typeof count === 'number') {
          setPersonaCount(count);
        }
      } catch {
        // no-op
      }
    };
    void loadPersonaCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAutofillDemoInput = () => {
    setError(null);
    setTagline(DEMO_REQUEST_INPUT.tagline);
    setDescription(DEMO_REQUEST_INPUT.description);
    setUrl(DEMO_REQUEST_INPUT.url);
    setPricingModel(DEMO_REQUEST_INPUT.pricingModel);
    setCategory(DEMO_REQUEST_INPUT.category);
    setTags(DEMO_REQUEST_INPUT.tags);
    setPastedContent(DEMO_REQUEST_INPUT.pastedContent);
    setRunMode(DEMO_REQUEST_INPUT.runMode);
    setPersonaSet(DEMO_REQUEST_INPUT.personaSet);
    setCustomPersonaIds(DEMO_REQUEST_INPUT.customPersonaIds);
    setTokenName(DEMO_REQUEST_INPUT.tokenName);
    setTokenSymbol(DEMO_REQUEST_INPUT.tokenSymbol);
    setLaunchThesis(DEMO_REQUEST_INPUT.launchThesis);
    setDistributionPlan(DEMO_REQUEST_INPUT.distributionPlan);
    setTokenNarrative(DEMO_REQUEST_INPUT.tokenNarrative);
    setRiskAssumptions(DEMO_REQUEST_INPUT.riskAssumptions);
    setAntiSnipe(DEMO_REQUEST_INPUT.antiSnipe);
    setBundled(DEMO_REQUEST_INPUT.bundled);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!tagline.trim()) {
        throw new Error('Tagline is required');
      }
      if (!description.trim()) {
        throw new Error('Description is required');
      }

      const hasNadFunFields = Boolean(launchThesis.trim() || tokenNarrative.trim() || tokenName.trim());
      if (!url.trim() && !pastedContent.trim() && !hasNadFunFields) {
        throw new Error(
          'Provide a URL, pasted content, or at least one nad.fun field (token name, launch thesis, or token narrative)',
        );
      }

      const parsedPersonaIds = customPersonaIds.trim()
        ? customPersonaIds.split(',').map(id => id.trim()).filter(Boolean)
        : undefined;

      const nadFunSubmission = {
        tokenName: tokenName.trim() || undefined,
        tokenSymbol: tokenSymbol.trim() || undefined,
        launchThesis: launchThesis.trim() || undefined,
        distributionPlan: distributionPlan.trim() || undefined,
        tokenNarrative: tokenNarrative.trim() || undefined,
        riskAssumptions: riskAssumptions.trim() || undefined,
        antiSnipe: antiSnipe || undefined,
        bundled: bundled || undefined,
      };

      const result = await createRun({
        tagline: tagline.trim(),
        description: description.trim(),
        url: url.trim() || undefined,
        pricingModel,
        category: category.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        pastedContent: pastedContent.trim() || undefined,
        runMode,
        personaIds: parsedPersonaIds,
        personaSet: personaSet || undefined,
        platformMode: 'nad_fun',
        nadFunSubmission,
      });

      router.push(`/run/${result.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <header className="header">
        <div className="top-nav">
          <Link href="/">&larr; Hub</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/personas">Personas</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.25rem' }}>
          <Image src="/logo-mark.svg" alt="simvi.be logo" width={36} height={36} />
          <h1 style={{ marginBottom: 0 }}>New Simulation</h1>
        </div>
        <p>Predict nad.fun launch reaction before going live.</p>
      </header>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="card quick-fill-card">
          <div className="quick-fill-row">
            <div>
              <h2 style={{ marginBottom: '0.25rem', fontSize: '1.08rem' }}>Demo Input Example</h2>
              <p className="hint" style={{ margin: 0 }}>
                nad.fun launch 예시 1세트를 모든 필드에 자동 입력합니다.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleAutofillDemoInput}
              style={{ whiteSpace: 'nowrap' }}
            >
              Autofill Example
            </button>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Token / Project Info</h2>

          <div className="form-group">
            <label htmlFor="tagline">Tagline *</label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g., The community-driven DeFi token on Monad"
              maxLength={200}
              required
            />
            <p className="hint">A compelling one-liner for your token launch</p>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your token project: what it does, target community, utility, and what makes it unique..."
              maxLength={2000}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="pricingModel">Pricing Model *</label>
              <select
                id="pricingModel"
                value={pricingModel}
                onChange={(e) => setPricingModel(e.target.value as PricingModel)}
              >
                {PRICING_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Developer Tools, Marketing, AI"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tags</label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., AI, SaaS, B2B, Productivity (comma-separated)"
            />
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Project URL / Content</h2>
          <p className="hint" style={{ marginBottom: '0.75rem' }}>
            Optional if you filled in nad.fun launch fields above.
          </p>

          <div className="form-group">
            <label htmlFor="url">Project / Token URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourtoken.xyz or nad.fun/token/..."
            />
            <p className="hint">We'll extract content from your project page (optional for nad.fun mode)</p>
          </div>

          <div className="form-group">
            <label htmlFor="pastedContent">Or paste content directly</label>
            <textarea
              id="pastedContent"
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste your token project description, whitepaper excerpt, or community pitch..."
              style={{ minHeight: '150px' }}
            />
            <p className="hint">Use this if your page is not public or extraction fails</p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>nad.fun Launch Inputs</h2>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p className="hint" style={{ marginBottom: '1rem' }}>
                Enter your nad.fun token launch details. You can run without a landing URL if you fill in launch fields.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tokenName">
                    Token Name <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(max 100 chars)</span>
                  </label>
                  <input
                    id="tokenName"
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g., SimVibe Token"
                    maxLength={100}
                  />
                  <p className="hint">{tokenName.length}/100</p>
                </div>
                <div className="form-group">
                  <label htmlFor="tokenSymbol">
                    Token Symbol <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(max 10 chars)</span>
                  </label>
                  <input
                    id="tokenSymbol"
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g., SVIBE"
                    maxLength={10}
                  />
                  <p className="hint">{tokenSymbol.length}/10</p>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="launchThesis">
                  Launch Thesis <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(max 1000 chars)</span>
                </label>
                <textarea
                  id="launchThesis"
                  value={launchThesis}
                  onChange={(e) => setLaunchThesis(e.target.value)}
                  placeholder="Why are you launching this token? What problem does it solve? What's the core value proposition?"
                  maxLength={1000}
                  style={{ minHeight: '100px' }}
                />
                <p className="hint">{launchThesis.length}/1000</p>
              </div>

              <div className="form-group">
                <label htmlFor="tokenNarrative">
                  Token Narrative <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(max 1000 chars)</span>
                </label>
                <textarea
                  id="tokenNarrative"
                  value={tokenNarrative}
                  onChange={(e) => setTokenNarrative(e.target.value)}
                  placeholder="What story does this token tell? How does it fit into current market narratives? What memes or cultural hooks does it leverage?"
                  maxLength={1000}
                  style={{ minHeight: '100px' }}
                />
                <p className="hint">{tokenNarrative.length}/1000</p>
              </div>

              <div className="form-group">
                <label htmlFor="distributionPlan">
                  Distribution Plan <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(max 1000 chars)</span>
                </label>
                <textarea
                  id="distributionPlan"
                  value={distributionPlan}
                  onChange={(e) => setDistributionPlan(e.target.value)}
                  placeholder="How will you drive initial attention and buyers? Community channels, KOLs, raids, social campaigns..."
                  maxLength={1000}
                  style={{ minHeight: '80px' }}
                />
                <p className="hint">{distributionPlan.length}/1000</p>
              </div>

              <div className="form-group">
                <label htmlFor="riskAssumptions">
                  Risk Assumptions <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(max 1000 chars)</span>
                </label>
                <textarea
                  id="riskAssumptions"
                  value={riskAssumptions}
                  onChange={(e) => setRiskAssumptions(e.target.value)}
                  placeholder="Known risks: snipe exposure, low initial liquidity, team token concentration, regulatory concerns..."
                  maxLength={1000}
                  style={{ minHeight: '80px' }}
                />
                <p className="hint">{riskAssumptions.length}/1000</p>
              </div>

              <div className="form-row" style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={antiSnipe}
                    onChange={(e) => setAntiSnipe(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Anti-Snipe Protection</span>
                  <span className="hint" style={{ margin: 0 }}>Delay early buys to reduce sniper advantage</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bundled}
                    onChange={(e) => setBundled(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Bundled Launch</span>
                  <span className="hint" style={{ margin: 0 }}>Bundle initial liquidity with token creation</span>
                </label>
              </div>
          </div>

        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Simulation Mode</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label
              style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${runMode === 'quick' ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: runMode === 'quick' ? 'var(--accent-primary-soft)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="runMode"
                value="quick"
                checked={runMode === 'quick'}
                onChange={() => setRunMode('quick')}
                style={{ display: 'none' }}
              />
              <strong>Quick</strong>
              <p className="hint" style={{ margin: '0.25rem 0 0' }}>5 personas, ~2 min</p>
            </label>
            <label
              style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${runMode === 'deep' ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: runMode === 'deep' ? 'var(--accent-primary-soft)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="runMode"
                value="deep"
                checked={runMode === 'deep'}
                onChange={() => setRunMode('deep')}
                style={{ display: 'none' }}
              />
              <strong>Deep</strong>
              <p className="hint" style={{ margin: '0.25rem 0 0' }}>11 personas + debate, ~10 min</p>
            </label>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Persona Configuration</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <p className="hint" style={{ margin: 0 }}>
              Loaded personas: <strong style={{ color: 'var(--accent-primary)' }}>{personaCount ?? '-'}</strong>
            </p>
            <Link
              href="/personas"
              className="btn"
              style={{ padding: '0.45rem 0.75rem', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              View Persona Registry
            </Link>
          </div>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            Override persona selection (optional). Defaults to mode-specific set.
          </p>

          <div className="form-group">
            <label htmlFor="personaSet">Persona Set</label>
            <select
              id="personaSet"
              value={personaSet}
              onChange={(e) => {
                setPersonaSet(e.target.value as PersonaSetName | '');
                if (e.target.value !== 'custom') setCustomPersonaIds('');
              }}
            >
              <option value="">Mode default</option>
              <option value="quick">Quick (5 core personas)</option>
              <option value="deep">Deep (11 personas)</option>
              <option value="nad_fun_quick">nad.fun Quick (5 crypto-native)</option>
              <option value="nad_fun_deep">nad.fun Deep (12 crypto-native)</option>
              <option value="custom">Custom persona IDs</option>
            </select>
          </div>

          {personaSet === 'custom' && (
            <div className="form-group">
              <label htmlFor="customPersonaIds">Custom Persona IDs</label>
              <input
                id="customPersonaIds"
                type="text"
                value={customPersonaIds}
                onChange={(e) => setCustomPersonaIds(e.target.value)}
                placeholder="e.g., cynical_engineer, indie_fullstack_builder, scrappy_startup_ops"
              />
              <p className="hint">Comma-separated persona IDs from the registry</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', marginTop: '1rem' }}
        >
          {loading ? 'Creating Simulation...' : 'Simulate Launch Reaction'}
        </button>
      </form>
    </main>
  );
}
