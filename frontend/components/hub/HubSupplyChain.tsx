'use client';

import { AlertTriangle, Package, RefreshCw } from 'lucide-react';
import type { TrendingDrug } from '@/types/pharma';
import { useSupplyChain } from '@/lib/api';

type Props = {
  trending: TrendingDrug[];
};

function PressureBar({ value }: { value: number }) {
  const percent = Math.min(100, Math.max(0, value));
  const color = percent > 70 ? 'bg-critical' : percent > 40 ? 'bg-warning' : 'bg-primary';

  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function HubSupplyChain({ trending }: Props) {
  const { supply, isLoading } = useSupplyChain();

  const pressureIndex = supply?.pressure_index ?? null;
  const recallCount = supply?.recall_count_90d ?? 0;
  const shortageSignals = supply?.shortage_signals ?? 0;
  const affectedProducts = supply?.affected_products ?? [];
  const isLive = supply?.source_status === 'live';

  const syntheticPressure = trending.length > 0
    ? Math.min(
        100,
        trending.filter((drug) => drug.shortage_active).length * 20 +
          (trending.reduce((sum, drug) => sum + drug.trend_score, 0) / trending.length) * 0.4
      )
    : 0;

  const displayPressure = pressureIndex !== null ? pressureIndex : syntheticPressure;
  const shortageTrending = trending.filter((drug) => drug.shortage_active).slice(0, 4);

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="hub-panel-title">Supply pressure</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          {isLive && <div className="hub-live-dot" />}
          <span className="font-mono text-[10px] text-muted-foreground">
            {isLive ? 'FDA LIVE' : 'INDEX'}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-2 hub-scrollbar">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">PRESSURE INDEX</span>
            <span
              className={`font-mono text-sm font-bold ${
                displayPressure > 70 ? 'text-critical' : displayPressure > 40 ? 'text-warning' : 'text-primary'
              }`}
            >
              {displayPressure.toFixed(0)}
            </span>
          </div>
          <PressureBar value={displayPressure} />
        </div>

        {supply && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded bg-secondary/50 p-1.5 text-center">
              <div className="font-mono text-[10px] text-muted-foreground">RECALLS 90D</div>
              <div className="font-mono text-sm font-bold text-warning">{recallCount}</div>
            </div>
            <div className="rounded bg-secondary/50 p-1.5 text-center">
              <div className="font-mono text-[10px] text-muted-foreground">SHORTAGE SIG</div>
              <div className="font-mono text-sm font-bold text-critical">{shortageSignals}</div>
            </div>
          </div>
        )}

        {affectedProducts.length > 0 ? (
          <div className="space-y-1">
            <span className="font-mono text-[9px] uppercase text-muted-foreground">Recent enforcement</span>
            {affectedProducts.slice(0, 6).map((product, index) => (
              <div key={`${product.name}-${index}`} className="flex items-start gap-1.5 py-0.5">
                {product.is_shortage || product.classification === 'Class I' ? (
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-critical" />
                ) : (
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      product.classification === 'Class I'
                        ? 'bg-critical'
                        : product.classification === 'Class II'
                          ? 'bg-warning'
                          : 'bg-muted-foreground'
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[10px] leading-tight text-foreground">{product.name}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {product.classification} | {product.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <span className="font-mono text-[9px] uppercase text-muted-foreground">Shortage risk</span>
            {shortageTrending.map((drug) => (
              <div key={drug.rxcui || drug.name} className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 text-critical" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="line-clamp-1 text-[10px] text-foreground">{drug.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-critical">SHORTAGE</span>
                  </div>
                  <PressureBar value={Math.min(100, drug.trend_score * 1.3)} />
                </div>
              </div>
            ))}
            {shortageTrending.length === 0 && (
              <p className="text-[10px] text-muted-foreground">No active shortage flags in the trending set.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
