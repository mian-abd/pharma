'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { ApprovalSnapshot, InfluencePanel } from '@/types/pharma';
import { formatUsd } from './hubTypes';
import HubChartSurface from './HubChartSurface';

type Props = {
  approval?: ApprovalSnapshot | null;
  influence?: InfluencePanel | null;
};

type ViewMode = 'companies' | 'specialties' | 'trend';

export default function HubSponsorPressure({ approval, influence }: Props) {
  const [view, setView] = useState<ViewMode>('companies');

  const companyData = useMemo(
    () =>
      (influence?.top_companies ?? []).slice(0, 5).map((company) => ({
        label: company.company.length > 12 ? `${company.company.slice(0, 11)}...` : company.company,
        fullLabel: company.company,
        amount: company.total_usd,
        hcps: company.hcp_count,
      })),
    [influence?.top_companies]
  );

  const specialtyData = useMemo(
    () =>
      (influence?.top_specialties ?? []).slice(0, 5).map((specialty) => ({
        label: specialty.specialty.length > 12 ? `${specialty.specialty.slice(0, 11)}...` : specialty.specialty,
        fullLabel: specialty.specialty,
        amount: specialty.total_usd,
        speakerFeePct: specialty.speaker_fee_pct,
        hcps: specialty.hcp_count,
      })),
    [influence?.top_specialties]
  );

  const yearlyTrend = useMemo(
    () =>
      (influence?.yearly_trend ?? []).slice(-6).map((year) => ({
        year: year.year,
        amount: year.total_usd,
        hcps: year.hcp_count,
      })),
    [influence?.yearly_trend]
  );

  const hasChartData = companyData.length > 0 || specialtyData.length > 0 || yearlyTrend.length > 0;

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <span className="hub-panel-title">Sponsor pressure</span>
        <div className="flex items-center gap-1">
          {(['companies', 'specialties', 'trend'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded border px-1.5 py-0.5 text-[9px] font-mono transition-colors ${
                view === mode
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {mode === 'companies' ? 'Co' : mode === 'specialties' ? 'Spec' : 'Trend'}
            </button>
          ))}
          <span className="ml-1 text-[10px] text-muted-foreground font-mono">
            {influence?.source_status?.toUpperCase() || 'LOAD'}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-2 hub-scrollbar">
        <div className="rounded border border-border/80 bg-secondary/30 p-2">
          <div className="text-[9px] text-muted-foreground font-mono">PRIMARY SPONSOR</div>
          <div className="text-[12px] font-semibold text-foreground">
            {approval?.sponsor_name || 'Sponsor unavailable'}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {[approval?.application_number || 'No application number', approval?.route || 'Route n/a'].join(' | ')}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-border/80 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">PAYMENTS</div>
            <div className="text-[12px] font-semibold text-foreground">{formatUsd(influence?.total_payments_usd ?? 0)}</div>
          </div>
          <div className="rounded border border-border/80 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">HCPS</div>
            <div className="text-[12px] font-semibold text-foreground">{influence?.hcp_count ?? 0}</div>
          </div>
          <div className="rounded border border-border/80 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">COMPANIES</div>
            <div className="text-[12px] font-semibold text-foreground">{influence?.company_count ?? 0}</div>
          </div>
        </div>

        {!hasChartData ? (
          <p className="text-[10px] text-muted-foreground">
            Open Payments trend rows are unavailable for this drug.
          </p>
        ) : (
          <HubChartSurface className="w-full" minHeight={152}>
            {({ width, height }) => {
              if (view === 'trend') {
                return (
                  <AreaChart width={width} height={height} data={yearlyTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pressureTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#13c97a" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#13c97a" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      tickFormatter={(value: number) => formatUsd(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card, #11161f)',
                        border: '1px solid var(--border, #273142)',
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                      formatter={(value, name) => {
                        const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                        return [
                          name === 'amount' ? formatUsd(numericValue) : numericValue,
                          name === 'amount' ? 'Payments' : 'HCPs',
                        ];
                      }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#13c97a" fill="url(#pressureTrend)" strokeWidth={1.8} />
                  </AreaChart>
                );
              }

              const activeData = view === 'companies' ? companyData : specialtyData;
              return (
                <BarChart width={width} height={height} data={activeData} layout="vertical" margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => formatUsd(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={72}
                    tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }}
                    axisLine={false}
                    tickLine={false}
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
                      return [formatUsd(numericValue), 'Payments'];
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                  />
                  <Bar dataKey="amount" fill={view === 'companies' ? '#f59e0b' : '#3b82f6'} radius={[0, 4, 4, 0]} />
                </BarChart>
              );
            }}
          </HubChartSurface>
        )}

        <div className="rounded border border-border/70 bg-secondary/20 px-2 py-1.5 text-[10px]">
          {view === 'trend' ? (
            <>
              <div className="font-mono text-muted-foreground">LATEST YEAR</div>
              <div className="mt-0.5 text-foreground">
                {yearlyTrend.length > 0
                  ? `${yearlyTrend[yearlyTrend.length - 1].year}: ${formatUsd(yearlyTrend[yearlyTrend.length - 1].amount)} across ${yearlyTrend[yearlyTrend.length - 1].hcps} HCPs`
                  : 'Yearly payment data unavailable'}
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-muted-foreground">
                {view === 'companies' ? 'LEADING COMPANY' : 'LEADING SPECIALTY'}
              </div>
              <div className="mt-0.5 text-foreground">
                {view === 'companies'
                  ? (companyData[0] ? `${companyData[0].fullLabel}: ${formatUsd(companyData[0].amount)} across ${companyData[0].hcps} HCPs` : 'Company rows unavailable')
                  : (specialtyData[0] ? `${specialtyData[0].fullLabel}: ${formatUsd(specialtyData[0].amount)} with ${specialtyData[0].speakerFeePct.toFixed(0)}% speaker mix` : 'Specialty rows unavailable')}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
