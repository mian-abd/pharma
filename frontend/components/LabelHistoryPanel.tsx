'use client';

import { LabelHistoryItem, ShortageStatus } from '../types/pharma';
import { AlertTriangle, Package, Clock } from 'lucide-react';

interface LabelHistoryPanelProps {
  history: LabelHistoryItem[];
  shortage: ShortageStatus | null;
}

const LABEL_COLORS: Record<string, string> = {
  Safety:         'var(--red)',
  Efficacy:       'var(--blue-bright)',
  Dosing:         'var(--amber)',
  Contraindication: 'var(--red-bright)',
  Other:          'var(--text-lo)',
};

export default function LabelHistoryPanel({ history, shortage }: LabelHistoryPanelProps) {
  return (
    <div className="panel-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

      {/* Shortage banner */}
      {shortage?.status === 'active' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0.5rem 0.65rem',
          background: 'var(--red-glow)', border: '1px solid var(--border-red)',
          animation: 'glow-pulse-red 2.5s ease-in-out infinite',
        }}>
          <Package size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--red-bright)', letterSpacing: '0.06em' }}>
              ACTIVE DRUG SHORTAGE
            </div>
            {shortage.reason && (
              <div style={{ fontSize: '0.62rem', color: 'var(--text-mid)', marginTop: '2px' }}>{shortage.reason}</div>
            )}
            {shortage.resolution_date && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text-lo)', marginTop: '1px' }}>
                Est. resolution: {shortage.resolution_date}
              </div>
            )}
          </div>
        </div>
      )}

      {shortage?.status === 'none' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0.35rem 0.5rem',
          background: 'var(--green-glow)', border: '1px solid var(--green)',
          fontSize: '0.65rem', color: 'var(--green-bright)',
        }}>
          <span className="dot-green" />No current shortage detected
        </div>
      )}

      {/* Label history timeline */}
      <div>
        <div className="panel-header panel-header-red">
          <Clock size={9} /> Label Update History (DailyMed)
        </div>

        {history.length === 0 ? (
          <div style={{ fontSize: '0.66rem', color: 'var(--text-lo)', padding: '0.75rem 0', textAlign: 'center' }}>
            No label history available
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '16px' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute', left: '5px', top: 0, bottom: 0,
              width: '1px', background: 'var(--border-mid)',
            }} />

            {history.map((item, i) => {
              const isFirst = i === 0;
              const changeType = item.change_type || 'Other';
              const color = LABEL_COLORS[changeType] || 'var(--text-lo)';
              return (
                <div key={`${item.version}-${i}`} style={{
                  position: 'relative', paddingBottom: '0.55rem',
                }}>
                  {/* Dot on timeline */}
                  <div style={{
                    position: 'absolute', left: '-13px', top: '4px',
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: color,
                    boxShadow: isFirst ? `0 0 8px ${color}` : 'none',
                  }} />

                  {/* Content */}
                  <div style={{
                    padding: '0.35rem 0.45rem',
                    background: isFirst ? 'rgba(220,38,38,0.04)' : 'transparent',
                    border: isFirst ? '1px solid var(--border-red)' : '1px solid transparent',
                    borderBottom: '1px solid var(--border-dim)',
                  }}>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.58rem', color: 'var(--text-lo)' }}>
                        {item.published_date || 'Date N/A'}
                      </span>
                      <span style={{
                        fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.08em',
                        color, padding: '0 4px',
                        border: `1px solid ${color}`,
                        background: `${color}12`,
                      }}>
                        {changeType}
                      </span>
                      <span style={{ fontSize: '0.56rem', color: 'var(--text-lo)' }}>v{item.version}</span>
                    </div>
                    <div style={{ fontSize: '0.64rem', color: isFirst ? '#94a3b8' : '#4b5563', lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.55rem', color: 'var(--text-lo)', marginTop: 'auto', paddingTop: '0.25rem' }}>
        Source: DailyMed (NLM) · FDA shortage data
      </div>
    </div>
  );
}
