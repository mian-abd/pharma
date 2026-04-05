'use client';

import { Package, AlertTriangle, RefreshCw } from 'lucide-react';
import type { TrendingDrug } from '@/types/pharma';
import { useSupplyChain } from '@/lib/api';

type Props = {
  trending: TrendingDrug[];
};

function PressureBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct > 70 ? 'bg-critical' : pct > 40 ? 'bg-warning' : 'bg-primary';
  return (
    <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function HubSupplyChain({ trending }: Props) {
  const { supply, isLoading } = useSupplyChain();

  const pressureIndex = supply?.pressure_index ?? null;
  const recallCount = supply?.recall_count_90d ?? 0;
  const shortageSignals = supply?.shortage_signals ?? 0;
  const affected = supply?.affected_products ?? [];
  const isLive = supply?.source_status === 'live';

  // Fallback: derive synthetic pressure from trending drugs when API unavailable
  const syntheticPressure = trending.length > 0
    ? Math.min(100, trending.filter(t => t.shortage_active).length * 20 +
        (trending.reduce((s, t) => s + t.trend_score, 0) / trending.length) * 0.4)
    : 0;

  const displayPressure = pressureIndex !== null ? pressureIndex : syntheticPressure;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Supply pressure</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
          {isLive && <div className="hub-live-dot" />}
          <span className="text-[10px] font-mono text-muted-foreground">
            {isLive ? 'FDA LIVE' : 'INDEX'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0 p-2 space-y-3">
        {/* Pressure Index */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground font-mono">PRESSURE INDEX</span>
            <span className={`text-sm font-bold font-mono ${
              displayPressure > 70 ? 'text-critical' : displayPressure > 40 ? 'text-warning' : 'text-primary'
            }`}>
              {displayPressure.toFixed(0)}
            </span>
          </div>
          <PressureBar value={displayPressure} />
        </div>

        {/* Live stats */}
        {supply && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded bg-secondary/50 p-1.5 text-center">
              <div className="text-[10px] text-muted-foreground font-mono">RECALLS 90D</div>
              <div className="text-sm font-bold font-mono text-warning">{recallCount}</div>
            </div>
            <div className="rounded bg-secondary/50 p-1.5 text-center">
              <div className="text-[10px] text-muted-foreground font-mono">SHORTAGE SIG</div>
              <div className="text-sm font-bold font-mono text-critical">{shortageSignals}</div>
            </div>
          </div>
        )}

        {/* Live affected products */}
        {affected.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-mono uppercase">Recent enforcement</span>
            {affected.slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                {p.is_shortage || p.classification === 'Class I' ? (
                  <AlertTriangle className="w-3 h-3 text-critical shrink-0 mt-0.5" />
                ) : (
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                    p.classification === 'Class I' ? 'bg-critical' :
                    p.classification === 'Class II' ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] text-foreground leading-tight line-clamp-1">{p.name}</p>
                  <p className="text-[9px] text-muted-foreground font-mono">{p.classification} · {p.date}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: shortage drugs from trending */
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-mono uppercase">Shortage risk</span>
            {trending.filter(t => t.shortage_active).slice(0, 4).map((drug, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-critical shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-foreground line-clamp-1">{drug.name}</span>
                    <span className="text-[10px] font-mono text-critical shrink-0">SHORTAGE</span>
                  </div>
                  <PressureBar value={Math.min(100, drug.trend_score * 1.3)} />
                </div>
              </div>
            ))}
            {trending.filter(t => t.shortage_active).length === 0 && (
              <p className="text-[10px] text-muted-foreground">No active shortage flags in trending set.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
