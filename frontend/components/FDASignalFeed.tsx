'use client';

import { FDASignalData } from '../types/pharma';
import { AlertTriangle, Package, CheckCircle, BookOpen } from 'lucide-react';

interface FDASignalFeedProps {
  signals: FDASignalData[];
}

const TYPE_CFG: Record<string, { label: string; color: string; Icon: any }> = {
  SAFETY:   { label: 'SAFETY',   color: 'var(--red)',    Icon: AlertTriangle },
  SHORTAGE: { label: 'SHORTAGE', color: 'var(--amber)',  Icon: Package },
  APPROVAL: { label: 'APPROVAL', color: 'var(--green)',  Icon: CheckCircle },
  STUDY:    { label: 'STUDY',    color: 'var(--blue-bright)', Icon: BookOpen },
};

export default function FDASignalFeed({ signals }: FDASignalFeedProps) {
  if (signals.length === 0) {
    return (
      <div className="panel-in" style={{ color: 'var(--text-lo)', fontSize: '0.68rem', padding: '1.5rem', textAlign: 'center' }}>
        No recent FDA signals found
      </div>
    );
  }

  return (
    <div className="panel-in" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px',
        background: 'var(--border-dim)', marginBottom: '0.75rem',
      }}>
        {[
          { label: 'Total Signals', value: String(signals.length), color: 'var(--red-bright)' },
          { label: 'Safety Alerts', value: String(signals.filter(s => s.signal_type === 'SAFETY').length), color: 'var(--red)' },
          { label: 'BBW Present',   value: signals.some(s => s.is_black_box) ? 'YES' : 'NO', color: signals.some(s => s.is_black_box) ? 'var(--red-bright)' : 'var(--text-lo)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-panel)', padding: '0.35rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
            <div className="metric-lbl">{label}</div>
          </div>
        ))}
      </div>

      {signals.map((signal, i) => {
        const cfg = TYPE_CFG[signal.signal_type] || TYPE_CFG.SAFETY;
        const Icon = cfg.Icon;
        const isFirst = i === 0;

        return (
          <div key={`${signal.signal_date}-${i}`} className="signal-row">
            {isFirst && <span className="dot-red" style={{ flexShrink: 0 }} />}
            {!isFirst && <span style={{ width: '5px', flexShrink: 0 }} />}

            <span style={{
              flexShrink: 0, width: '58px',
              fontSize: '0.58rem', color: 'var(--text-lo)',
            }}>
              {signal.signal_date?.slice(0, 10) || '—'}
            </span>

            <span className={`badge ${cfg.label === 'SAFETY' ? 'badge-red' : cfg.label === 'SHORTAGE' ? 'badge-amber' : cfg.label === 'APPROVAL' ? 'badge-green' : 'badge-blue'}`}
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Icon size={8} />{cfg.label}
            </span>

            {signal.is_black_box && (
              <span className="badge badge-red" style={{ flexShrink: 0, fontWeight: 700 }}>BBW</span>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.66rem',
                color: isFirst ? 'var(--red-bright)' : '#94a3b8',
                fontWeight: isFirst ? 500 : 400,
                lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {signal.title}
              </div>
              {signal.description && signal.description !== signal.title && (
                <div style={{ fontSize: '0.58rem', color: 'var(--text-lo)', lineHeight: 1.3, marginTop: '1px' }}>
                  {signal.description.slice(0, 110)}{signal.description.length > 110 ? '…' : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
