'use client';

import { Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import { useRegulatoryCalendar } from '@/lib/api';

function tagClass(type: string): string {
  const t = type.toUpperCase();
  if (t === 'RECALL' || t === 'SHORTAGE') return 'hub-tag-critical';
  if (t === 'SAFETY') return 'hub-tag-warning';
  if (t === 'APPROVAL') return 'hub-tag-success';
  return 'hub-tag-info';
}

const FALLBACK = [
  { date: 'Live feed', event: 'Connect to FDA RSS for real PDUFA and AdCom calendar events', type: 'INFO', source_url: '', source: 'FDA', severity: 'info' },
];

export default function HubRegulatoryCalendar() {
  const { events, isLoading, isError } = useRegulatoryCalendar();

  const display = events.length > 0 ? events : FALLBACK;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Regulatory calendar</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
          {!isLoading && events.length > 0 && <div className="hub-live-dot" />}
          <span className="text-[10px] text-muted-foreground font-mono">
            {isError ? 'ERR' : events.length > 0 ? 'LIVE' : 'LOAD'}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0 p-2 space-y-2">
        {display.map((e, i) => (
          <div
            key={i}
            className="flex items-start gap-2 group cursor-pointer hover:bg-secondary/30 rounded px-1 py-0.5 transition-colors"
            onClick={() => e.source_url && window.open(e.source_url, '_blank', 'noopener')}
          >
            <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 pt-0.5">{e.date}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap mb-0.5">
                <span className={`shrink-0 ${tagClass(e.type)}`}>{e.type}</span>
                <span className="text-[9px] text-muted-foreground font-mono">{e.source}</span>
                {e.source_url && (
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto" />
                )}
              </div>
              <span className="text-[10px] text-foreground leading-snug line-clamp-2">{e.event}</span>
            </div>
          </div>
        ))}
        {events.length === 0 && !isLoading && !isError && (
          <p className="text-[9px] text-muted-foreground leading-tight mt-1 px-1">
            Real PDUFA / AdCom dates load from the FDA RSS feed. Paid APIs (Benzinga, BioAPI) unlock the full calendar — see API_KEYS_GUIDE.md.
          </p>
        )}
      </div>
    </div>
  );
}
