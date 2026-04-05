'use client';

import { Pill, Loader2 } from 'lucide-react';
import type { PeerComparisonRow, TrendingDrug } from '@/types/pharma';

type Props = {
  mode: 'home' | 'drug';
  trending: TrendingDrug[];
  peerRows: PeerComparisonRow[];
  loading?: boolean;
  onSelectDrug: (name: string) => void;
};

export default function HubDrugPipeline({ mode, trending, peerRows, loading, onSelectDrug }: Props) {
  const rows =
    mode === 'drug' && peerRows.length
      ? peerRows.map(r => ({
          drug: r.brand_name || r.generic_name,
          company: r.drug_class,
          indication: r.generic_name,
          phase: r.active_trials ? `${r.active_trials} trials` : '—',
          status: r.shortage_active ? 'SHORTAGE' : r.black_box ? 'BBW' : 'TRACK',
          statusType: r.shortage_active ? 'critical' : r.black_box ? 'warning' : r.is_subject ? 'success' : 'info',
          rxcui: r.rxcui,
        }))
      : trending.map(t => ({
          drug: t.name,
          company: t.drug_class,
          indication: t.generic_name,
          phase: `${t.faers_reports.toLocaleString()} FAERS`,
          status: t.shortage_active ? 'SHORTAGE' : 'TREND',
          statusType: t.shortage_active ? 'critical' : t.trend_score > 45 ? 'warning' : 'info',
          rxcui: t.rxcui,
        }));

  const tag = (st: string) => {
    if (st === 'critical') return 'hub-tag-critical';
    if (st === 'warning') return 'hub-tag-warning';
    if (st === 'success') return 'hub-tag-success';
    return 'hub-tag-info';
  };

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Pill className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hub-panel-title">{mode === 'drug' ? 'Class peer grid' : 'Trending watchlist'}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{rows.length} ROWS</span>
      </div>
      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        {loading && (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
        {!loading && (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left px-2 py-1 font-medium">Drug</th>
                <th className="text-left px-1 py-1 font-medium hidden sm:table-cell">Class</th>
                <th className="text-left px-1 py-1 font-medium hidden md:table-cell">Generic</th>
                <th className="text-left px-1 py-1 font-medium">Activity</th>
                <th className="text-right px-2 py-1 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr
                  key={`${d.drug}-${i}`}
                  className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => onSelectDrug(d.drug)}
                >
                  <td className="px-2 py-1.5 font-medium text-foreground">{d.drug}</td>
                  <td className="px-1 py-1.5 text-muted-foreground hidden sm:table-cell truncate max-w-[100px]">
                    {d.company}
                  </td>
                  <td className="px-1 py-1.5 text-muted-foreground hidden md:table-cell truncate max-w-[120px]">
                    {d.indication}
                  </td>
                  <td className="px-1 py-1.5 text-foreground">{d.phase}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={tag(d.statusType)}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
