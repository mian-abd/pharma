'use client';

import { DollarSign } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { FAERSData, TrendingDrug } from '@/types/pharma';

const MONTHS = ['', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

type Props = {
  mode: 'home' | 'drug';
  trending: TrendingDrug[];
  faers: FAERSData | null | undefined;
  drugLabel?: string;
};

export default function HubFaersChart({ mode, trending, faers, drugLabel }: Props) {
  const homeData = trending.slice(0, 7).map(t => ({
    name: t.name.length > 8 ? `${t.name.slice(0, 7)}…` : t.name,
    faers: t.faers_reports,
  }));

  const drugData = (faers?.monthly_data || []).map(m => ({
    month: MONTHS[m.month] || String(m.month),
    total: m.total,
    serious: m.serious,
  }));

  const isDrug = mode === 'drug' && drugData.length > 0;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">{isDrug ? `FAERS — ${drugLabel || 'Drug'}` : 'FAERS volume (trending)'}</span>
        </div>
        {isDrug && (
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              Total
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-critical inline-block" />
              Serious
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 p-2 min-h-[140px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={120}>
          {isDrug ? (
            <AreaChart data={drugData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="hubTot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(174, 60%, 45%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(174, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="hubSer" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(215, 12%, 50%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 12%, 50%)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 10%)',
                  border: '1px solid hsl(220, 14%, 16%)',
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Area type="monotone" dataKey="total" stroke="hsl(174, 60%, 45%)" fill="url(#hubTot)" strokeWidth={1.2} />
              <Area type="monotone" dataKey="serious" stroke="hsl(0, 70%, 55%)" fill="url(#hubSer)" strokeWidth={1.2} />
            </AreaChart>
          ) : (
            <BarChart data={homeData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215, 12%, 50%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 12%, 50%)' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 10%)',
                  border: '1px solid hsl(220, 14%, 16%)',
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="faers" fill="hsl(174, 60%, 45%)" radius={[2, 2, 0, 0]} opacity={0.9} name="FAERS reports" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
