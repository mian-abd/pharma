'use client';

import { FDASignalData } from '../types/pharma';
import { AlertTriangle, Package, CheckCircle, BookOpen } from 'lucide-react';

interface FDASignalFeedProps {
  signals: FDASignalData[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; Icon: React.ComponentType<any> }> = {
  SAFETY: { label: 'SAFETY', color: 'var(--accent-red)', Icon: AlertTriangle },
  SHORTAGE: { label: 'SHORTAGE', color: 'var(--accent-amber)', Icon: Package },
  APPROVAL: { label: 'APPROVAL', color: 'var(--accent-green)', Icon: CheckCircle },
  STUDY: { label: 'STUDY', color: 'var(--accent-blue)', Icon: BookOpen },
};

export default function FDASignalFeed({ signals }: FDASignalFeedProps) {
  if (signals.length === 0) {
    return (
      <div
        className="panel-animate"
        style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '1rem 0', textAlign: 'center' }}
      >
        No recent FDA signals found
      </div>
    );
  }

  return (
    <div className="panel-animate" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {signals.map((signal, i) => {
        const config = TYPE_CONFIG[signal.signal_type] || TYPE_CONFIG.SAFETY;
        const Icon = config.Icon;
        const isFirst = i === 0;

        return (
          <div
            key={`${signal.signal_date}-${i}`}
            style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border-primary)',
              position: 'relative',
            }}
          >
            {/* Pulsing dot for most recent */}
            {isFirst && (
              <div
                style={{
                  position: 'absolute',
                  left: '-8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <span className="live-dot" />
              </div>
            )}

            {/* Date */}
            <div
              style={{
                flexShrink: 0,
                width: '56px',
                fontSize: '0.6rem',
                color: 'var(--text-muted)',
                paddingTop: '2px',
                fontWeight: isFirst ? 600 : 400,
              }}
            >
              {signal.signal_date?.slice(0, 10) || 'N/A'}
            </div>

            {/* Type badge */}
            <div style={{ flexShrink: 0 }}>
              <span
                className="badge"
                style={{
                  color: config.color,
                  borderColor: config.color,
                  background: `${config.color}10`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Icon size={8} />
                {config.label}
              </span>
              {signal.is_black_box && (
                <span
                  className="badge badge-red"
                  style={{ marginLeft: '4px', fontWeight: 700 }}
                >
                  BBW
                </span>
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.73rem',
                  color: isFirst ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isFirst ? 500 : 400,
                  lineHeight: 1.3,
                  marginBottom: '2px',
                }}
              >
                {signal.title}
              </div>
              {signal.description && signal.description !== signal.title && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  {signal.description.slice(0, 120)}
                  {signal.description.length > 120 ? '…' : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
