'use client';

import { FormularyData } from '../types/pharma';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface FormularyPanelProps {
  data: FormularyData[];
}

const PAYER_LABELS: Record<string, string> = {
  medicare_d: 'Medicare Part D',
  medicaid:   'Medicaid',
  commercial: 'Commercial Ins.',
  uninsured:  'Uninsured / OOP',
};

const PAYER_ORDER = ['medicare_d', 'medicaid', 'commercial', 'uninsured'];

function tierColor(tier: string): string {
  const t = parseInt(tier, 10);
  if (t <= 1) return '#059669';
  if (t <= 2) return '#059669';
  if (t <= 3) return '#D97706';
  if (t <= 4) return '#D97706';
  return '#B91C1C';
}

export default function FormularyPanel({ data }: FormularyPanelProps) {
  const byPayer = PAYER_ORDER.reduce<Record<string, FormularyData>>((acc, cat) => {
    const item = data.find(d => d.payer_category === cat);
    if (item) acc[cat] = item;
    return acc;
  }, {});

  return (
    <div className="panel-in">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.66rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-red)' }}>
            {['Payer', 'Tier', 'Est. Cost/Mo', 'PA', 'Step Tx'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '0.3rem 0.4rem',
                color: 'var(--text-lo)', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                fontSize: '0.56rem', whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAYER_ORDER.map((cat, i) => {
            const item = byPayer[cat];
            if (!item) return (
              <tr key={cat} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <td style={{ padding: '0.35rem 0.4rem', color: 'var(--text-mid)' }}>{PAYER_LABELS[cat]}</td>
                <td colSpan={4} style={{ padding: '0.35rem 0.4rem', color: 'var(--text-lo)', fontStyle: 'italic' }}>No data</td>
              </tr>
            );

            const copayStr = item.estimated_copay_low != null && item.estimated_copay_high != null
              ? `$${item.estimated_copay_low}–$${item.estimated_copay_high}`
              : 'N/A';
            const tc = tierColor(item.tier);

            return (
              <tr key={cat} style={{
                borderBottom: '1px solid var(--border-dim)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
              }}>
                <td style={{ padding: '0.35rem 0.4rem', color: 'var(--text-mid)', fontWeight: 500 }}>
                  {PAYER_LABELS[cat]}
                </td>
                <td style={{ padding: '0.35rem 0.4rem' }}>
                  <span style={{
                    display: 'inline-block', padding: '1px 5px',
                    border: `1px solid ${tc}`, color: tc,
                    fontSize: '0.6rem', fontWeight: 700,
                    background: `${tc}12`,
                  }}>
                    T{item.tier}
                  </span>
                </td>
                <td style={{ padding: '0.35rem 0.4rem', color: 'var(--text-hi)' }}>{copayStr}</td>
                <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center' }}>
                  {item.prior_auth_required
                    ? <ShieldAlert size={12} style={{ color: 'var(--amber)' }} />
                    : <ShieldCheck size={12} style={{ color: 'var(--green)' }} />
                  }
                </td>
                <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center' }}>
                  {item.step_therapy_required
                    ? <span style={{ color: 'var(--amber)', fontSize: '0.58rem', fontWeight: 700 }}>YES</span>
                    : <span style={{ color: 'var(--text-lo)', fontSize: '0.58rem' }}>NO</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: '0.4rem', fontSize: '0.56rem', color: 'var(--text-lo)' }}>
        Source: CMS Part D {data[0]?.cms_data_quarter || '2024Q4'} · Copays are estimated averages
      </div>
    </div>
  );
}
