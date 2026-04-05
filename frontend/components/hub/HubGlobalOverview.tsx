'use client';

import { Globe, AlertTriangle } from 'lucide-react';
import type { SourceHealthItem, TrendingDrug } from '@/types/pharma';

type Props = {
  sourceHealth: SourceHealthItem[];
  trending: TrendingDrug[];
  drugTrust?: number | null;
};

export default function HubGlobalOverview({ sourceHealth, trending, drugTrust }: Props) {
  const avgTrust =
    drugTrust != null
      ? drugTrust
      : trending.length
        ? Math.round(trending.reduce((s, t) => s + t.trust_score, 0) / trending.length)
        : 50;

  const riskScore = Math.max(0, Math.min(100, Math.round(100 - avgTrust)));
  const trend =
    riskScore > 55 ? 'Elevated' : riskScore > 35 ? 'Moderate' : 'Stable';

  const stroke = riskScore > 55 ? 'hsl(0, 70%, 55%)' : riskScore > 35 ? 'hsl(38, 80%, 55%)' : 'hsl(145, 55%, 42%)';

  const outbreaks = trending.slice(0, 5).map(t => ({
    disease: t.name,
    region: t.drug_class || 'Multi',
    risk: t.shortage_active ? 'HIGH' : t.faers_reports > 40000 ? 'ELEVATED' : 'MODERATE',
    cases: `${t.faers_reports.toLocaleString()} FAERS`,
  }));

  const riskColors: Record<string, string> = {
    HIGH: 'hub-tag-critical',
    ELEVATED: 'hub-tag-warning',
    MODERATE: 'hub-tag-info',
  };

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Risk & systems</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hub-live-dot" />
          <span className="text-[10px] font-mono text-muted-foreground">FEEDS</span>
        </div>
      </div>

      <div className="flex items-center justify-center py-3 border-b border-border shrink-0">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="hsl(220, 14%, 16%)" strokeWidth="6" />
              <circle
                cx="36"
                cy="36"
                r="30"
                fill="none"
                stroke={stroke}
                strokeWidth="6"
                strokeDasharray={`${(riskScore / 100) * 188.5} 188.5`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-mono" style={{ color: stroke }}>
                {riskScore}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: stroke }}>
            {trend}
          </span>
          <p className="text-[9px] text-muted-foreground mt-0.5 px-2">Inverted trust / volatility</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        <div className="px-2 py-1 border-b border-border">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data sources</span>
        </div>
        {sourceHealth.map(s => (
          <div key={s.key} className="px-2 py-1.5 border-b border-border/50 flex justify-between items-center gap-2">
            <span className="text-[10px] text-muted-foreground truncate">{s.label}</span>
            <span
              className={`text-[9px] font-mono font-bold shrink-0 ${
                s.status === 'live' ? 'text-success' : s.status === 'demo' ? 'text-warning' : 'text-muted-foreground'
              }`}
            >
              {s.status.toUpperCase()}
            </span>
          </div>
        ))}

        <div className="px-2 py-1 border-b border-border mt-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hot molecules</span>
        </div>
        {outbreaks.map((o, i) => (
          <div key={`${o.disease}-${i}`} className="px-2 py-1.5 border-b border-border/50 hover:bg-secondary/50">
            <div className="flex items-center justify-between mb-0.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <AlertTriangle className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-medium text-foreground truncate">{o.disease}</span>
              </div>
              <span className={riskColors[o.risk] || 'hub-tag-info'}>{o.risk}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground truncate">{o.region}</span>
              <span className="text-[9px] text-muted-foreground font-mono shrink-0">{o.cases}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
