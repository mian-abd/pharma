'use client';

import { FlaskConical, Loader2, ExternalLink } from 'lucide-react';
import type { TrialData } from '@/types/pharma';
import { trialFromApi } from './hubTypes';

type Props = {
  trials: TrialData[] | Record<string, unknown>[];
  loading?: boolean;
};

const statusColors: Record<string, string> = {
  RECRUITING: 'hub-tag-success',
  ACTIVE_NOT_RECRUITING: 'hub-tag-info',
  ACTIVE: 'hub-tag-info',
  COMPLETED: 'hub-tag-warning',
  TERMINATED: 'hub-tag-critical',
  WITHDRAWN: 'hub-tag-critical',
  SUSPENDED: 'hub-tag-critical',
};

export default function HubClinicalTrials({ trials, loading }: Props) {
  const normalized = trials.slice(0, 12).map(t => trialFromApi(t as Record<string, unknown>));

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hub-panel-title">Clinical trials</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{normalized.length} SHOWN</span>
      </div>
      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading &&
          normalized.map(t => {
            const st = t.status.toUpperCase().replace(/\s+/g, '_');
            const badge = statusColors[st] || 'hub-tag-info';
            return (
              <a
                key={t.id}
                href={`https://clinicaltrials.gov/study/${t.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 border-b border-border/50 hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{t.drug}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">Ph {t.phase || '—'}</span>
                  </div>
                  <span className={badge}>{t.status.slice(0, 12).toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {t.sponsor} · {t.condition}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">n={t.enrollment.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{t.id}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              </a>
            );
          })}
        {!loading && normalized.length === 0 && (
          <p className="text-[11px] text-muted-foreground p-3">Search a drug to load ClinicalTrials.gov matches.</p>
        )}
      </div>
    </div>
  );
}
