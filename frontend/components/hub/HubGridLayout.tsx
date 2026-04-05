'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
// Use legacy entry which has WidthProvider + Responsive (v1-compatible shim in v2)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Responsive, WidthProvider } = require('react-grid-layout/legacy') as {
  Responsive: React.ComponentType<any>;
  WidthProvider: (component: React.ComponentType<any>) => React.ComponentType<any>;
};
import React from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const LAYOUT_KEY = 'pharmacortex-layout-v3';
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const ROW_HEIGHT = 180;

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export const DEFAULT_LAYOUT_LG: LayoutItem[] = [
  { i: 'video',           x: 0,  y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'fda-alerts',      x: 4,  y: 0, w: 3, h: 2, minW: 2, minH: 1 },
  { i: 'pipeline',        x: 7,  y: 0, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'global-overview', x: 10, y: 0, w: 2, h: 1, minW: 2, minH: 1 },
  { i: 'market-movers',   x: 10, y: 1, w: 2, h: 1, minW: 2, minH: 1 },
  { i: 'faers-chart',     x: 7,  y: 1, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'clinical-trials', x: 0,  y: 2, w: 2, h: 1, minW: 2, minH: 1 },
  { i: 'supply-chain',    x: 2,  y: 2, w: 2, h: 1, minW: 2, minH: 1 },
  { i: 'signal-river',    x: 4,  y: 2, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'research',        x: 7,  y: 2, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'reg-calendar',    x: 10, y: 2, w: 2, h: 1, minW: 2, minH: 1 },
  { i: 'market-pulse',    x: 0,  y: 3, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'sponsor-pressure',x: 3,  y: 3, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'patent-cliff',    x: 6,  y: 3, w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'funding-radar',   x: 9,  y: 3, w: 3, h: 1, minW: 2, minH: 1 },
];

function loadLayouts(): Record<string, LayoutItem[]> | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveLayouts(layouts: Record<string, LayoutItem[]>) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts)); } catch { /* ignore */ }
}

type PanelId =
  | 'fda-alerts' | 'pipeline' | 'market-movers' | 'global-overview'
  | 'faers-chart' | 'clinical-trials' | 'supply-chain' | 'signal-river'
  | 'research' | 'reg-calendar' | 'market-pulse' | 'video'
  | 'sponsor-pressure' | 'patent-cliff' | 'funding-radar';

export type PanelMap = Record<PanelId, React.ReactNode>;

interface Props {
  panels: PanelMap;
  visibleLayers: Record<string, boolean>;
}

const PANEL_LAYER_MAP: Record<PanelId, string> = {
  'fda-alerts': 'fda',
  'pipeline': 'trials',
  'market-movers': 'market',
  'global-overview': 'evidence',
  'faers-chart': 'fda',
  'clinical-trials': 'trials',
  'supply-chain': 'market',
  'signal-river': 'fda',
  'research': 'evidence',
  'reg-calendar': 'fda',
  'market-pulse': 'market',
  'video': 'market',
  'sponsor-pressure': 'market',
  'patent-cliff': 'market',
  'funding-radar': 'evidence',
};

export default function HubGridLayout({ panels, visibleLayers }: Props) {
  const [layouts, setLayouts] = useState<Record<string, LayoutItem[]>>({ lg: DEFAULT_LAYOUT_LG });

  useEffect(() => {
    const saved = loadLayouts();
    if (saved) {
      setLayouts(saved);
    }
  }, []);

  const handleLayoutChange = useCallback((_layout: LayoutItem[], allLayouts: Record<string, LayoutItem[]>) => {
    setLayouts(allLayouts);
    saveLayouts(allLayouts);
  }, []);

  const handleReset = useCallback(() => {
    const fresh = { lg: DEFAULT_LAYOUT_LG };
    setLayouts(fresh);
    saveLayouts(fresh);
  }, []);

  // Expose reset to rails button
  useEffect(() => {
    (window as any).__resetPharmaLayout = handleReset;
    return () => { delete (window as any).__resetPharmaLayout; };
  }, [handleReset]);

  const items = useMemo(() =>
    (Object.entries(panels) as [PanelId, React.ReactNode][]).map(([id, content]) => {
      const layer = PANEL_LAYER_MAP[id];
      const active = visibleLayers[layer] !== false;
      return (
        <div
          key={id}
          className={`transition-all duration-200 ${active ? 'opacity-100' : 'opacity-25 grayscale'}`}
          style={{ overflow: 'hidden' }}
        >
          {/* Drag handle rendered as absolute overlay on the panel header area */}
          <div className="hub-drag-handle" />
          <div className="h-full w-full">
            {content}
          </div>
        </div>
      );
    }), [panels, visibleLayers]);

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-auto hub-scrollbar">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={[2, 2]}
        containerPadding={[2, 2]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".hub-drag-handle"
        resizeHandles={['se']}
        compactType="vertical"
        preventCollision={false}
      >
        {items}
      </ResponsiveGridLayout>
    </div>
  );
}
