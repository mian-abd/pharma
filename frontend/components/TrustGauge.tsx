'use client';

import { useEffect, useRef } from 'react';

interface TrustGaugeProps {
  score: number;
  breakdown?: {
    evidence_quality: number;
    safety_signal: number;
    trial_real_gap: number;
    formulary_access: number;
  };
  size?: number;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#00ff88';
  if (score >= 50) return '#ffb800';
  return '#ff4444';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'STRONG';
  if (score >= 50) return 'MODERATE';
  return 'WEAK';
}

export default function TrustGauge({ score, breakdown, size = 110 }: TrustGaugeProps) {
  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const circumference = Math.PI * radius; // Half circumference for semicircle

  // Arc parameters for semicircle (left to right, top of gauge)
  const startAngle = -180;
  const endAngle = 0;
  const clampedScore = Math.max(0, Math.min(100, score));
  const fillAngle = startAngle + (clampedScore / 100) * 180;

  function polarToXY(angle: number, r: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  const bgStart = polarToXY(startAngle, radius);
  const bgEnd = polarToXY(endAngle, radius);

  const fillEnd = polarToXY(fillAngle, radius);
  const fillLargeArc = fillAngle - startAngle > 180 ? 1 : 0;

  const color = scoreColor(clampedScore);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`} aria-label={`Trust score: ${score}`}>
        {/* Background track */}
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none"
          stroke="#0d2040"
          strokeWidth={8}
          strokeLinecap="round"
        />

        {/* Score fill arc */}
        {clampedScore > 0 && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${fillLargeArc} 1 ${fillEnd.x} ${fillEnd.y}`}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
          />
        )}

        {/* Score number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="16"
          fontWeight="700"
          fontFamily="IBM Plex Mono, monospace"
        >
          {Math.round(clampedScore)}
        </text>
      </svg>

      <div style={{
        fontSize: '0.55rem',
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: color,
        textTransform: 'uppercase',
        marginTop: '-4px',
      }}>
        {scoreLabel(clampedScore)} EVIDENCE
      </div>

      {breakdown && (
        <div className="mt-2 w-full" style={{ fontSize: '0.6rem' }}>
          {[
            { label: 'Evidence', value: breakdown.evidence_quality },
            { label: 'Safety', value: breakdown.safety_signal },
            { label: 'Trial-RW', value: breakdown.trial_real_gap },
            { label: 'Formulary', value: breakdown.formulary_access },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1 mb-1">
              <span style={{ color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>{label}</span>
              <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--border-primary)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(value)}%`,
                    background: scoreColor(value),
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              <span style={{ color: scoreColor(value), width: '22px', textAlign: 'right', flexShrink: 0 }}>
                {Math.round(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
