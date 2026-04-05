'use client';

import { InfluencePanel as InfluencePanelType } from '../types/pharma';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { DollarSign, Users, Building2, TrendingUp } from 'lucide-react';

interface InfluencePanelProps {
  data: InfluencePanelType;
}

const PIE_COLORS = ['#4F46E5', '#818CF8', '#C7D2FE', '#D1D5DB', '#E5E7EB'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
      padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: 10,
    }}>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color || '#4B5563' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000
            ? `$${(p.value / 1000).toFixed(0)}k`
            : p.value}
        </div>
      ))}
    </div>
  );
};

export default function InfluencePanel({ data }: InfluencePanelProps) {
  const fmt = (v?: number) =>
    v == null ? 'N/A' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`;

  const paymentsByType = (data.payment_types ?? []).map(pt => ({
    name: pt.type, value: pt.total_usd,
  }));

  const trendData = (data.yearly_trend ?? []).map(t => ({
    year:  String(t.year),
    Total: t.total_usd,
  }));

  const avgPerHcp = data.hcp_count > 0
    ? Math.round(data.total_payments_usd / data.hcp_count)
    : 0;

  return (
    <div className="panel-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

      {/* Warning banner */}
      <div style={{
        padding: '0.3rem 0.5rem', fontSize: '0.58rem',
        background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)',
        color: 'var(--amber)', lineHeight: 1.4,
      }}>
        ⚠ CMS Open Payments estimates — based on drug class baselines, not real HCP data
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--border-dim)' }}>
        {[
          { label: 'Total Payments', value: fmt(data.total_payments_usd), color: '#4F46E5', Icon: DollarSign },
          { label: 'HCPs Paid',      value: (data.hcp_count ?? 0).toLocaleString(), color: 'var(--amber)', Icon: Users },
          { label: 'Companies',      value: String(data.company_count ?? 0), color: 'var(--text-mid)', Icon: Building2 },
          { label: 'Avg / HCP',      value: fmt(avgPerHcp), color: 'var(--text-mid)', Icon: TrendingUp },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={{ background: 'var(--bg-panel)', padding: '0.4rem 0.35rem', textAlign: 'center' }}>
            <Icon size={10} style={{ color, marginBottom: '2px' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
            <div className="metric-lbl">{label}</div>
          </div>
        ))}
      </div>

      {/* Trend chart + Pie chart side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-dim)' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '0.5rem' }}>
          <div className="panel-header panel-header-red">Year-over-Year Trend</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={trendData} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Total" fill="#4F46E5" fillOpacity={0.5} radius={[2, 2, 0, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {paymentsByType.length > 0 && (
          <div style={{ background: 'var(--bg-panel)', padding: '0.5rem' }}>
            <div className="panel-header panel-header-red">Payments by Type</div>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={paymentsByType}
                  cx="50%" cy="50%"
                  innerRadius={28} outerRadius={42}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {paymentsByType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: 10, fontSize: 11, fontFamily: 'var(--font-mono)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {paymentsByType.slice(0, 4).map((item, i) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.55rem' }}>
                  <div style={{ width: '7px', height: '7px', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span style={{ color: 'var(--text-lo)' }}>{item.name.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top companies */}
      {data.top_companies && data.top_companies.length > 0 && (
        <div style={{ background: 'var(--bg-panel)', padding: '0.5rem' }}>
          <div className="panel-header panel-header-red">
            <Building2 size={9} /> Top Paying Companies
          </div>
          {data.top_companies.slice(0, 5).map(c => {
            const max = data.top_companies[0].total_usd;
            const pct = max > 0 ? (c.total_usd / max) * 100 : 0;
            return (
              <div key={c.company} style={{ marginBottom: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.64rem', color: 'var(--text-lo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                    {c.company}
                  </span>
                  <span style={{ fontSize: '0.64rem', color: '#4F46E5', fontWeight: 600, flexShrink: 0 }}>
                    {fmt(c.total_usd)}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-red" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
