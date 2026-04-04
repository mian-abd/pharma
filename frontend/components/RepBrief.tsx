'use client';

import { RepBriefData } from '../types/pharma';
import { HelpCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface RepBriefProps {
  data: RepBriefData;
  drugName: string;
}

export default function RepBrief({ data, drugName }: RepBriefProps) {
  return (
    <div className="panel-animate" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', height: '100%' }}>
      {/* Left: What Rep Will Say */}
      <div style={{ padding: '0.75rem', borderRight: '1px solid var(--border-primary)' }}>
        <div className="panel-header" style={{ color: 'var(--accent-amber)' }}>
          <AlertTriangle size={10} style={{ display: 'inline', marginRight: '4px' }} />
          Rep Will Say
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.will_say.map((point, i) => (
            <li
              key={i}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                padding: '0.4rem 0',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                gap: '6px',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '1px' }}>▸</span>
              {point}
            </li>
          ))}
        </ul>

        {data.absolute_vs_relative_note && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem',
              background: 'rgba(255, 184, 0, 0.06)',
              border: '1px solid rgba(255, 184, 0, 0.2)',
              fontSize: '0.7rem',
              color: 'var(--accent-amber)',
              lineHeight: 1.4,
            }}
          >
            {data.absolute_vs_relative_note}
          </div>
        )}
      </div>

      {/* Center: What Evidence Shows */}
      <div style={{ padding: '0.75rem', borderRight: '1px solid var(--border-primary)' }}>
        <div className="panel-header" style={{ color: 'var(--accent-green)' }}>
          <CheckCircle size={10} style={{ display: 'inline', marginRight: '4px' }} />
          Evidence Shows
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.reality.map((point, i) => (
            <li
              key={i}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                padding: '0.4rem 0',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                gap: '6px',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: '1px' }}>▸</span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: Power Questions + Study Limitations */}
      <div style={{ padding: '0.75rem' }}>
        <div className="panel-header" style={{ color: 'var(--accent-blue)' }}>
          <HelpCircle size={10} style={{ display: 'inline', marginRight: '4px' }} />
          Power Questions
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, counterReset: 'questions' }}>
          {data.power_questions.map((q, i) => (
            <li
              key={i}
              style={{
                fontSize: '0.73rem',
                color: 'var(--text-primary)',
                padding: '0.4rem 0.5rem',
                marginBottom: '0.35rem',
                border: '1px solid var(--accent-blue)',
                borderLeft: '3px solid var(--accent-blue)',
                background: 'rgba(68, 153, 255, 0.04)',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600, marginRight: '4px' }}>{i + 1}.</span>
              {q}
            </li>
          ))}
        </ol>

        {data.study_limitations && (
          <div style={{ marginTop: '0.75rem' }}>
            <div
              style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent-red)',
                marginBottom: '0.35rem',
              }}
            >
              Study Limitations
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                padding: '0.5rem',
                background: 'rgba(255, 68, 68, 0.04)',
                border: '1px solid rgba(255, 68, 68, 0.2)',
              }}
            >
              {data.study_limitations}
            </div>
          </div>
        )}

        {data.pivot_trial_used && (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Ref: {data.pivot_trial_used}
          </div>
        )}
      </div>
    </div>
  );
}
