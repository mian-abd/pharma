'use client';

import { FAERSData } from '../types/pharma';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface AdverseEventPanelProps {
  data: FAERSData;
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'increasing') return <TrendingUp size={12} style={{ color: 'var(--accent-red)' }} />;
  if (direction === 'decreasing') return <TrendingDown size={12} style={{ color: 'var(--accent-green)' }} />;
  return <Minus size={12} style={{ color: 'var(--text-muted)' }} />;
}

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-accent)',
      padding: '6px 10px',
      fontSize: '0.7rem',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export default function AdverseEventPanel({ data }: AdverseEventPanelProps) {
  const chartData = data.monthly_data.map(m => ({
    name: MONTH_NAMES[m.month] || m.month,
    Total: m.total,
    Serious: m.serious,
    Fatal: m.fatal,
  }));

  const reactionData = data.top_reactions.slice(0, 8).map(r => ({
    name: r.reaction.length > 20 ? r.reaction.slice(0, 20) + '…' : r.reaction,
    count: r.count,
    fullName: r.reaction,
  }));

  return (
    <div className="panel-animate" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Signal banner */}
      {data.signal_flag && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0.4rem 0.6rem',
          background: 'rgba(255, 68, 68, 0.08)',
          border: '1px solid rgba(255, 68, 68, 0.3)',
          fontSize: '0.72rem',
          color: 'var(--accent-red)',
        }}>
          <AlertTriangle size={12} />
          <strong>FAERS Signal Detected</strong>
          {data.proportional_reporting_ratio && (
            <span style={{ color: 'var(--text-secondary)' }}>
              · PRR = {data.proportional_reporting_ratio.toFixed(2)}
            </span>
          )}
          <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Trend: <TrendIcon direction={data.trend_direction} />
            <span>{data.trend_direction}</span>
          </span>
        </div>
      )}

      {/* 6-month area chart */}
      <div>
        <div className="panel-header">6-Month Report Volume</div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4499ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4499ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="seriousGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ff4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#0d2040" />
            <XAxis dataKey="name" tick={{ fill: '#3a5a8a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#3a5a8a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Total" stroke="#4499ff" fill="url(#totalGrad)" strokeWidth={1.5} dot={false} name="Total" />
            <Area type="monotone" dataKey="Serious" stroke="#ff4444" fill="url(#seriousGrad)" strokeWidth={1.5} dot={false} name="Serious" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top reactions */}
      {reactionData.length > 0 && (
        <div>
          <div className="panel-header">Top Adverse Reactions</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={reactionData} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#3a5a8a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#7a9bc8', fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#4499ff" radius={[0, 2, 2, 0]} label={{ position: 'right', fill: '#7a9bc8', fontSize: 10 }} name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: '0', borderTop: '1px solid var(--border-primary)', paddingTop: '0.5rem' }}>
        {[
          { label: '6mo Reports', value: data.total_6mo_reports.toLocaleString() },
          { label: 'Serious', value: data.serious_6mo_reports.toLocaleString() },
          { label: 'Serious %', value: `${(data.serious_ratio * 100).toFixed(1)}%` },
          { label: 'Trend', value: data.trend_direction },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-primary)', padding: '0 0.5rem' }}>
            <div className="metric-label">{label}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
