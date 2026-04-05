'use client';

import { Layers, LayoutGrid } from 'lucide-react';
import type { HubLayerId } from './hubTypes';
import { DEFAULT_LAYERS } from './hubTypes';

const LABELS: Record<HubLayerId, string> = {
  fda: 'FDA & safety',
  market: 'Market & access',
  trials: 'Trials',
  evidence: 'Evidence / PubMed',
};

type Props = {
  layers: Record<HubLayerId, boolean>;
  onToggle: (id: HubLayerId) => void;
};

function resetLayout() {
  if (typeof window !== 'undefined' && (window as any).__resetPharmaLayout) {
    (window as any).__resetPharmaLayout();
  }
}

export default function HubLayersRail({ layers, onToggle }: Props) {
  return (
    <aside className="w-[148px] shrink-0 border-r border-border bg-card flex flex-col">
      <div className="hub-panel-header border-b border-border">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hub-panel-title">Layers</span>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground px-2 py-1.5 leading-tight">
        Toggle panes. Drag panels by their header to reposition. Resize from the bottom-right corner.
      </p>
      <div className="flex-1 overflow-y-auto hub-scrollbar px-2 pb-2 space-y-1">
        {(Object.keys(DEFAULT_LAYERS) as HubLayerId[]).map(id => (
          <label
            key={id}
            className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/60 hover:bg-secondary/60 cursor-pointer text-[10px]"
          >
            <input
              type="checkbox"
              checked={layers[id]}
              onChange={() => onToggle(id)}
              className="rounded border-border accent-primary w-3 h-3"
            />
            <span className={layers[id] ? 'text-foreground' : 'text-muted-foreground line-through'}>{LABELS[id]}</span>
          </label>
        ))}
      </div>
      <div className="shrink-0 px-2 pb-3">
        <button
          type="button"
          onClick={resetLayout}
          className="w-full flex items-center gap-1.5 justify-center text-[9px] font-mono text-muted-foreground hover:text-foreground border border-border/40 rounded-md px-2 py-1.5 hover:bg-secondary transition-colors"
          title="Reset panel layout to default"
        >
          <LayoutGrid className="w-3 h-3" />
          Reset layout
        </button>
      </div>
    </aside>
  );
}
