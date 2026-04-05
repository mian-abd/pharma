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
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hub-panel-title">{isDrug ? `FAERS — ${drugLabel || 'Drug'}` : 'FAERS volume (trending)'}</span>
        </div>
        {isDrug && (
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4F46E5' }} />
              Total
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
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
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="hubSer" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9CA3AF" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#9CA3AF" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  fontSize: 11,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              />
              <Area type="monotone" dataKey="total" stroke="#4F46E5" fill="url(#hubTot)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="serious" stroke="#9CA3AF" fill="url(#hubSer)" strokeWidth={1.5} />
            </AreaChart>
          ) : (
            <BarChart data={homeData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  fontSize: 11,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              />
              <Bar dataKey="faers" fill="#4F46E5" radius={[4, 4, 0, 0]} opacity={0.6} name="FAERS reports" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
