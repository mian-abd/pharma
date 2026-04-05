'use client';

import { TrialsSummary } from '../types/pharma';

interface TrialsSummaryBarProps {
  summary: TrialsSummary;
}

export default function TrialsSummaryBar({ summary }: TrialsSummaryBarProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6,1fr)',
      gap: '1px',
      background: 'var(--border-dim)',
      marginBottom: '0.65rem',
    }}>
      {[
        { label: 'Total',     value: String(summary.total),                      color: 'var(--text-hi)' },
        { label: 'Active',    value: String(summary.active),                     color: 'var(--green-bright)' },
        { label: 'Completed', value: String(summary.completed),                  color: 'var(--blue-bright)' },
        { label: 'Phase 3',   value: String(summary.phase3_completed),           color: 'var(--amber)' },
        { label: 'Industry %',value: `${summary.industry_pct.toFixed(0)}%`,      color: 'var(--amber)' },
        { label: 'w/ Results',value: `${summary.has_results_pct.toFixed(0)}%`,   color: 'var(--text-mid)' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'var(--bg-panel)',
          padding: '0.35rem 0.3rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '0.95rem', fontWeight: 700,
            color, fontFamily: 'var(--font-mono)', lineHeight: 1,
          }}>
            {value}
          </div>
          <div className="metric-lbl">{label}</div>
        </div>
      ))}
    </div>
  );
}
