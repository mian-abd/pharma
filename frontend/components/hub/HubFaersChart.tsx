'use client';

import { DollarSign } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { FAERSData, TrendingDrug } from '@/types/pharma';
import HubChartSurface from './HubChartSurface';

const MONTHS = ['', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

type Props = {
  mode: 'home' | 'drug';
  trending: TrendingDrug[];
  faers: FAERSData | null | undefined;
  drugLabel?: string;
};

export default function HubFaersChart({ mode, trending, faers, drugLabel }: Props) {
  const homeData = trending.slice(0, 7).map((trend) => ({
    name: trend.name.length > 8 ? `${trend.name.slice(0, 7)}...` : trend.name,
    faers: trend.faers_reports,
  }));

  const drugData = (faers?.monthly_data || []).map((month) => ({
    month: MONTHS[month.month] || String(month.month),
    total: month.total,
    serious: month.serious,
  }));

  const isDrug = mode === 'drug' && drugData.length > 0;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">
            {isDrug ? `FAERS - ${drugLabel || 'Drug'}` : 'FAERS volume (trending)'}
          </span>
        </div>
        {isDrug && (
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              Total
            </span>
            <span className="flex items-center gap-0.5">
              <span className="inline-block h-2 w-2 rounded-full bg-critical" />
              Serious
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 p-2 min-h-[140px] min-w-0">
        <HubChartSurface className="h-full w-full" minHeight={120}>
          {({ width, height }) =>
            isDrug ? (
              <AreaChart width={width} height={height} data={drugData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="hubTot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--blue, #3B82F6)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--blue, #3B82F6)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="hubSer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--red, #EF4444)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--red, #EF4444)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-panel, #FFF)',
                    border: '1px solid var(--border-mid, #E2E8F0)',
                    borderRadius: 8,
                    fontSize: 11,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="var(--blue, #3B82F6)" fill="url(#hubTot)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="serious" stroke="var(--red, #EF4444)" fill="url(#hubSer)" strokeWidth={1.5} />
              </AreaChart>
            ) : (
              <BarChart width={width} height={height} data={homeData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-panel, #FFF)',
                    border: '1px solid var(--border-mid, #E2E8F0)',
                    borderRadius: 8,
                    fontSize: 11,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="faers" fill="var(--blue, #3B82F6)" radius={[3, 3, 0, 0]} opacity={0.85} name="FAERS reports" />
              </BarChart>
            )
          }
        </HubChartSurface>
      </div>
    </div>
  );
}
