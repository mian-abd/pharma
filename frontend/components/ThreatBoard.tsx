'use client';

import { DrugBundle } from '../types/pharma';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { AlertTriangle, Zap, Shield, Activity } from 'lucide-react';

interface ThreatBoardProps {
  drug: DrugBundle;
}

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const RadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0b0b15', border: '1px solid #dc2626',
      padding: '6px 10px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: '#dc2626', fontWeight: 700 }}>{payload[0]?.payload?.axis}</div>
      <div style={{ color: '#f1f5f9' }}>{payload[0]?.value?.toFixed(0)} / 100</div>
    </div>
  );
};

const AreaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0b0b15', border: '1px solid #1a1a26',
      padding: '5px 8px', fontSize: '0.62rem', fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: '#4b5563', marginBottom: 2 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

function threatLevel(score: number): { label: string; color: string; cls: string } {
  if (score < 25) return { label: 'CRITICAL', color: '#ff2020', cls: 'threat-critical' };
  if (score < 45) return { label: 'HIGH',     color: '#ef4444', cls: 'threat-high' };
  if (score < 65) return { label: 'MODERATE', color: '#f59e0b', cls: 'threat-medium' };
  if (score < 80) return { label: 'LOW',      color: '#22c55e', cls: 'threat-low' };
  return           { label: 'CLEAR',    color: '#16a34a', cls: 'threat-none' };
}

