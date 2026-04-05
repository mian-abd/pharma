'use client';

import { RepBriefData } from '../types/pharma';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface RepBriefProps {
  data: RepBriefData;
  drugName: string;
}

export default function RepBrief({ data, drugName }: RepBriefProps) {
  return (
    <div className="panel-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border-dim)' }}>

      {/* Left: Rep Will Say */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.65rem' }}>
        <div className="panel-header panel-header-red">
          <AlertTriangle size={9} /> Rep Will Say
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.will_say.map((point, i) => (
            <li key={i} style={{
              fontSize: '0.68rem', color: 'var(--text-mid)',
              padding: '0.35rem 0', borderBottom: '1px solid var(--border-dim)',
              display: 'flex', gap: '6px', lineHeight: 1.45,
            }}>
              <span style={{ color: 'var(--red)', flexShrink: 0, marginTop: '1px' }}>▸</span>
              {point}
            </li>
          ))}
        </ul>
        {data.absolute_vs_relative_note && (
          <div style={{
            marginTop: '0.6rem', padding: '0.4rem 0.5rem',
            background: 'var(--red-glow-sm)', border: '1px solid var(--border-red)',
            fontSize: '0.62rem', color: 'var(--red-bright)', lineHeight: 1.45,
          }}>
            ⚠ {data.absolute_vs_relative_note}
          </div>
        )}
      </div>

      {/* Center: Evidence Shows */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.65rem' }}>
        <div className="panel-header" style={{ color: 'var(--green-bright)', borderBottomColor: 'var(--border-mid)' }}>
          <CheckCircle size={9} /> Evidence Shows
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.reality.map((point, i) => (
            <li key={i} style={{
              fontSize: '0.68rem', color: 'var(--text-mid)',
              padding: '0.35rem 0', borderBottom: '1px solid var(--border-dim)',
              display: 'flex', gap: '6px', lineHeight: 1.45,
            }}>
              <span style={{ color: 'var(--green-bright)', flexShrink: 0, marginTop: '1px' }}>▸</span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: Power Questions + Limitations */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.65rem' }}>
        <div className="panel-header" style={{ color: 'var(--blue-bright)', borderBottomColor: 'var(--border-mid)' }}>
          <HelpCircle size={9} /> Power Questions
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.power_questions.map((q, i) => (
            <li key={i} style={{
              fontSize: '0.66rem', color: 'var(--text-mid)',
              padding: '0.35rem 0.45rem', marginBottom: '0.3rem',
              border: '1px solid var(--blue)',
              borderLeft: '3px solid var(--blue)',
              background: 'var(--blue-glow)',
              lineHeight: 1.45,
            }}>
              <span style={{ color: 'var(--blue-bright)', fontWeight: 600, marginRight: '4px' }}>{i + 1}.</span>
              {q}
            </li>
          ))}
        </ol>

        {data.study_limitations && (
          <div style={{ marginTop: '0.65rem' }}>
            <div style={{
              fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--red)', marginBottom: '0.3rem',
            }}>
              Study Limitations
            </div>
            <div style={{
              fontSize: '0.62rem', color: 'var(--text-lo)', lineHeight: 1.5,
              padding: '0.4rem 0.45rem',
              background: 'var(--red-glow-sm)', border: '1px solid var(--border-red)',
            }}>
              {data.study_limitations}
            </div>
          </div>
        )}

        {data.pivot_trial_used && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.58rem', color: 'var(--text-lo)', fontStyle: 'italic' }}>
            Ref: {data.pivot_trial_used}
          </div>
        )}

        {data.generation_latency_ms && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.54rem', color: 'var(--text-lo)' }}>
            Generated in {data.generation_latency_ms}ms · Claude AI
          </div>
        )}
      </div>
    </div>
  );
}
