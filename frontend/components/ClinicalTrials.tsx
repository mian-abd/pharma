'use client';

import { useState } from 'react';
import { TrialData } from '../types/pharma';
import { Building2, FlaskConical, ExternalLink } from 'lucide-react';

interface ClinicalTrialsProps {
  trials: TrialData[];
}

const PHASES = ['All', 'Phase 3', 'Phase 2', 'Phase 1'];
const STATUSES = ['All', 'Completed', 'Recruiting', 'Active'];

function phaseBadgeColor(phase: string): string {
  if (phase.includes('3')) return 'badge-green';
  if (phase.includes('2')) return 'badge-amber';
  if (phase.includes('1')) return 'badge-muted';
  return 'badge-muted';
}

function statusBadgeColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') return 'badge-green';
  if (s === 'recruiting' || s === 'active') return 'badge-blue';
  if (s.includes('terminated') || s.includes('withdrawn')) return 'badge-red';
  return 'badge-muted';
}

export default function ClinicalTrials({ trials }: ClinicalTrialsProps) {
  const [phaseFilter, setPhaseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = trials.filter(t => {
    const matchPhase = phaseFilter === 'All' || t.phase.toLowerCase().includes(phaseFilter.toLowerCase().replace('phase ', ''));
    const matchStatus = statusFilter === 'All' || t.status.toLowerCase() === statusFilter.toLowerCase();
    return matchPhase && matchStatus;
  });

  const industryCount = trials.filter(t => t.industry_sponsored).length;

  return (
    <div className="panel-animate" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        padding: '0.4rem 0',
        borderBottom: '1px solid var(--border-primary)',
        marginBottom: '0.5rem',
        fontSize: '0.7rem',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{trials.length}</span> total
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{industryCount}</span> industry
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
            {trials.filter(t => t.status.toLowerCase() === 'completed').length}
          </span> completed
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {PHASES.map(p => (
          <button
            key={p}
            onClick={() => setPhaseFilter(p)}
            style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              border: '1px solid',
              borderColor: phaseFilter === p ? 'var(--accent-green)' : 'var(--border-primary)',
              color: phaseFilter === p ? 'var(--accent-green)' : 'var(--text-muted)',
              background: phaseFilter === p ? 'rgba(0,255,136,0.06)' : 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {p}
          </button>
        ))}
        <span style={{ color: 'var(--border-primary)', margin: '0 4px' }}>|</span>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              border: '1px solid',
              borderColor: statusFilter === s ? 'var(--accent-blue)' : 'var(--border-primary)',
              color: statusFilter === s ? 'var(--accent-blue)' : 'var(--text-muted)',
              background: statusFilter === s ? 'rgba(68,153,255,0.06)' : 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Trial list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '1rem 0', textAlign: 'center' }}>
            No trials match filters
          </div>
        ) : (
          filtered.map(trial => (
            <div
              key={trial.nct_id}
              style={{
                padding: '0.5rem',
                borderBottom: '1px solid var(--border-primary)',
                marginBottom: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                <span className={`badge ${phaseBadgeColor(trial.phase)}`} style={{ flexShrink: 0 }}>
                  {trial.phase || 'N/A'}
                </span>
                <span className={`badge ${statusBadgeColor(trial.status)}`} style={{ flexShrink: 0 }}>
                  {trial.status}
                </span>
                {trial.industry_sponsored && (
                  <span className="badge badge-amber" title="Industry-sponsored trial" style={{ flexShrink: 0 }}>
                    <Building2 size={8} style={{ marginRight: '2px' }} />IND
                  </span>
                )}
                {trial.has_results && (
                  <span className="badge badge-green" style={{ flexShrink: 0 }}>RESULTS</span>
                )}
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '4px' }}>
                {trial.title}
              </div>

              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {trial.enrollment && (
                  <span>n={trial.enrollment.toLocaleString()}</span>
                )}
                <span>{trial.sponsor}</span>
                <a
                  href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-blue)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  {trial.nct_id} <ExternalLink size={9} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
