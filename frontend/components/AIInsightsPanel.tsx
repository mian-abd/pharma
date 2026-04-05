'use client';

import { DrugBundle } from '../types/pharma';
import TrustGauge from './TrustGauge';
import { Activity, Cpu, Database } from 'lucide-react';

interface AIInsightsPanelProps {
  drug: DrugBundle;
}

const SOURCE_LABELS: Record<string, string> = {
  faers:          'FAERS / openFDA',
  clinical_trials:'ClinicalTrials.gov',
  formulary:      'CMS Part D',
  fda_signals:    'FDA Enforcement',
  ai_synthesis:   'Claude AI (Anthropic)',
};

export default function AIInsightsPanel({ drug }: AIInsightsPanelProps) {
  const breakdown = drug.trust_score_breakdown;
  const repBrief  = drug.rep_brief;

  return (
    <div className="panel-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Trust gauge */}
      <div style={{ borderBottom: '1px solid var(--border-mid)', paddingBottom: '0.65rem' }}>
        <div className="panel-header">
          <Activity size={9} style={{ color: 'var(--red)' }} />
          Evidence Risk Score
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TrustGauge score={drug.trust_score} breakdown={breakdown} size={120} />
        </div>
      </div>

      {/* AI summary */}
      {repBrief && (
        <div style={{ borderBottom: '1px solid var(--border-mid)', paddingBottom: '0.65rem' }}>
          <div className="panel-header">
            <Cpu size={9} style={{ color: 'var(--red)' }} />
            AI Assessment
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-mid)', lineHeight: 1.55 }}>
            {repBrief.reality[0] && (
              <p style={{ margin: '0 0 0.35rem' }}>
                <span style={{ color: 'var(--green-bright)' }}>▸ </span>{repBrief.reality[0]}
              </p>
            )}
            {repBrief.absolute_vs_relative_note && (
              <p style={{ margin: '0 0 0.35rem' }}>
                <span style={{ color: 'var(--amber)' }}>▸ </span>{repBrief.absolute_vs_relative_note}
              </p>
            )}
            {repBrief.study_limitations && (
              <p style={{ margin: 0, color: 'var(--text-lo)' }}>
                <span style={{ color: 'var(--red)' }}>▸ </span>
                {repBrief.study_limitations.slice(0, 120)}…
              </p>
            )}
          </div>
          {repBrief.generation_latency_ms && (
            <div style={{ fontSize: '0.56rem', color: 'var(--text-lo)', marginTop: '0.35rem' }}>
              Generated in {repBrief.generation_latency_ms}ms
            </div>
          )}
        </div>
      )}

      {/* Data sources */}
      <div>
        <div className="panel-header">
          <Database size={9} /> Data Sources
        </div>
        {Object.entries(SOURCE_LABELS).map(([key, label]) => {
          const status = drug.source_statuses[key] || 'unavailable';
          return (
            <div key={key} className="data-row">
              <span style={{ fontSize: '0.62rem', color: 'var(--text-lo)' }}>{label}</span>
              <span style={{
                fontSize: '0.56rem', fontWeight: 700,
                color: status === 'live' ? 'var(--green-bright)' : status === 'degraded' ? 'var(--amber)' : 'var(--text-lo)',
              }}>
                {status === 'live' ? '● ' : '○ '}{status.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
