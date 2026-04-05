'use client';

import type { FeaturedWatchCard, TrendingDrug } from '@/types/pharma';

type Props = {
  featured: FeaturedWatchCard[];
  trending: TrendingDrug[];
  onSelectDrug?: (name: string) => void;
};

export default function HubMarketPulse({ featured, trending, onSelectDrug }: Props) {
  const shortageCt = trending.filter(t => t.shortage_active).length;
  const hotFaers = trending.filter(t => t.faers_reports > 30000).length;

  const lines = [
    { label: 'Watchlist cards', value: String(featured.length), sub: 'Featured hybrid scores' },
    { label: 'Shortage flags', value: String(shortageCt), sub: 'Among trending seeds' },
    { label: 'High FAERS cohort', value: String(hotFaers), sub: '>30k reports (seeded)' },
    { label: 'Trending rows', value: String(trending.length), sub: 'Dashboard home API' },
  ];

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <span className="hub-panel-title">Board pulse</span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto hub-scrollbar min-h-0">
        {featured.slice(0, 2).map(f => (
          <button
            key={f.rxcui}
            type="button"
            className="w-full text-left rounded border border-border/80 p-2 hover:bg-secondary/50 transition-colors"
            onClick={() => onSelectDrug?.(f.name)}
          >
            <div className="text-[11px] font-semibold text-foreground">{f.name}</div>
            <div className="text-[10px] text-primary font-mono">Trust {Math.round(f.trust_score)} · {f.alert_count} alerts</div>
            <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{f.summary}</p>
          </button>
        ))}
        {lines.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 first:border-0 first:pt-0">
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <div className="text-right">
              <span className="text-xs font-semibold text-foreground font-mono">{s.value}</span>
              <p className="text-[9px] text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
