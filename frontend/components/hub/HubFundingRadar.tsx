'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { FundingSnapshot } from '@/types/pharma';
import { formatUsd } from './hubTypes';
import HubChartSurface from './HubChartSurface';

type Props = {
  funding?: FundingSnapshot | null;
  selectedDrug?: string | null;
};

type FundingView = 'awards' | 'projects';

export default function HubFundingRadar({ funding, selectedDrug }: Props) {
  const [view, setView] = useState<FundingView>('awards');
  const projects = funding?.recent_projects ?? [];

  const yearlyData = useMemo(() => {
    const buckets = new Map<number, { year: number; award: number; projects: number }>();

    for (const project of projects) {
      const year = project.fiscal_year ?? 0;
      if (!year) continue;
      const current = buckets.get(year) ?? { year, award: 0, projects: 0 };
      current.award += project.award_amount_usd ?? 0;
      current.projects += 1;
      buckets.set(year, current);
    }

    return [...buckets.values()].sort((left, right) => left.year - right.year).slice(-6);
  }, [projects]);

  const leadYear = yearlyData[yearlyData.length - 1] ?? null;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <span className="hub-panel-title">Federal research</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView('awards')}
            className={`rounded border px-1.5 py-0.5 text-[9px] font-mono transition-colors ${
              view === 'awards'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            Award
          </button>
          <button
            type="button"
            onClick={() => setView('projects')}
            className={`rounded border px-1.5 py-0.5 text-[9px] font-mono transition-colors ${
              view === 'projects'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            Projects
          </button>
          <span className="ml-1 text-[10px] text-muted-foreground font-mono">
            {funding?.source_status?.toUpperCase() || 'LOAD'}
          </span>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto hub-scrollbar min-h-0">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-border/80 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">MATCHES</div>
            <div className="text-[12px] font-semibold text-foreground">{funding?.matched_project_count ?? 0}</div>
          </div>
          <div className="rounded border border-border/80 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">ACTIVE</div>
            <div className="text-[12px] font-semibold text-foreground">{funding?.active_project_count ?? 0}</div>
          </div>
          <div className="rounded border border-border/80 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">AWARD</div>
            <div className="text-[12px] font-semibold text-foreground">{formatUsd(funding?.total_award_amount_usd ?? 0)}</div>
          </div>
        </div>

        {yearlyData.length === 0 ? (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {selectedDrug
              ? `No NIH RePORTER projects were matched for ${selectedDrug} yet.`
              : 'Open a drug to inspect NIH-funded project activity.'}
          </p>
        ) : (
          <>
            <div className="rounded border border-border/70 bg-secondary/20 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-mono text-muted-foreground">LATEST FISCAL SIGNAL</div>
                  <div className="text-[12px] font-semibold text-foreground">FY {leadYear?.year}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-semibold text-foreground">
                    {view === 'awards'
                      ? formatUsd(leadYear?.award ?? 0)
                      : `${leadYear?.projects ?? 0} projects`}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {formatUsd(leadYear?.award ?? 0)} total awards
                  </div>
                </div>
              </div>
            </div>

            <HubChartSurface className="w-full" minHeight={146}>
              {({ width, height }) => (
                <BarChart width={width} height={height} data={yearlyData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={(value: number) => (view === 'awards' ? formatUsd(value) : `${value}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card, #11161f)',
                      border: '1px solid var(--border, #273142)',
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                    formatter={(value) => {
                      const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                      return [
                        view === 'awards' ? formatUsd(numericValue) : `${numericValue}`,
                      view === 'awards' ? 'Award volume' : 'Project count',
                      ];
                    }}
                    labelFormatter={(label) => `FY ${label}`}
                  />
                  <Bar
                    dataKey={view === 'awards' ? 'award' : 'projects'}
                    fill={view === 'awards' ? '#f59e0b' : '#22c55e'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </HubChartSurface>
          </>
        )}

        {funding?.top_agencies?.length ? (
          <div className="flex flex-wrap gap-1">
            {funding.top_agencies.map((agency) => (
              <span key={agency} className="hub-tag-success">{agency}</span>
            ))}
          </div>
        ) : null}

        {projects.length > 0 && (
          <div className="grid grid-cols-1 gap-1">
            {projects.slice(0, 2).map((project, index) => (
              <div key={`${project.project_number || project.project_title}-${index}`} className="rounded border border-border/60 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="font-mono text-primary">{project.fiscal_year || 'FY?'}</span>
                  <span className="text-muted-foreground">{formatUsd(project.award_amount_usd)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-foreground line-clamp-2">{project.project_title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
