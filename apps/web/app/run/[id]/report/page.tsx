'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  Report,
  PersonaReport,
  FrictionItem,
  ActualOutcomes,
  ChainReceipt,
  NadLaunchInput,
  LaunchReadiness,
  LaunchRecord,
} from '@simvibe/shared';

interface PredictionErrors {
  signupError: number;
  payError: number;
  bounceError?: number;
  absoluteSignupError: number;
  absolutePayError: number;
  absoluteBounceError?: number;
}

interface RunData {
  id: string;
  status: string;
  input: {
    tagline: string;
    description: string;
  };
  report?: Report;
  actuals?: ActualOutcomes;
  receipt?: ChainReceipt;
  variantOf?: string;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>{score}</span>
      </div>
      <div style={{ background: '#333', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
        <div style={{ background: color, width: `${score}%`, height: '100%', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function FrictionCard({ friction }: { friction: FrictionItem }) {
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{
            background: '#333',
            padding: '0.125rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: '#888',
            marginRight: '0.5rem',
          }}>
            #{friction.rank}
          </span>
          <span style={{ fontWeight: 500 }}>{friction.trigger}</span>
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: friction.severity > 0.7 ? '#ef4444' : friction.severity > 0.4 ? '#eab308' : '#888',
        }}>
          {(friction.severity * 100).toFixed(0)}% severity
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#888' }}>
        Category: {friction.category}
      </div>
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
        Cited by: {friction.agentsCiting.join(', ')}
      </div>
    </div>
  );
}

function PersonaCard({ persona }: { persona: PersonaReport }) {
  const actionColor = persona.primaryAction === 'PAY' ? '#22c55e' :
                      persona.primaryAction === 'SIGNUP' ? '#0ea5e9' :
                      persona.primaryAction === 'BOUNCE' ? '#ef4444' : '#888';
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, color: '#a78bfa' }}>{persona.personaId}</span>
        {persona.isFallback && (
          <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: '#422006', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>
            FALLBACK
          </span>
        )}
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ color: '#888', fontSize: '0.875rem' }}>Primary Action: </span>
        <span style={{ color: actionColor, fontWeight: 500 }}>{persona.primaryAction}</span>
      </div>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        <span style={{ color: '#888' }}>Friction: </span>
        <span style={{ color: '#ccc' }}>{persona.primaryFriction}</span>
      </div>
      <div style={{
        background: '#0a0a0a',
        padding: '0.75rem',
        borderRadius: '4px',
        fontSize: '0.875rem',
        borderLeft: '3px solid #0ea5e9',
      }}>
        <strong style={{ color: '#0ea5e9' }}>Fix:</strong> {persona.oneLineFix}
      </div>
    </div>
  );
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [run, setRun] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [whatIfTagline, setWhatIfTagline] = useState('');
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showActuals, setShowActuals] = useState(false);
  const [actualsInput, setActualsInput] = useState({ signupRate: '', payRate: '', bounceRate: '', notes: '' });
  const [isSavingActuals, setIsSavingActuals] = useState(false);
  const [predictionErrors, setPredictionErrors] = useState<PredictionErrors | null>(null);
  const [isCreatingReceipt, setIsCreatingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [chainEnabled, setChainEnabled] = useState(false);

  // Launch state
  const [launchReadiness, setLaunchReadiness] = useState<LaunchReadiness | null>(null);
  const [launchInput, setLaunchInput] = useState<NadLaunchInput | null>(null);
  const [launchRecord, setLaunchRecord] = useState<LaunchRecord | null>(null);
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [isSavingLaunch, setIsSavingLaunch] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionPlan, setExecutionPlan] = useState<{ mode: string; deepLinkUrl?: string; txData?: unknown } | null>(null);
  const [editingLaunch, setEditingLaunch] = useState({
    name: '',
    symbol: '',
    description: '',
    website: '',
    x: '',
    telegram: '',
    antiSnipe: false,
    bundled: false,
  });

  useEffect(() => {
    fetchRun();
    fetchReceiptStatus();
    fetchLaunchData();
  }, [id]);

  useEffect(() => {
    if (run) {
      setWhatIfTagline(run.input.tagline);
      if (run.actuals) {
        setActualsInput({
          signupRate: (run.actuals.signupRate * 100).toFixed(1),
          payRate: (run.actuals.payRate * 100).toFixed(1),
          bounceRate: run.actuals.bounceRate !== undefined ? (run.actuals.bounceRate * 100).toFixed(1) : '',
          notes: run.actuals.notes || '',
        });
        if (run.report) {
          const predicted = {
            signupRate: run.report.metrics.expectedSignups,
            payRate: run.report.metrics.expectedPays,
            bounceRate: run.report.metrics.bounceRate,
          };
          setPredictionErrors({
            signupError: predicted.signupRate - run.actuals.signupRate,
            payError: predicted.payRate - run.actuals.payRate,
            bounceError: run.actuals.bounceRate !== undefined
              ? predicted.bounceRate - run.actuals.bounceRate
              : undefined,
            absoluteSignupError: Math.abs(predicted.signupRate - run.actuals.signupRate),
            absolutePayError: Math.abs(predicted.payRate - run.actuals.payRate),
            absoluteBounceError: run.actuals.bounceRate !== undefined
              ? Math.abs(predicted.bounceRate - run.actuals.bounceRate)
              : undefined,
          });
        }
      }
    }
  }, [run]);

  const fetchRun = async () => {
    try {
      const response = await fetch(`/api/run/${id}`);
      if (!response.ok) {
        throw new Error('Run not found');
      }
      const data = await response.json();
      setRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    }
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createVariant = async () => {
    if (!whatIfTagline.trim() || whatIfTagline.trim() === run?.input.tagline) {
      return;
    }

    setIsCreatingVariant(true);
    try {
      const response = await fetch(`/api/run/${id}/variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagline: whatIfTagline.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create variant');
      }

      const data = await response.json();
      router.push(`/run/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant');
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const saveActuals = async () => {
    const signupRate = parseFloat(actualsInput.signupRate) / 100;
    const payRate = parseFloat(actualsInput.payRate) / 100;
    const bounceRate = actualsInput.bounceRate ? parseFloat(actualsInput.bounceRate) / 100 : undefined;

    if (isNaN(signupRate) || signupRate < 0 || signupRate > 1) {
      setError('Invalid signup rate. Enter a percentage between 0 and 100.');
      return;
    }
    if (isNaN(payRate) || payRate < 0 || payRate > 1) {
      setError('Invalid pay rate. Enter a percentage between 0 and 100.');
      return;
    }
    if (bounceRate !== undefined && (isNaN(bounceRate) || bounceRate < 0 || bounceRate > 1)) {
      setError('Invalid bounce rate. Enter a percentage between 0 and 100.');
      return;
    }

    setIsSavingActuals(true);
    setError(null);

    try {
      const response = await fetch(`/api/run/${id}/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupRate,
          payRate,
          bounceRate,
          notes: actualsInput.notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save actuals');
      }

      const data = await response.json();
      setPredictionErrors(data.errors);
      await fetchRun();
      setShowActuals(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save actuals');
    } finally {
      setIsSavingActuals(false);
    }
  };

  const fetchReceiptStatus = async () => {
    try {
      const response = await fetch(`/api/run/${id}/receipt`);
      if (response.ok) {
        const data = await response.json();
        setChainEnabled(data.chainEnabled);
      }
    } catch (err) {
      console.error('Error fetching receipt status:', err);
    }
  };

  const createReceipt = async () => {
    setIsCreatingReceipt(true);
    setReceiptError(null);

    try {
      const response = await fetch(`/api/run/${id}/receipt`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create receipt');
      }

      if (data.error) {
        setReceiptError(data.error);
      }

      await fetchRun();
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to create receipt');
    } finally {
      setIsCreatingReceipt(false);
    }
  };

  const fetchLaunchData = async () => {
    try {
      const response = await fetch(`/api/run/${id}/launch`);
      if (response.ok) {
        const data = await response.json();
        setLaunchReadiness(data.readiness);
        setLaunchInput(data.launchInput);
        setLaunchRecord(data.launchRecord);
        if (data.launchInput) {
          setEditingLaunch({
            name: data.launchInput.name || '',
            symbol: data.launchInput.symbol || '',
            description: data.launchInput.description || '',
            website: data.launchInput.website || '',
            x: data.launchInput.x || '',
            telegram: data.launchInput.telegram || '',
            antiSnipe: data.launchInput.antiSnipe || false,
            bundled: data.launchInput.bundled || false,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching launch data:', err);
    }
  };

  const saveLaunchPayload = async () => {
    setIsSavingLaunch(true);
    setLaunchError(null);

    try {
      const payload: Record<string, unknown> = {
        name: editingLaunch.name,
        symbol: editingLaunch.symbol,
        description: editingLaunch.description,
        antiSnipe: editingLaunch.antiSnipe,
        bundled: editingLaunch.bundled,
      };
      if (editingLaunch.website) payload.website = editingLaunch.website;
      if (editingLaunch.x) payload.x = editingLaunch.x;
      if (editingLaunch.telegram) payload.telegram = editingLaunch.telegram;

      const response = await fetch(`/api/run/${id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save launch payload');
      }

      setLaunchReadiness(data.readiness);
      setLaunchInput(data.launchInput);
      setLaunchRecord(data.launchRecord);
      setShowConfirmModal(false);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to save launch data');
    } finally {
      setIsSavingLaunch(false);
    }
  };

  const executeLaunch = async () => {
    setIsExecuting(true);
    setLaunchError(null);

    try {
      const response = await fetch(`/api/run/${id}/launch/execute`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare launch execution');
      }

      setExecutionPlan(data.plan);
      setLaunchRecord(data.launchRecord);

      // If deep-link mode, open in new tab
      if (data.plan.mode === 'deep_link' && data.plan.deepLinkUrl) {
        window.open(data.plan.deepLinkUrl, '_blank');
      }
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to execute launch');
    } finally {
      setIsExecuting(false);
    }
  };

  const confirmLaunchTx = async (txHash: string, status: 'submitted' | 'success' | 'failed' = 'submitted') => {
    try {
      const response = await fetch(`/api/run/${id}/launch/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm launch');
      }

      setLaunchRecord(data.launchRecord);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to confirm launch');
    }
  };

  if (error) {
    return (
      <main className="container">
        <div className="error-message">{error}</div>
        <Link href="/">Back to Home</Link>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="container">
        <p>Loading...</p>
      </main>
    );
  }

  if (!run.report) {
    return (
      <main className="container">
        <div className="error-message">
          Report not available yet. The simulation may still be running.
        </div>
        <Link href={`/run/${id}`}>View Run Status</Link>
      </main>
    );
  }

  const report = run.report;

  return (
    <main className="container">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href={`/run/${id}`} style={{ color: '#888', fontSize: '0.875rem' }}>
            &larr; Back to Run
          </Link>
          <button
            onClick={copyShareLink}
            className="btn"
            style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            {copied ? 'Copied!' : 'Copy Share Link'}
          </button>
        </div>
        <h1 style={{ marginTop: '0.5rem' }}>Simulation Report</h1>
        <p>{run.input.tagline}</p>
      </header>

      {report.warnings && report.warnings.length > 0 && (
        <div style={{
          background: '#422006',
          border: '1px solid #854d0e',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <strong style={{ color: '#fbbf24' }}>Warnings:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', color: '#fcd34d' }}>
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Run Configuration Summary */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        fontSize: '0.8rem',
        color: '#888',
      }}>
        {report.runMode && (
          <span style={{ background: '#1a1a1a', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #333' }}>
            Mode: <strong style={{ color: '#a78bfa' }}>{report.runMode}</strong>
          </span>
        )}
        {report.personaSet && (
          <span style={{ background: '#1a1a1a', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #333' }}>
            Persona Set: <strong style={{ color: '#a78bfa' }}>{report.personaSet}</strong>
          </span>
        )}
        {report.executedPersonaIds && (
          <span style={{ background: '#1a1a1a', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #333' }}>
            Personas: <strong style={{ color: '#a78bfa' }}>{report.executedPersonaIds.length}</strong>
          </span>
        )}
        {report.earlyStopReason && (
          <span style={{ background: '#422006', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #854d0e', color: '#fcd34d' }}>
            Early Stop
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '3rem', fontWeight: 700, color: report.overallScore >= 70 ? '#22c55e' : report.overallScore >= 50 ? '#eab308' : '#ef4444' }}>
            {report.overallScore}
          </h2>
          <p style={{ color: '#888', marginBottom: '1rem' }}>Overall Score</p>
          <div style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            background: report.tractionBand === 'very_high' || report.tractionBand === 'high' ? '#14532d' :
                        report.tractionBand === 'moderate' ? '#422006' : '#450a0a',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: report.tractionBand === 'very_high' || report.tractionBand === 'high' ? '#86efac' :
                   report.tractionBand === 'moderate' ? '#fcd34d' : '#fca5a5',
          }}>
            {report.tractionBand.replace('_', ' ').toUpperCase()} TRACTION
          </div>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
            ({report.confidence} confidence)
          </span>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#888' }}>Score Breakdown</h3>
          <ScoreBar score={report.scores.clarity} label="Clarity" />
          <ScoreBar score={report.scores.credibility} label="Credibility" />
          <ScoreBar score={report.scores.differentiation} label="Differentiation" />
          <ScoreBar score={report.scores.pricingFraming} label="Pricing Framing" />
          <ScoreBar score={report.scores.conversionReadiness} label="Conversion Readiness" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Predicted Metrics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0ea5e9' }}>
              {report.metrics.expectedUpvotes.toFixed(1)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Upvotes</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#22c55e' }}>
              {(report.metrics.expectedSignups * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Signups</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#a78bfa' }}>
              {(report.metrics.expectedPays * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Pays</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>
              {(report.metrics.bounceRate * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Bounce</div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#eab308' }}>
              {(report.metrics.shareRate * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>Share</div>
          </div>
        </div>

        {report.calibrationApplied && report.rawMetrics && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#1a1a2e', borderRadius: '0.5rem', border: '1px solid #2d2d44' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', background: '#4c1d95', padding: '0.125rem 0.5rem', borderRadius: '4px', color: '#c4b5fd' }}>
                CALIBRATED
              </span>
              <span style={{ fontSize: '0.75rem', color: '#888' }}>
                Adjusted based on previous actual outcomes
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div style={{ color: '#888' }}>
                Raw Signups: <span style={{ color: '#666' }}>{(report.rawMetrics.expectedSignups * 100).toFixed(1)}%</span>
              </div>
              <div style={{ color: '#888' }}>
                Raw Pays: <span style={{ color: '#666' }}>{(report.rawMetrics.expectedPays * 100).toFixed(1)}%</span>
              </div>
              <div style={{ color: '#888' }}>
                Raw Bounce: <span style={{ color: '#666' }}>{(report.rawMetrics.bounceRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: run?.actuals || showActuals ? '1rem' : 0 }}>
          <h3 style={{ fontSize: '1rem' }}>Actual Outcomes</h3>
          {!run?.actuals && (
            <button
              onClick={() => setShowActuals(!showActuals)}
              className="btn"
              style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {showActuals ? 'Cancel' : 'Enter Actual Results'}
            </button>
          )}
        </div>

        {run?.actuals && predictionErrors && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Signup Rate</div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#666' }}>
                      {(report.metrics.expectedSignups * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#666' }}>Predicted</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#22c55e' }}>
                      {(run.actuals.signupRate * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#666' }}>Actual</div>
                  </div>
                </div>
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: predictionErrors.signupError > 0 ? '#ef4444' : '#22c55e',
                }}>
                  Error: {predictionErrors.signupError > 0 ? '+' : ''}{(predictionErrors.signupError * 100).toFixed(1)}%
                </div>
              </div>

              <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Pay Rate</div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#666' }}>
                      {(report.metrics.expectedPays * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#666' }}>Predicted</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#a78bfa' }}>
                      {(run.actuals.payRate * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#666' }}>Actual</div>
                  </div>
                </div>
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: predictionErrors.payError > 0 ? '#ef4444' : '#22c55e',
                }}>
                  Error: {predictionErrors.payError > 0 ? '+' : ''}{(predictionErrors.payError * 100).toFixed(1)}%
                </div>
              </div>

              {run.actuals.bounceRate !== undefined && predictionErrors.bounceError !== undefined && (
                <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>Bounce Rate</div>
                  <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#666' }}>
                        {(report.metrics.bounceRate * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#666' }}>Predicted</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ef4444' }}>
                        {(run.actuals.bounceRate * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#666' }}>Actual</div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: predictionErrors.bounceError > 0 ? '#22c55e' : '#ef4444',
                  }}>
                    Error: {predictionErrors.bounceError > 0 ? '+' : ''}{(predictionErrors.bounceError * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            {run.actuals.notes && (
              <div style={{ fontSize: '0.875rem', color: '#888', fontStyle: 'italic' }}>
                Notes: {run.actuals.notes}
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
              Submitted: {new Date(run.actuals.submittedAt).toLocaleString()}
            </div>
          </div>
        )}

        {showActuals && !run?.actuals && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#888', marginBottom: '0.5rem' }}>
                  Signup Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={actualsInput.signupRate}
                  onChange={(e) => setActualsInput({ ...actualsInput, signupRate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                  placeholder="e.g., 5.2"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#888', marginBottom: '0.5rem' }}>
                  Pay Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={actualsInput.payRate}
                  onChange={(e) => setActualsInput({ ...actualsInput, payRate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                  placeholder="e.g., 1.5"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#888', marginBottom: '0.5rem' }}>
                  Bounce Rate (%) <span style={{ color: '#666' }}>optional</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={actualsInput.bounceRate}
                  onChange={(e) => setActualsInput({ ...actualsInput, bounceRate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                  placeholder="e.g., 45"
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#888', marginBottom: '0.5rem' }}>
                Notes <span style={{ color: '#666' }}>optional</span>
              </label>
              <textarea
                value={actualsInput.notes}
                onChange={(e) => setActualsInput({ ...actualsInput, notes: e.target.value })}
                maxLength={500}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  background: '#0a0a0a',
                  color: '#ededed',
                  resize: 'vertical',
                }}
                placeholder="Any context about the actual results..."
              />
            </div>

            <button
              onClick={saveActuals}
              disabled={isSavingActuals || !actualsInput.signupRate || !actualsInput.payRate}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {isSavingActuals ? 'Saving...' : 'Save Actual Outcomes'}
            </button>

            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', textAlign: 'center' }}>
              Enter your real conversion data to calibrate future predictions
            </p>
          </div>
        )}

        {!run?.actuals && !showActuals && (
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Help improve predictions by entering your actual launch results
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: run?.receipt ? '1rem' : 0 }}>
          <h3 style={{ fontSize: '1rem' }}>Simulation Receipt</h3>
          {!run?.receipt && (
            <button
              onClick={createReceipt}
              disabled={isCreatingReceipt}
              className="btn"
              style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {isCreatingReceipt ? 'Creating...' : 'Generate Receipt'}
            </button>
          )}
        </div>

        {receiptError && (
          <div style={{
            background: '#450a0a',
            border: '1px solid #dc2626',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: '#fca5a5',
          }}>
            {receiptError}
          </div>
        )}

        {run?.receipt ? (
          <div>
            <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Run Hash (SHA-256)</div>
                <code style={{
                  fontSize: '0.75rem',
                  color: '#a78bfa',
                  background: '#0a0a0a',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  display: 'block',
                  wordBreak: 'break-all',
                }}>
                  {run.receipt.runHash}
                </code>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Report Hash (SHA-256)</div>
                <code style={{
                  fontSize: '0.75rem',
                  color: '#22c55e',
                  background: '#0a0a0a',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  display: 'block',
                  wordBreak: 'break-all',
                }}>
                  {run.receipt.reportHash}
                </code>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                Created: {new Date(run.receipt.timestamp).toLocaleString()}
              </div>
            </div>

            {run.receipt.txHash ? (
              <div style={{
                background: '#14532d',
                border: '1px solid #22c55e',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.875rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#86efac', fontWeight: 500 }}>On-chain Receipt</span>
                  {run.receipt.chainId && (
                    <span style={{ fontSize: '0.75rem', color: '#86efac', background: '#0f3a1e', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>
                      Chain ID: {run.receipt.chainId}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#86efac', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#6ee7b7' }}>TX Hash:</span>
                </div>
                <code style={{
                  fontSize: '0.7rem',
                  color: '#86efac',
                  wordBreak: 'break-all',
                }}>
                  {run.receipt.txHash}
                </code>
                {run.receipt.blockNumber && (
                  <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '0.5rem' }}>
                    Block: {run.receipt.blockNumber}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: '#1a1a2e',
                border: '1px solid #2d2d44',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.875rem',
                color: '#a5a5ff',
              }}>
                Offline receipt (chain write disabled)
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Generate a tamper-evident receipt with SHA-256 hashes of your simulation
            {chainEnabled && ' (will be written to blockchain)'}
          </p>
        )}
      </div>

      {/* Launch on nad.fun Panel */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showLaunchPanel ? '1rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Launch on nad.fun</h3>
            {launchReadiness && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '4px',
                background: launchReadiness.status === 'ready' ? '#14532d' : '#450a0a',
                color: launchReadiness.status === 'ready' ? '#86efac' : '#fca5a5',
                border: `1px solid ${launchReadiness.status === 'ready' ? '#22c55e' : '#dc2626'}`,
              }}>
                {launchReadiness.status === 'ready' ? 'READY' : 'NOT READY'}
              </span>
            )}
            {launchRecord && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '4px',
                background: '#1a1a2e',
                color: '#a5a5ff',
                border: '1px solid #2d2d44',
              }}>
                {launchRecord.status.toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowLaunchPanel(!showLaunchPanel)}
            className="btn"
            style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            {showLaunchPanel ? 'Hide' : 'Prepare Launch'}
          </button>
        </div>

        {showLaunchPanel && (
          <div>
            {launchError && (
              <div style={{
                background: '#450a0a',
                border: '1px solid #dc2626',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: '#fca5a5',
              }}>
                {launchError}
              </div>
            )}

            {/* Readiness Blockers */}
            {launchReadiness && launchReadiness.blockers.length > 0 && (
              <div style={{
                background: launchReadiness.status === 'not_ready' ? '#1a0a0a' : '#1a1a0a',
                border: `1px solid ${launchReadiness.status === 'not_ready' ? '#333' : '#333'}`,
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ccc' }}>
                  Readiness Checks ({launchReadiness.blockers.length} issue{launchReadiness.blockers.length !== 1 ? 's' : ''})
                </div>
                {launchReadiness.blockers.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.8rem',
                  }}>
                    <span style={{
                      color: b.severity === 'critical' ? '#ef4444' : '#eab308',
                      fontWeight: 600,
                      minWidth: '70px',
                    }}>
                      {b.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                    </span>
                    <span style={{ color: '#aaa' }}>{b.message}</span>
                  </div>
                ))}
                {launchReadiness.recommendedActions.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #333' }}>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Recommended:</div>
                    {launchReadiness.recommendedActions.map((action, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
                        - {action}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Confidence */}
            {launchReadiness && (
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
                Readiness confidence: {(launchReadiness.confidence * 100).toFixed(0)}%
              </div>
            )}

            {/* Editable Launch Payload */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                  Token Name *
                </label>
                <input
                  type="text"
                  value={editingLaunch.name}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, name: e.target.value })}
                  maxLength={100}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                  Symbol *
                </label>
                <input
                  type="text"
                  value={editingLaunch.symbol}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, symbol: e.target.value.toUpperCase() })}
                  maxLength={10}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                Description *
              </label>
              <textarea
                value={editingLaunch.description}
                onChange={(e) => setEditingLaunch({ ...editingLaunch, description: e.target.value })}
                maxLength={1000}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #333',
                  borderRadius: '0.375rem',
                  background: '#0a0a0a',
                  color: '#ededed',
                  resize: 'vertical',
                }}
              />
              <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'right' }}>
                {editingLaunch.description.length}/1000
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                  Website
                </label>
                <input
                  type="url"
                  value={editingLaunch.website}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, website: e.target.value })}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                  X (Twitter)
                </label>
                <input
                  type="url"
                  value={editingLaunch.x}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, x: e.target.value })}
                  placeholder="https://x.com/..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                  Telegram
                </label>
                <input
                  type="url"
                  value={editingLaunch.telegram}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, telegram: e.target.value })}
                  placeholder="https://t.me/..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    background: '#0a0a0a',
                    color: '#ededed',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#ccc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editingLaunch.antiSnipe}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, antiSnipe: e.target.checked })}
                />
                Anti-Snipe Protection
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#ccc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editingLaunch.bundled}
                  onChange={(e) => setEditingLaunch({ ...editingLaunch, bundled: e.target.checked })}
                />
                Bundled Launch
              </label>
            </div>

            {/* Launch Actions */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  if (launchReadiness?.status === 'not_ready') {
                    setLaunchError('Cannot launch: readiness gate is NOT READY. Fix critical blockers first, or set LAUNCH_FORCE_OVERRIDE=true.');
                    return;
                  }
                  setShowConfirmModal(true);
                }}
                disabled={!editingLaunch.name || !editingLaunch.symbol || !editingLaunch.description || isSavingLaunch}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  opacity: launchReadiness?.status === 'not_ready' ? 0.5 : 1,
                }}
              >
                {launchRecord ? 'Update Launch Payload' : 'Save Launch Payload'}
              </button>
            </div>

            {launchReadiness?.status === 'not_ready' && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', textAlign: 'center' }}>
                Launch is blocked by critical readiness checks. Fix blockers above to proceed.
              </p>
            )}

            {launchRecord && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: '#1a1a2e',
                borderRadius: '0.5rem',
                border: '1px solid #2d2d44',
                fontSize: '0.8rem',
              }}>
                <div style={{ color: '#888' }}>
                  Launch Record: <span style={{
                    color: launchRecord.status === 'success' ? '#86efac' :
                           launchRecord.status === 'failed' ? '#fca5a5' :
                           launchRecord.status === 'submitted' ? '#fcd34d' : '#a5a5ff',
                  }}>{launchRecord.status.toUpperCase()}</span>
                </div>
                <div style={{ color: '#666', marginTop: '0.25rem' }}>
                  Idempotency Key: {launchRecord.idempotencyKey}
                </div>
                {launchRecord.txHash && (
                  <div style={{ color: '#666', marginTop: '0.25rem' }}>
                    TX Hash: <code style={{ color: '#a78bfa', fontSize: '0.75rem' }}>{launchRecord.txHash}</code>
                  </div>
                )}
                {launchRecord.tokenAddress && (
                  <div style={{ color: '#666', marginTop: '0.25rem' }}>
                    Token: <code style={{ color: '#22c55e', fontSize: '0.75rem' }}>{launchRecord.tokenAddress}</code>
                  </div>
                )}
                {launchRecord.error && (
                  <div style={{ color: '#fca5a5', marginTop: '0.25rem' }}>
                    Error: {launchRecord.error}
                  </div>
                )}
                <div style={{ color: '#666', marginTop: '0.25rem' }}>
                  Created: {new Date(launchRecord.createdAt).toLocaleString()}
                </div>
              </div>
            )}

            {/* Execute Launch */}
            {launchRecord && (launchRecord.status === 'draft' || launchRecord.status === 'confirmed') && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={executeLaunch}
                  disabled={isExecuting || launchReadiness?.status === 'not_ready'}
                  className="btn"
                  style={{
                    width: '100%',
                    background: '#4c1d95',
                    color: '#c4b5fd',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    opacity: launchReadiness?.status === 'not_ready' ? 0.5 : 1,
                  }}
                >
                  {isExecuting ? 'Preparing...' : 'Execute Launch on nad.fun'}
                </button>
              </div>
            )}

            {/* Execution Plan Result */}
            {executionPlan && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#0a1a0a',
                borderRadius: '0.5rem',
                border: '1px solid #1a3a1a',
              }}>
                <div style={{ fontSize: '0.8rem', color: '#86efac', marginBottom: '0.5rem' }}>
                  Execution Mode: <strong>{executionPlan.mode === 'deep_link' ? 'Deep Link' : 'Contract Call'}</strong>
                </div>
                {executionPlan.mode === 'deep_link' && executionPlan.deepLinkUrl && (
                  <div>
                    <a
                      href={executionPlan.deepLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0ea5e9', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Open nad.fun Create Page
                    </a>
                    <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                      Complete the launch on nad.fun, then paste your tx hash below.
                    </p>
                  </div>
                )}
                {executionPlan.mode === 'contract_call' && (
                  <p style={{ fontSize: '0.7rem', color: '#666' }}>
                    Sign the transaction with your connected wallet. Once confirmed, paste the tx hash below.
                  </p>
                )}

                {/* TX Hash Input */}
                {launchRecord?.status !== 'success' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
                      Transaction Hash
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        id="txHashInput"
                        placeholder="0x..."
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          fontSize: '0.8rem',
                          border: '1px solid #333',
                          borderRadius: '0.375rem',
                          background: '#0a0a0a',
                          color: '#ededed',
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('txHashInput') as HTMLInputElement;
                          if (input?.value) {
                            confirmLaunchTx(input.value, 'submitted');
                          }
                        }}
                        className="btn"
                        style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                      >
                        Confirm TX
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!showLaunchPanel && (
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Prepare and confirm your nad.fun token launch payload from simulation results
          </p>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#fbbf24' }}>
              Confirm Launch Payload
            </h3>
            <div style={{
              background: '#1a0a0a',
              border: '1px solid #854d0e',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#fcd34d',
            }}>
              This will save your launch payload. The actual token launch (on-chain transaction) will be handled in a separate step.
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                <strong>Name:</strong> {editingLaunch.name}
              </div>
              <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                <strong>Symbol:</strong> {editingLaunch.symbol}
              </div>
              <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                <strong>Description:</strong> {editingLaunch.description.slice(0, 100)}{editingLaunch.description.length > 100 ? '...' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="btn"
                style={{ flex: 1, background: '#333', color: '#ccc' }}
              >
                Cancel
              </button>
              <button
                onClick={saveLaunchPayload}
                disabled={isSavingLaunch}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {isSavingLaunch ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Top Friction Points</h3>
          {report.frictionList.slice(0, 5).map((f) => (
            <FrictionCard key={f.rank} friction={f} />
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Recommended Fixes</h3>
          {report.oneLineFixes.slice(0, 5).map((fix) => (
            <div key={fix.priority} style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{
                  background: '#0ea5e9',
                  color: 'white',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {fix.priority}
                </span>
                <div>
                  <div style={{ fontSize: '0.875rem' }}>{fix.fix}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                    Source: {fix.source}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showWhatIf ? '1rem' : 0 }}>
          <h3 style={{ fontSize: '1rem' }}>What-if Rerun</h3>
          <button
            onClick={() => setShowWhatIf(!showWhatIf)}
            className="btn"
            style={{ background: '#333', color: '#ccc', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            {showWhatIf ? 'Hide' : 'Try Different Tagline'}
          </button>
        </div>

        {showWhatIf && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#888', marginBottom: '0.5rem' }}>
                New Tagline
              </label>
              <input
                type="text"
                value={whatIfTagline}
                onChange={(e) => setWhatIfTagline(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  background: '#0a0a0a',
                  color: '#ededed',
                }}
                placeholder="Enter a different tagline..."
              />
              {whatIfTagline.trim() !== run?.input.tagline && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
                  <strong>Original:</strong> {run?.input.tagline}
                </div>
              )}
            </div>

            <button
              onClick={createVariant}
              disabled={isCreatingVariant || whatIfTagline.trim() === run?.input.tagline || !whatIfTagline.trim()}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {isCreatingVariant ? 'Creating Variant...' : 'Run With New Tagline'}
            </button>

            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', textAlign: 'center' }}>
              This will create a new simulation run with your modified tagline
            </p>
          </div>
        )}
      </div>

      {run?.variantOf && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#1a1a2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#a78bfa' }}>This is a variant of:</span>
            <Link href={`/run/${run.variantOf}/report`} style={{ color: '#0ea5e9' }}>
              View Original Report
            </Link>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Persona Analysis</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {report.personaReports.map((persona) => (
            <PersonaCard key={persona.personaId} persona={persona} />
          ))}
        </div>
      </div>
    </main>
  );
}
