'use client';

import { FormularyData } from '../types/pharma';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface FormularyPanelProps {
  data: FormularyData[];
}

const PAYER_LABELS: Record<string, string> = {
  medicare_d: 'Medicare Part D',
  medicaid: 'Medicaid',
  commercial: 'Commercial Ins.',
  uninsured: 'Uninsured / OOP',
};

const PAYER_ORDER = ['medicare_d', 'medicaid', 'commercial', 'uninsured'];

function tierColor(tier: string): string {
  const t = parseInt(tier, 10);
  if (t <= 1) return 'var(--accent-green)';
  if (t <= 2) return '#44ff88';
  if (t <= 3) return 'var(--accent-amber)';
  if (t <= 4) return '#ff8844';
  return 'var(--accent-red)';
}

function tierBadge(tier: string) {
  const color = tierColor(tier);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.7rem',
        fontWeight: 700,
        background: `${color}12`,
        borderRadius: '2px',
      }}
    >
      TIER {tier}
    </span>
  );
}

export default function FormularyPanel({ data }: FormularyPanelProps) {
  const byPayer = PAYER_ORDER.reduce<Record<string, FormularyData>>((acc, cat) => {
    const item = data.find(d => d.payer_category === cat);
    if (item) acc[cat] = item;
    return acc;
  }, {});

  return (
    <div className="panel-animate">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-accent)' }}>
            {['Payer', 'Tier', 'Est. Cost / Month', 'PA Req.', 'Step Tx'].map(h => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '0.35rem 0.5rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.6rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAYER_ORDER.map((cat, i) => {
            const item = byPayer[cat];
            if (!item) return (
              <tr key={cat} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-secondary)' }}>
                  {PAYER_LABELS[cat]}
                </td>
                <td colSpan={4} style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No data
                </td>
              </tr>
            );

            const copayStr = item.estimated_copay_low !== null && item.estimated_copay_high !== null
              ? `$${item.estimated_copay_low}–$${item.estimated_copay_high}`
              : 'N/A';

            return (
              <tr
                key={cat}
                style={{
                  borderBottom: '1px solid var(--border-primary)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              >
                <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {PAYER_LABELS[cat]}
                </td>
                <td style={{ padding: '0.45rem 0.5rem' }}>
                  {tierBadge(item.tier)}
                </td>
                <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-primary)' }}>
                  {copayStr}
                </td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                  <span title={item.prior_auth_required ? "Prior auth required" : "No PA required"}>
                    {item.prior_auth_required
                      ? <ShieldAlert size={14} style={{ color: 'var(--accent-amber)' }} />
                      : <ShieldCheck size={14} style={{ color: 'var(--accent-green)' }} />
                    }
                  </span>
                </td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                  {item.step_therapy_required
                    ? <span style={{ color: 'var(--accent-amber)', fontSize: '0.65rem', fontWeight: 700 }}>YES</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>NO</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
        Source: CMS Part D {data[0]?.cms_data_quarter || '2024Q4'} · Copays are estimated averages
      </div>
    </div>
  );
}
