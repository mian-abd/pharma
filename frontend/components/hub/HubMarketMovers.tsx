'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import type { MarketMover } from '@/types/pharma';
import { formatUsd } from './hubTypes';
import HubChartSurface from './HubChartSurface';

type Props = {
  movers: MarketMover[];
  loading?: boolean;
  onSelectDrug: (name: string) => void;
};

type ViewMode = 'spend' | 'growth';

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string }> = [
  { id: 'spend', label: 'Spend' },
  { id: 'growth', label: 'YoY' },
];

export default function HubMarketMovers({ movers, loading, onSelectDrug }: Props) {
  const [view, setView] = useState<ViewMode>('spend');

  const chartData = useMemo(() => {
    const ranked = [...movers].sort((left, right) =>
      view === 'spend'
        ? right.market_spend_usd - left.market_spend_usd
        : right.yoy_spend_change_pct - left.yoy_spend_change_pct
    );

    return ranked.slice(0, 6).map((mover) => ({
      ...mover,
      shortName: mover.name.length > 10 ? `${mover.name.slice(0, 9)}...` : mover.name,
      spend: mover.market_spend_usd,
      growth: Number(mover.yoy_spend_change_pct.toFixed(1)),
      color: mover.yoy_spend_change_pct >= 0 ? '#15b86a' : '#ff5b6e',
    }));
  }, [movers, view]);

  const leadMover = chartData[0] ?? null;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Market movers (Part D)</span>
        </div>
        <div className="flex items-center gap-1">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              className={`rounded border px-1.5 py-0.5 text-[9px] font-mono transition-colors ${
                view === option.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            No market snapshot rows are available yet.
          </p>
        ) : (
          <div className="flex h-full flex-col gap-2">
            <div className="rounded border border-border/70 bg-secondary/20 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-mono text-muted-foreground">
                    {view === 'spend' ? 'TOP SPEND SIGNAL' : 'FASTEST YoY CHANGE'}
                  </div>
                  <button
                    type="button"
                    onClick={() => leadMover && onSelectDrug(leadMover.name)}
                    className="text-[12px] font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {leadMover?.name || 'n/a'}
                  </button>
                </div>
                {leadMover && (
                  <div className="text-right">
                    <div className="text-[12px] font-semibold text-foreground">
                      {view === 'spend' ? formatUsd(leadMover.spend) : `${leadMover.growth >= 0 ? '+' : ''}${leadMover.growth}%`}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {formatUsd(leadMover.spend)} spend
                    </div>
                  </div>
                )}
              </div>
            </div>

            <HubChartSurface className="min-h-0 flex-1" minHeight={150}>
              {({ width, height }) => (
                <BarChart
                  width={width}
                  height={height}
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => (view === 'spend' ? formatUsd(value) : `${value}%`)}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={68}
                    tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(18, 24, 33, 0.38)' }}
                    contentStyle={{
                      backgroundColor: 'var(--card, #11161f)',
                      border: '1px solid var(--border, #273142)',
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                    formatter={(value, name) => {
                      const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                      if (name === 'spend') return [formatUsd(numericValue), 'Spend'];
                      return [`${numericValue >= 0 ? '+' : ''}${numericValue}%`, 'YoY'];
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                  />
                  <Bar
                    dataKey={view === 'spend' ? 'spend' : 'growth'}
                    radius={[0, 4, 4, 0]}
                    onClick={(entry: { payload?: { name?: string } }) => {
                      if (entry?.payload?.name) onSelectDrug(entry.payload.name);
                    }}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={view === 'spend' ? '#13c97a' : entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </HubChartSurface>

            <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-muted-foreground">
              <span>Click any bar to open the drug snapshot.</span>
              <span>{chartData.length} movers ranked</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