export default function ThreatBoard({ drug }: ThreatBoardProps) {
  const bd = drug.trust_score_breakdown;
  const tl = threatLevel(drug.trust_score);

  const radarData = [
    { axis: 'Evidence',    value: bd.evidence_quality  ?? 0 },
    { axis: 'Safety',      value: Math.max(0, 100 - (bd.safety_signal ?? 50)) },
    { axis: 'Trial↔RW',   value: Math.max(0, 100 - (bd.trial_real_gap ?? 50)) },
    { axis: 'Formulary',   value: bd.formulary_access  ?? 0 },
    { axis: 'Trust',       value: drug.trust_score },
  ];

  const faers    = drug.faers;
  const areaData = (faers?.monthly_data ?? []).map(m => ({
    name:   MONTH_NAMES[m.month] || String(m.month),
    Total:  m.total,
    Serious: m.serious,
    Fatal:  m.fatal,
  }));

  const hasSignal = faers?.signal_flag ?? false;
  const trend     = faers?.trend_direction ?? 'stable';
  const trendColor = trend === 'increasing' ? '#ef4444' : trend === 'decreasing' ? '#22c55e' : '#f59e0b';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'auto 1fr',
      gap: '1px',
      background: 'var(--border-dim)',
      height: '100%',
    }}>

      {/* ── TOP LEFT: Risk Radar ───────────────────────────── */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.6rem' }}>
        <div className="panel-header">
          <Shield size={9} style={{ color: 'var(--red)' }} />
          <span style={{ color: 'var(--red)' }}>Risk Profile</span>
          <span className="badge badge-red" style={{ marginLeft: 'auto' }}>
            {tl.label}
          </span>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="#1a1a26" strokeDasharray="2 2" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'var(--font-mono)' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke="#dc2626"
              fill="#dc2626"
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Score strip */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '0.25rem' }}>
          {[
            { label: 'Trust Score', value: `${drug.trust_score.toFixed(0)}`, color: tl.color },
            { label: 'NNT (Trial)', value: drug.nnt_trial ? `1:${Math.round(drug.nnt_trial)}` : 'N/A', color: '#94a3b8' },
            { label: 'ARR', value: drug.arr_trial ? `${drug.arr_trial.toFixed(1)}%` : 'N/A', color: '#94a3b8' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {value}
              </div>
              <div className="metric-lbl">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP RIGHT: FAERS signal status ─────────────────── */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.6rem' }}>
        <div className="panel-header panel-header-red">
          <AlertTriangle size={9} />
          FAERS Signal — {drug.generic_name || drug.drug_name}
          <span style={{ marginLeft: 'auto', color: trendColor, fontSize: '0.58rem', fontWeight: 700 }}>
            ▲ TREND: {trend.toUpperCase()}
          </span>
        </div>

        {hasSignal && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '0.3rem 0.5rem', marginBottom: '0.5rem',
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.35)',
            fontSize: '0.62rem', color: '#ef4444',
          }}>
            <span className="dot-red" />
            <strong>SIGNAL DETECTED</strong>
            {faers?.proportional_reporting_ratio && (
              <span style={{ color: '#94a3b8', marginLeft: '4px' }}>
                PRR = {faers.proportional_reporting_ratio.toFixed(2)}
              </span>
            )}
          </div>
        )}

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="totalG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="seriousG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="#111118" />
            <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<AreaTooltip />} />
            <Area type="monotone" dataKey="Total"  stroke="#dc2626" fill="url(#totalG)"  strokeWidth={1.5} dot={false} name="Total" />
            <Area type="monotone" dataKey="Serious" stroke="#ef4444" fill="url(#seriousG)" strokeWidth={1.5} dot={false} name="Serious" />
          </AreaChart>
        </ResponsiveContainer>

        {/* FAERS stats */}
        <div style={{ display: 'flex', gap: '1px', marginTop: '0.4rem', background: 'var(--border-dim)' }}>
          {[
            { label: '6mo Reports', value: (faers?.total_6mo_reports ?? 0).toLocaleString(), color: '#dc2626' },
            { label: 'Serious',     value: (faers?.serious_6mo_reports ?? 0).toLocaleString(), color: '#ef4444' },
            { label: 'Serious %',   value: `${((faers?.serious_ratio ?? 0) * 100).toFixed(1)}%`, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, padding: '0.3rem 0.4rem',
              background: 'var(--bg-panel)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
              <div className="metric-lbl">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM LEFT: Top adverse reactions ─────────────── */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.6rem', overflow: 'hidden' }}>
        <div className="panel-header panel-header-red">
          <Zap size={9} />
          Top Adverse Reactions
        </div>
        {(faers?.top_reactions ?? []).slice(0, 7).map((r, i) => {
          const max = faers?.top_reactions[0]?.count ?? 1;
          const pct = (r.count / max) * 100;
          return (
            <div key={r.reaction} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.62rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {r.reaction}
                </span>
                <span style={{ fontSize: '0.62rem', color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>
                  {r.count.toLocaleString()}
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-red" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {(faers?.top_reactions ?? []).length === 0 && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-lo)', textAlign: 'center', padding: '1rem 0' }}>
            No reaction data
          </div>
        )}
      </div>

      {/* ── BOTTOM RIGHT: FDA signals heat ─────────────────── */}
      <div style={{ background: 'var(--bg-panel)', padding: '0.6rem', overflowY: 'auto' }}>
        <div className="panel-header panel-header-red">
          <Activity size={9} />
          FDA Signal Heat
        </div>
        {(drug.fda_signals ?? []).slice(0, 6).map((sig, i) => {
          const isHigh = sig.severity === 'CRITICAL' || sig.is_black_box || sig.signal_type === 'SAFETY';
          return (
            <div key={i} className="signal-row">
              <span style={{
                flexShrink: 0,
                width: '52px',
                fontSize: '0.58rem',
                color: 'var(--text-lo)',
              }}>
                {sig.signal_date?.slice(0, 10) || '—'}
              </span>
              <span className={`badge ${isHigh ? 'badge-red' : sig.signal_type === 'SHORTAGE' ? 'badge-amber' : 'badge-muted'}`}
                style={{ flexShrink: 0 }}>
                {sig.signal_type}
              </span>
              <span style={{
                flex: 1,
                fontSize: '0.62rem',
                color: isHigh ? '#ef4444' : '#94a3b8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {sig.title}
              </span>
            </div>
          );
        })}
        {(drug.fda_signals ?? []).length === 0 && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-lo)', textAlign: 'center', padding: '1rem 0' }}>
            No FDA signals
          </div>
        )}
      </div>

    </div>
  );
}
