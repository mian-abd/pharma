'use client';

import { useState } from 'react';
import { TrialData } from '../types/pharma';
import { Building2, ExternalLink } from 'lucide-react';

interface ClinicalTrialsProps {
  trials: TrialData[];
}

const PHASES   = ['All', 'Phase 3', 'Phase 2', 'Phase 1'];
const STATUSES = ['All', 'Completed', 'Recruiting', 'Active'];

function phaseCls(phase: string) {
  if (phase.includes('3')) return 'badge-green';
  if (phase.includes('2')) return 'badge-amber';
  return 'badge-muted';
}

function statusCls(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed')                        return 'badge-green';
  if (s === 'recruiting' || s === 'active')     return 'badge-blue';
  if (s.includes('terminated') || s.includes('withdrawn')) return 'badge-red';
  return 'badge-muted';
}

export default function ClinicalTrials({ trials }: ClinicalTrialsProps) {
  const [phase,  setPhase]  = useState('All');
  const [status, setStatus] = useState('All');

  const filtered = trials.filter(t => {
    const mp = phase  === 'All' || t.phase.toLowerCase().includes(phase.toLowerCase().replace('phase ', ''));
    const ms = status === 'All' || t.status.toLowerCase() === status.toLowerCase();
    return mp && ms;
  });

  return (
    <div className="panel-in" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {PHASES.map(p => (
          <button key={p} onClick={() => setPhase(p)} style={{
            fontSize: '0.58rem', padding: '2px 6px',
            border: '1px solid',
            borderColor: phase === p ? 'var(--green)' : 'var(--border-lit)',
            color: phase === p ? 'var(--green-bright)' : 'var(--text-lo)',
            background: phase === p ? 'var(--green-glow)' : 'transparent',
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }}>{p}</button>
        ))}
        <span style={{ color: 'var(--border-lit)', margin: '0 2px' }}>|</span>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)} style={{
            fontSize: '0.58rem', padding: '2px 6px',
            border: '1px solid',
            borderColor: status === s ? 'var(--blue)' : 'var(--border-lit)',
            color: status === s ? 'var(--blue-bright)' : 'var(--text-lo)',
            background: status === s ? 'var(--blue-glow)' : 'transparent',
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }}>{s}</button>
        ))}
      </div>

      {/* Results count */}
      <div style={{ fontSize: '0.6rem', color: 'var(--text-lo)', marginBottom: '0.35rem' }}>
        Showing <span style={{ color: 'var(--red-bright)', fontWeight: 600 }}>{filtered.length}</span> of {trials.length} trials
      </div>

      {/* Trial list */}
      {filtered.length === 0 ? (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-lo)', textAlign: 'center', padding: '1rem' }}>
          No trials match filters
        </div>
      ) : (
        filtered.map(trial => (
          <div key={trial.nct_id} style={{
            padding: '0.45rem',
            borderBottom: '1px solid var(--border-dim)',
            borderLeft: trial.industry_sponsored ? '2px solid var(--amber-dim)' : '2px solid transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '3px', flexWrap: 'wrap' }}>
              <span className={`badge ${phaseCls(trial.phase)}`}>{trial.phase || 'N/A'}</span>
              <span className={`badge ${statusCls(trial.status)}`}>{trial.status}</span>
              {trial.industry_sponsored && (
                <span className="badge badge-amber" title="Industry-sponsored">
                  <Building2 size={8} />IND
                </span>
              )}
              {trial.has_results && <span className="badge badge-green">RESULTS</span>}
            </div>

            <div style={{ fontSize: '0.66rem', color: 'var(--text-lo)', lineHeight: 1.35, marginBottom: '3px' }}>
              {trial.title}
            </div>

            <div style={{ display: 'flex', gap: '8px', fontSize: '0.58rem', color: 'var(--text-lo)', alignItems: 'center' }}>
              {trial.enrollment && <span>n={trial.enrollment.toLocaleString()}</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {trial.sponsor}
              </span>
              <a
                href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--blue-bright)', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
              >
                {trial.nct_id} <ExternalLink size={8} />
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
