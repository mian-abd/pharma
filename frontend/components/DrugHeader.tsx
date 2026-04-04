'use client';

import { DrugBundle } from '../types/pharma';
import TrustGauge from './TrustGauge';
import { AlertTriangle } from 'lucide-react';

interface DrugHeaderProps {
  drug: DrugBundle;
}

function MetricBlock({ label, value, unit = '', dim = false }: {
  label: string;
  value: string | number | null;
  unit?: string;
  dim?: boolean;
}) {
  return (
    <div className="flex flex-col items-start px-3" style={{ borderRight: '1px solid var(--border-primary)' }}>
      <span className="metric-label">{label}</span>
      <span
        className="font-semibold"
        style={{
          fontSize: '1.1rem',
          color: value !== null ? (dim ? 'var(--text-secondary)' : 'var(--accent-green)') : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.2,
          marginTop: '2px',
        }}
      >
        {value !== null ? `${value}${unit}` : 'N/A'}
      </span>
    </div>
  );
}

export default function DrugHeader({ drug }: DrugHeaderProps) {
  const hasSignal = drug.faers?.signal_flag ?? false;

  return (
    <div
      className="sticky top-0 z-40 panel-animate"
      style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '0.5rem 1rem',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Drug name + class */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: 'var(--accent-green)',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1,
              }}
            >
              {drug.brand_name || drug.drug_name}
            </h1>
            {hasSignal && (
              <span title="FAERS safety signal detected">
                <AlertTriangle size={14} style={{ color: 'var(--accent-amber)' }} />
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {drug.generic_name}
            {drug.drug_class && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                · {drug.drug_class}
              </span>
            )}
            {drug.manufacturer && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                · {drug.manufacturer}
              </span>
            )}
          </div>
        </div>

        {/* Metric strip */}
        <div className="flex items-center gap-0">
          <MetricBlock
            label="NNT (Trial)"
            value={drug.nnt_trial !== null ? `1:${Math.round(drug.nnt_trial)}` : null}
          />
          <MetricBlock
            label="NNT (Real-World)"
            value={drug.nnt_realworld !== null ? `1:${Math.round(drug.nnt_realworld)}` : null}
            dim
          />
          <MetricBlock
            label="ARR"
            value={drug.arr_trial !== null ? drug.arr_trial.toFixed(1) : null}
            unit="%"
          />
          <MetricBlock
            label="RRR"
            value={drug.rrr_trial !== null ? drug.rrr_trial.toFixed(0) : null}
            unit="%"
            dim
          />
          <MetricBlock
            label="Patent"
            value={drug.patent_expiry || null}
          />
        </div>

        {/* Trust gauge */}
        <div className="flex-shrink-0 pl-3" style={{ borderLeft: '1px solid var(--border-primary)' }}>
          <TrustGauge score={drug.trust_score} size={90} />
        </div>
      </div>
    </div>
  );
}
