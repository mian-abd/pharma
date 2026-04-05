'use client';

import type { HubLayerId } from './hubTypes';

type Props = {
  visibleLayers: Record<HubLayerId, boolean>;
};

type Tile = {
  id: string;
  title: string;
  subtitle: string;
  layer: HubLayerId;
  className: string;
};

const FALLBACK_TILES: Tile[] = [
  { id: 'video', title: 'Live News', subtitle: 'Interactive stream board loads after hydration.', layer: 'market', className: 'col-span-12 lg:col-span-4 lg:row-span-2' },
  { id: 'fda-alerts', title: 'FDA Alerts', subtitle: 'Deterministic shell keeps SSR stable.', layer: 'fda', className: 'col-span-12 md:col-span-6 lg:col-span-3 lg:row-span-2' },
  { id: 'pipeline', title: 'Pipeline', subtitle: 'Class-peer and trial view attaches after mount.', layer: 'trials', className: 'col-span-12 md:col-span-6 lg:col-span-3' },
  { id: 'global-overview', title: 'Global Overview', subtitle: 'Source health and trust pulse.', layer: 'evidence', className: 'col-span-12 md:col-span-6 lg:col-span-2' },
  { id: 'market-movers', title: 'Market Movers', subtitle: 'Utilization deltas and movers.', layer: 'market', className: 'col-span-12 md:col-span-6 lg:col-span-2' },
  { id: 'faers-chart', title: 'FAERS Chart', subtitle: 'Chart widgets mount client-side.', layer: 'fda', className: 'col-span-12 md:col-span-6 lg:col-span-3' },
  { id: 'clinical-trials', title: 'Clinical Trials', subtitle: 'Recruiting and completed studies.', layer: 'trials', className: 'col-span-12 md:col-span-6 lg:col-span-2' },
  { id: 'supply-chain', title: 'Supply Chain', subtitle: 'Shortage and recall intelligence.', layer: 'market', className: 'col-span-12 md:col-span-6 lg:col-span-2' },
  { id: 'signal-river', title: 'Signal River', subtitle: 'Headline and alert feed.', layer: 'fda', className: 'col-span-12 md:col-span-6 lg:col-span-3' },
  { id: 'research', title: 'PubMed Trail', subtitle: 'Evidence and publication feed.', layer: 'evidence', className: 'col-span-12 md:col-span-6 lg:col-span-3' },
  { id: 'reg-calendar', title: 'Reg Calendar', subtitle: 'Upcoming regulatory catalysts.', layer: 'fda', className: 'col-span-12 md:col-span-6 lg:col-span-2' },
  { id: 'market-pulse', title: 'Board Pulse', subtitle: 'Hybrid trending summary.', layer: 'market', className: 'col-span-12 md:col-span-4 lg:col-span-3' },
  { id: 'sponsor-pressure', title: 'Sponsor Pressure', subtitle: 'Commercial pressure and Open Payments.', layer: 'market', className: 'col-span-12 md:col-span-4 lg:col-span-3' },
  { id: 'patent-cliff', title: 'Competition Map', subtitle: 'Orange Book competition context.', layer: 'market', className: 'col-span-12 md:col-span-4 lg:col-span-3' },
  { id: 'funding-radar', title: 'Federal Research', subtitle: 'NIH project activity and funding.', layer: 'evidence', className: 'col-span-12 md:col-span-4 lg:col-span-3' },
];

export default function HubGridFallback({ visibleLayers }: Props) {
  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-auto hub-scrollbar">
      <div className="grid grid-cols-12 gap-2 p-2 auto-rows-[180px]">
        {FALLBACK_TILES.map((tile) => {
          const active = visibleLayers[tile.layer] !== false;
          return (
            <div
              key={tile.id}
              className={`${tile.className} transition-all duration-200 ${active ? 'opacity-100' : 'opacity-25 grayscale'}`}
            >
              <div className="hub-panel h-full">
                <div className="hub-panel-header">
                  <span className="hub-panel-title">{tile.title}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">SSR</span>
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-2/3 rounded bg-secondary/80" />
                    <div className="h-2 w-full rounded bg-secondary/60" />
                    <div className="h-2 w-5/6 rounded bg-secondary/40" />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{tile.subtitle}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
