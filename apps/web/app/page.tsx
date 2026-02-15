'use client';

import { useState } from 'react';
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
      if (!url.trim() && !pastedContent.trim()) {
        throw new Error('Please provide a URL or paste your landing page content');
      }

      const parsedPersonaIds = customPersonaIds.trim()
        ? customPersonaIds.split(',').map(id => id.trim()).filter(Boolean)
        : undefined;

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
        <h1>simvi.be</h1>
        <p>Launch into a synthetic market before you launch into the real one.</p>
      </header>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Product Information</h2>

          <div className="form-group">
            <label htmlFor="tagline">Tagline *</label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g., The AI-powered code review tool for teams"
              maxLength={200}
              required
            />
            <p className="hint">A compelling one-liner that describes your product</p>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what your product does, who it's for, and what makes it unique..."
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
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Landing Page</h2>

          <div className="form-group">
            <label htmlFor="url">Landing Page URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourproduct.com"
            />
            <p className="hint">We'll extract content from your landing page</p>
          </div>

          <div className="form-group">
            <label htmlFor="pastedContent">Or paste your landing page content</label>
            <textarea
              id="pastedContent"
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste the text content from your landing page here if you don't have a URL..."
              style={{ minHeight: '150px' }}
            />
            <p className="hint">Use this if your page is not public or extraction fails</p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Simulation Mode</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label
              style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${runMode === 'quick' ? '#6366f1' : '#333'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: runMode === 'quick' ? 'rgba(99,102,241,0.1)' : 'transparent',
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
                border: `2px solid ${runMode === 'deep' ? '#6366f1' : '#333'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: runMode === 'deep' ? 'rgba(99,102,241,0.1)' : 'transparent',
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
          {loading ? 'Creating World...' : 'Create World'}
        </button>
      </form>
    </main>
  );
}
