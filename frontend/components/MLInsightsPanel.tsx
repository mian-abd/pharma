'use client';

import { MLInsightsPanel as MLInsightsPanelType } from '../types/pharma';
import { Zap, FlaskConical, Link2, AlertTriangle } from 'lucide-react';

interface MLInsightsPanelProps {
  data: MLInsightsPanelType;
}

function ProbabilityBar({ prob, confidence }: { prob: number; confidence: string }) {
  const color = prob >= 0.65
    ? 'var(--accent-green)'
    : prob >= 0.45
    ? 'var(--accent-amber)'
    : 'var(--accent-red)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
      <div style={{
        flex: 1,
        height: '5px',
        background: 'var(--border-primary)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${prob * 100}%`,
          height: '100%',
          background: color,
          borderRadius: '2px',
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{
        fontWeight: 700,
        fontSize: '0.75rem',
        color,
        width: '36px',
        textAlign: 'right',
        fontFamily: 'var(--font-mono)',
      }}>
        {Math.round(prob * 100)}%
      </span>
      <span style={{
        fontSize: '0.58rem',
        color: 'var(--text-muted)',
        width: '36px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {confidence}
      </span>
    </div>
  );
}

export default function MLInsightsPanel({ data }: MLInsightsPanelProps) {
  if (!data.feature_flag_enabled) {
    return (
      <div style={{
        padding: '1.5rem 0.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <Zap size={18} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          ML insights are disabled.
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
          Set <code style={{ color: 'var(--accent-amber)' }}>FEATURE_ML_INSIGHTS=true</code> to enable.
        </div>
      </div>
    );
  }

  return (
    <div className="panel-animate" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '0.4rem 0.5rem',
        background: 'rgba(153, 102, 255, 0.06)',
        border: '1px solid rgba(153, 102, 255, 0.2)',
        fontSize: '0.68rem', color: 'var(--accent-purple)',
      }}>
        <Zap size={11} />
        <strong>ML INSIGHTS</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', marginLeft: '4px' }}>
          heuristic model • not clinical prediction
        </span>
      </div>

      {/* Trial predictions */}
      {data.trial_predictions.length > 0 && (
        <div>
          <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FlaskConical size={10} />
            Trial Success Probabilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.trial_predictions.slice(0, 6).map((pred) => (
              <div key={pred.trial_nct_id}>
                <div style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '3px',
                  lineHeight: 1.3,
                }}>
                  <a
                    href={`https://clinicaltrials.gov/study/${pred.trial_nct_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                  >
                    {pred.trial_nct_id} <Link2 size={8} />
                  </a>
                  {' '}{pred.trial_title}
                </div>
                <ProbabilityBar prob={pred.success_probability} confidence={pred.confidence} />
                {pred.key_factors.length > 0 && (
                  <div style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    paddingLeft: '4px',
                    borderLeft: '2px solid var(--border-accent)',
                  }}>
                    {pred.key_factors[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar drugs */}
      {data.similar_drugs.length > 0 && (
        <div>
          <div className="panel-header">Class Comparators</div>
          {data.similar_drugs.map(drug => (
            <div key={drug.rxcui} style={{
              padding: '0.3rem 0',
              borderBottom: '1px solid var(--border-primary)',
              fontSize: '0.68rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{drug.brand_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>{drug.generic_name}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem', marginTop: '1px' }}>
                {drug.similarity_reason}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.trial_predictions.length === 0 && data.similar_drugs.length === 0 && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
          No trial data available for ML analysis
        </div>
      )}

      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', paddingTop: '0.25rem', borderTop: '1px solid var(--border-primary)' }}>
        Probabilities based on Wong et al. (2019) phase success rates + trial metadata heuristics.
        Not a clinical or regulatory prediction.
      </div>
    </div>
  );
}
