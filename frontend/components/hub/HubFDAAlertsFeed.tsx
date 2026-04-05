'use client';

import { AlertTriangle, CheckCircle, Clock, FileText, Loader2 } from 'lucide-react';
import type { DashboardAlert } from '@/types/pharma';
import { alertSeverityClass } from './hubTypes';

type Props = {
  alerts: DashboardAlert[];
  loading?: boolean;
  onAlertClick?: (a: DashboardAlert) => void;
};

const iconMap: Record<string, React.ReactNode> = {
  approval: <CheckCircle className="w-3 h-3 text-success" />,
  warning: <AlertTriangle className="w-3 h-3 text-warning" />,
  critical: <AlertTriangle className="w-3 h-3 text-critical" />,
  pending: <Clock className="w-3 h-3 text-muted-foreground" />,
};

function tagClass(tag: string | null): string {
  const t = (tag || '').toUpperCase();
  if (t === 'SHORTAGE' || t === 'RECALL') return 'hub-tag-critical';
  if (t === 'SAFETY' || t === 'LABEL') return 'hub-tag-warning';
  if (t === 'APPROVED' || t === 'COVERAGE') return 'hub-tag-success';
  return 'hub-tag-info';
}

export default function HubFDAAlertsFeed({ alerts, loading, onAlertClick }: Props) {
  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hub-panel-title">FDA & signals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hub-live-dot" />
          <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-[11px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading signals…
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <p className="text-[11px] text-muted-foreground p-3">No alerts in this view. Search a drug or check back after data refresh.</p>
        )}
        {!loading &&
          alerts.map((a, i) => {
            const kind = alertSeverityClass(a.severity);
            return (
              <button
                key={`${a.title}-${i}`}
                type="button"
                className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-secondary/50 transition-colors"
                onClick={() => onAlertClick?.(a)}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{iconMap[kind]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate">{a.title}</span>
                      {a.tag && <span className={tagClass(a.tag)}>{a.tag}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{a.summary}</p>
                    <p className="text-[9px] text-muted-foreground/80 mt-0.5 font-mono">{a.source}</p>
                  </div>
                  {a.signal_date && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono shrink-0">
                      {a.signal_date.slice(0, 10)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
