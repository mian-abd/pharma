'use client';

import { DrugBundle } from '../types/pharma';
import TrustGauge from './TrustGauge';
import { Activity, Cpu, Database } from 'lucide-react';

interface AIInsightsPanelProps {
  drug: DrugBundle;
}

const SOURCE_LABELS: Record<string, string> = {
  faers: 'FAERS / openFDA',
  clinical_trials: 'ClinicalTrials.gov',
  formulary: 'CMS Part D',
  fda_signals: 'FDA Enforcement',
  ai_synthesis: 'Claude AI (Anthropic)',
};

function StatusDot({ status }: { status: string }) {
  const color = status === 'live' ? 'var(--accent-green)' : status === 'degraded' ? 'var(--accent-amber)' : 'var(--accent-red)';
  const isLive = status === 'live';
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        animation: isLive ? 'pulse-green 2s infinite' : 'none',
        flexShrink: 0,
      }}
    />
  );
}

export default function AIInsightsPanel({ drug }: AIInsightsPanelProps) {
  const breakdown = drug.trust_score_breakdown;
  const repBrief = drug.rep_brief;

  return (
    <div
      className="panel-animate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: '100%',
      }}
    >
      {/* Trust gauge with full breakdown */}
      <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem' }}>
        <div className="panel-header">
          <Activity size={10} style={{ display: 'inline', marginRight: '4px' }} />
          Evidence Score
        </div>
        <div className="flex justify-center">
          <TrustGauge score={drug.trust_score} breakdown={breakdown} size={130} />
        </div>
      </div>

      {/* AI 3-sentence brief */}
      {repBrief && (
        <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem' }}>
          <div className="panel-header">
            <Cpu size={10} style={{ display: 'inline', marginRight: '4px' }} />
            AI Assessment
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {repBrief.reality[0] && (
              <p style={{ margin: '0 0 0.35rem' }}>
                <span style={{ color: 'var(--accent-green)' }}>▸ </span>
                {repBrief.reality[0]}
              </p>
            )}
            {repBrief.absolute_vs_relative_note && (
              <p style={{ margin: '0 0 0.35rem' }}>
                <span style={{ color: 'var(--accent-amber)' }}>▸ </span>
                {repBrief.absolute_vs_relative_note}
              </p>
            )}
            {repBrief.study_limitations && (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-red)' }}>▸ </span>
                {repBrief.study_limitations.slice(0, 120)}{repBrief.study_limitations.length > 120 ? '…' : ''}
              </p>
            )}
          </div>
          {repBrief.generation_latency_ms && (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Generated in {repBrief.generation_latency_ms}ms
            </div>
          )}
        </div>
      )}

      {/* Data sources */}
      <div style={{ marginTop: 'auto' }}>
        <div className="panel-header">
          <Database size={10} style={{ display: 'inline', marginRight: '4px' }} />
          Data Sources
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => {
            const status = drug.source_statuses[key] || 'unavailable';
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.68rem',
                }}
              >
                <StatusDot status={status} />
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{label}</span>
                <span
                  style={{
                    color: status === 'live' ? 'var(--accent-green)' : status === 'degraded' ? 'var(--accent-amber)' : 'var(--text-muted)',
                    fontSize: '0.6rem',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
