'use client';

interface PanelSkeletonProps {
  rows?: number;
  label?: string;
}

export default function PanelSkeleton({ rows = 5, label }: PanelSkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <div className="panel-header panel-header-red" style={{ marginBottom: '0.5rem' }}>
          <span className="dot-red" />
          {label} — Acquiring Data...
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: `${30 + (i * 37) % 50}%`, height: '10px' }} />
          {i % 2 === 0 && <div className="skeleton" style={{ width: '60px', height: '10px' }} />}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '1px', background: 'var(--border-dim)', marginTop: '8px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ flex: 1, height: '32px' }} />
        ))}
      </div>
    </div>
  );
}
