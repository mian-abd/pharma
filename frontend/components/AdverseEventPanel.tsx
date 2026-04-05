'use client';

import { FAERSData } from '../types/pharma';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface AdverseEventPanelProps {
  data: FAERSData;
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'increasing') return <TrendingUp size={11} style={{ color: '#B91C1C' }} />;
  if (direction === 'decreasing') return <TrendingDown size={11} style={{ color: '#065F46' }} />;
  return <Minus size={11} style={{ color: '#92400E' }} />;
}

const MONTHS = ['', 'JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
      padding: '6px 10px', fontSize: 11, fontFamily: 'var(--font-mono)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: 10,
    }}>
      <div style={{ color: 'var(--text-lo)', marginBottom: '3px' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  );
};

export default function AdverseEventPanel({ data }: AdverseEventPanelProps) {
  const chartData = data.monthly_data.map(m => ({
    name:    MONTHS[m.month] || String(m.month),
    Total:   m.total,
    Serious: m.serious,
    Fatal:   m.fatal,
  }));

  const reactionData = data.top_reactions.slice(0, 8).map(r => ({
    name:     r.reaction.length > 22 ? r.reaction.slice(0, 22) + '…' : r.reaction,
    count:    r.count,
    fullName: r.reaction,
  }));

  return (
    <div className="panel-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

      {/* Signal banner */}
      {data.signal_flag && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '0.35rem 0.55rem',
          background: 'rgba(79,70,229,0.04)',
          border: '1px solid #E5E7EB',
          fontSize: '0.65rem', color: '#B91C1C',
        }}>
          <AlertTriangle size={11} />
          <strong>FAERS SIGNAL DETECTED</strong>
          {data.proportional_reporting_ratio && (
            <span style={{ color: 'var(--text-mid)' }}>
              · PRR = {data.proportional_reporting_ratio.toFixed(2)}
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendIcon direction={data.trend_direction} />
            <span style={{ color: 'var(--text-mid)', fontSize: '0.58rem' }}>{data.trend_direction}</span>
          </span>
        </div>
      )}

      {/* Area chart */}
      <div>
        <div className="panel-header panel-header-red">6-Month Adverse Event Volume</div>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={chartData} margin={{ top: 4, right: 6, left: -26, bottom: 0 }}>
            <defs>
              <linearGradient id="totG2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="serG2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#818CF8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Total"  stroke="#4F46E5" fill="url(#totG2)" strokeWidth={1.5} dot={false} name="Total" />
            <Area type="monotone" dataKey="Serious" stroke="#818CF8" fill="url(#serG2)" strokeWidth={1.5} dot={false} name="Serious" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top reactions */}
      {reactionData.length > 0 && (
        <div>
          <div className="panel-header panel-header-red">Top Adverse Reactions (MedDRA)</div>
          <ResponsiveContainer width="100%" height={145}>
            <BarChart data={reactionData} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 9 }} width={105} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#4F46E5" fillOpacity={0.5} radius={[0, 2, 2, 0]} name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-dim)' }}>
        {[
          { label: '6mo Reports',  value: data.total_6mo_reports.toLocaleString(),  color: '#B91C1C' },
          { label: 'Serious',      value: data.serious_6mo_reports.toLocaleString(), color: '#B91C1C' },
          { label: 'Serious %',    value: `${(data.serious_ratio * 100).toFixed(1)}%`, color: '#92400E' },
          { label: 'Trend',        value: data.trend_direction,   color: data.trend_direction === 'increasing' ? '#B91C1C' : data.trend_direction === 'decreasing' ? '#065F46' : '#92400E' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-panel)', padding: '0.35rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
            <div className="metric-lbl">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
