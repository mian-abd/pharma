'use client';

import { DrugBundle } from '../types/pharma';
import TrustGauge from './TrustGauge';
import { AlertTriangle, Package } from 'lucide-react';

interface DrugHeaderProps {
  drug: DrugBundle;
}

function MetricCell({ label, value, color = 'var(--text-hi)', unit = '' }: {
  label: string; value: string | number | null; color?: string; unit?: string;
}) {
  return (
    <div style={{
      padding: '0.25rem 0.65rem',
      borderRight: '1px solid var(--border-mid)',
      display: 'flex', flexDirection: 'column',
    }}>
      <span className="metric-lbl">{label}</span>
      <span style={{
        fontSize: '0.92rem',
        fontWeight: 600,
        color: value !== null ? color : 'var(--text-lo)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.1,
        marginTop: '1px',
      }}>
        {value !== null ? `${value}${unit}` : 'N/A'}
      </span>
    </div>
  );
}

export default function DrugHeader({ drug }: DrugHeaderProps) {
  const hasSignal = drug.faers?.signal_flag ?? false;

  return (
    <div style={{
      background: 'var(--bg-void)',
      borderBottom: '1px solid var(--border-mid)',
      padding: '0.3rem 0.75rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      flexShrink: 0, minHeight: '46px',
    }}>
      {/* Drug name + class */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h1 style={{
            fontSize: '1.1rem', fontWeight: 700,
            color: hasSignal ? 'var(--red-bright)' : '#f1f5f9',
            fontFamily: 'var(--font-mono)', lineHeight: 1,
            textShadow: hasSignal ? '0 0 10px var(--red-glow)' : 'none',
          }}>
            {drug.brand_name || drug.drug_name}
          </h1>
          {hasSignal && (
            <AlertTriangle size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
          )}
          {drug.fda_signals?.some(s => s.signal_type === 'SHORTAGE') && (
            <span className="badge badge-amber">
              <Package size={8} /> SHORTAGE
            </span>
          )}
          {drug.fda_signals?.some(s => s.is_black_box) && (
            <span className="badge badge-red">BBW</span>
          )}
        </div>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-lo)', marginTop: '1px' }}>
          {drug.generic_name}
          {drug.drug_class && <span style={{ color: 'var(--text-lo)', marginLeft: '8px' }}>· {drug.drug_class}</span>}
          {drug.manufacturer && <span style={{ color: 'var(--text-lo)', marginLeft: '8px' }}>· {drug.manufacturer}</span>}
        </div>
      </div>

      {/* Metric strip */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginLeft: '0.25rem', borderLeft: '1px solid var(--border-mid)' }}>
        <MetricCell
          label="NNT (Trial)"
          value={drug.nnt_trial !== null ? `1:${Math.round(drug.nnt_trial!)}` : null}
          color="var(--red-bright)"
        />
        <MetricCell
          label="NNT (RW)"
          value={drug.nnt_realworld !== null ? `1:${Math.round(drug.nnt_realworld!)}` : null}
          color="var(--text-mid)"
        />
        <MetricCell
          label="ARR"
          value={drug.arr_trial !== null ? drug.arr_trial!.toFixed(1) : null}
          unit="%"
          color="var(--amber)"
        />
        <MetricCell
          label="RRR"
          value={drug.rrr_trial !== null ? drug.rrr_trial!.toFixed(0) : null}
          unit="%"
          color="var(--text-mid)"
        />
        <MetricCell
          label="Patent"
          value={drug.patent_expiry || null}
          color="var(--text-mid)"
        />
      </div>

      {/* Trust gauge */}
      <div style={{ flexShrink: 0, paddingLeft: '0.5rem', borderLeft: '1px solid var(--border-mid)' }}>
        <TrustGauge score={drug.trust_score} breakdown={drug.trust_score_breakdown} size={82} />
      </div>
    </div>
  );
}
