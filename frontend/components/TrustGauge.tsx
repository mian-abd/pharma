'use client';

interface TrustGaugeProps {
  score: number;
  breakdown?: Record<string, number> | {
    evidence_quality: number;
    safety_signal: number;
    trial_real_gap: number;
    formulary_access: number;
  };
  size?: number;
}

function scoreColor(score: number): string {
  if (score < 30) return '#B91C1C';
  if (score < 55) return '#D97706';
  if (score < 75) return '#059669';
  return '#065F46';
}

function scoreLabel(score: number): string {
  if (score < 30) return 'CRITICAL';
  if (score < 55) return 'ELEVATED';
  if (score < 75) return 'MODERATE';
  return 'CLEAR';
}

export default function TrustGauge({ score, breakdown, size = 90 }: TrustGaugeProps) {
  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = scoreColor(clampedScore);
  const label = scoreLabel(clampedScore);

  const startAngle = -180;
  const fillAngle  = startAngle + (clampedScore / 100) * 180;

  function polarToXY(angle: number, r: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const bgStart = polarToXY(startAngle, radius);
  const bgEnd   = polarToXY(0, radius);
  const fEnd    = polarToXY(fillAngle, radius);
  const largeArc = fillAngle - startAngle > 180 ? 1 : 0;

  const bd = breakdown as any;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size }}>
      <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}
        aria-label={`Trust score: ${score}`}>
        {/* Track */}
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none" stroke="var(--border-lit)" strokeWidth={6} strokeLinecap="round"
        />
        {/* Fill */}
        {clampedScore > 0 && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fEnd.x} ${fEnd.y}`}
            fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        )}
        {/* Score */}
        <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="14" fontWeight="700" fontFamily="IBM Plex Mono, monospace">
          {Math.round(clampedScore)}
        </text>
      </svg>

      <div style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.15em', color, textTransform: 'uppercase', marginTop: '-2px' }}>
        {label}
      </div>

      {bd && (
        <div style={{ marginTop: '4px', width: '100%' }}>
          {[
            { label: 'Evidence', value: bd.evidence_quality ?? 0 },
            { label: 'Safety',   value: bd.safety_signal   ?? 0 },
            { label: 'Trial-RW', value: bd.trial_real_gap  ?? 0 },
            { label: 'Access',   value: bd.formulary_access ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.5rem', color: 'var(--text-lo)', width: '40px', flexShrink: 0 }}>{label}</span>
              <div className="bar-track">
                <div style={{
                  width: `${Math.round(value)}%`,
                  height: '100%',
                  background: scoreColor(value),
                  borderRadius: '1px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.5rem', color: scoreColor(value), width: '18px', textAlign: 'right', flexShrink: 0 }}>
                {Math.round(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
