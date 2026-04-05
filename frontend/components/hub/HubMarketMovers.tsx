'use client';

import { TrendingUp, TrendingDown, BarChart3, Loader2 } from 'lucide-react';
import type { MarketMover } from '@/types/pharma';
import { formatUsd } from './hubTypes';

type Props = {
  movers: MarketMover[];
  loading?: boolean;
  onSelectDrug: (name: string) => void;
};

export default function HubMarketMovers({ movers, loading, onSelectDrug }: Props) {
  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Market movers (Part D)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hub-live-dot" />
          <span className="text-[10px] font-mono text-muted-foreground">CMS</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading &&
          movers.map((m, i) => (
            <button
              key={`${m.name}-${i}`}
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 border-b border-border/50 hover:bg-secondary/50 text-left transition-colors"
              onClick={() => onSelectDrug(m.name)}
            >
              <div>
                <span className="text-xs font-semibold text-foreground font-mono">{m.name}</span>
                <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{m.generic_name}</p>
              </div>
              <div className="text-right flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono">{formatUsd(m.market_spend_usd)}</span>
                <div
                  className={`flex items-center gap-0.5 ${m.yoy_spend_change_pct >= 0 ? 'text-success' : 'text-critical'}`}
                >
                  {m.yoy_spend_change_pct >= 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  <span className="text-[10px] font-mono">
                    {m.yoy_spend_change_pct >= 0 ? '+' : ''}
                    {m.yoy_spend_change_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </button>
          ))}
        {!loading && movers.length === 0 && (
          <p className="text-[11px] text-muted-foreground p-3">No market snapshot rows yet.</p>
        )}
      </div>
    </div>
  );
}
