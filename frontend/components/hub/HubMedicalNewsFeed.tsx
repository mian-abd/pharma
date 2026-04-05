'use client';

import { useState } from 'react';
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react';
import type { DashboardAlert, NewsItem } from '@/types/pharma';
import { useNewsFeed } from '@/lib/api';

type Props = {
  alerts: DashboardAlert[];
};

const TABS = ['ALL', 'SHORTAGE', 'SAFETY', 'RECALL', 'APPROVAL', 'INFO'] as const;

function tagColor(tag: string | null): string {
  const t = (tag || '').toUpperCase();
  if (t === 'SHORTAGE' || t === 'RECALL') return 'hub-tag-critical';
  if (t === 'SAFETY') return 'hub-tag-warning';
  if (t === 'APPROVAL') return 'hub-tag-success';
  return 'hub-tag-info';
}

function severityDot(severity: string): string {
  if (severity === 'critical') return 'bg-critical';
  if (severity === 'high') return 'bg-warning';
  if (severity === 'medium') return 'bg-warning';
  return 'bg-primary';
}

export default function HubMedicalNewsFeed({ alerts }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL');
  const { news, isLoading } = useNewsFeed();

  // Merge live FDA RSS news with alert fallbacks, dedup by title prefix
  const liveItems: Array<NewsItem | DashboardAlert> = news.length > 0
    ? news
    : alerts.map(a => ({
        title: a.title,
        summary: a.summary,
        source: a.source,
        pub_date: a.signal_date || '',
        source_url: '',
        tag: a.tag || 'INFO',
        severity: a.severity,
      }));

  const filtered = liveItems.filter(item => {
    if (tab === 'ALL') return true;
    const t = (item.tag || '').toUpperCase();
    return t === tab;
  });

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Signal river</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
          {news.length > 0 && <div className="hub-live-dot" />}
          <span className="text-[10px] font-mono text-muted-foreground">
            {news.length > 0 ? 'FDA LIVE' : `${filtered.length}`}
          </span>
        </div>
      </div>

      <div className="flex gap-1 px-2 py-1 border-b border-border overflow-x-auto shrink-0 hub-scrollbar">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-[10px] font-medium px-2.5 py-0.5 rounded-md transition-colors whitespace-nowrap ${
              tab === t ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        {filtered.length === 0 && !isLoading && (
          <p className="text-[11px] text-muted-foreground p-3">No items for this filter.</p>
        )}
        {filtered.map((item, i) => {
          const url = 'source_url' in item ? item.source_url : '';
          return (
            <div
              key={`${item.title.slice(0, 40)}-${i}`}
              className="px-3 py-2 border-b border-border/50 hover:bg-secondary/50 transition-colors group cursor-pointer"
              onClick={() => url && window.open(url, '_blank', 'noopener')}
            >
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot(item.severity)}`} />
                <span className="text-[10px] font-semibold text-primary font-mono">{item.source}</span>
                {item.tag && <span className={tagColor(item.tag)}>{item.tag}</span>}
                {'pub_date' in item && item.pub_date && (
                  <span className="text-[9px] text-muted-foreground ml-auto font-mono">{item.pub_date}</span>
                )}
                {url && <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100" />}
              </div>
              <p className="text-[11px] text-foreground leading-relaxed line-clamp-2">{item.title}</p>
              {item.summary && item.summary !== item.title && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{item.summary}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
