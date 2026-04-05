'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { ApprovalSnapshot, OrangeBookSnapshot } from '@/types/pharma';
import HubChartSurface from './HubChartSurface';

type Props = {
  approval?: ApprovalSnapshot | null;
  orangeBook?: OrangeBookSnapshot | null;
};

function compactDate(value: string | null | undefined) {
  if (!value) return 'n/a';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function extractYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export default function HubPatentCliff({ approval, orangeBook }: Props) {
  const patents = orangeBook?.patents ?? [];
  const exclusivities = orangeBook?.exclusivities ?? [];
  const topPatent = patents[0];
  const topExclusivity = exclusivities[0];

  const expiryTimeline = useMemo(() => {
    const buckets = new Map<number, { year: number; patents: number; exclusivities: number }>();

    for (const patent of patents) {
      const year = extractYear(patent.expire_date);
      if (!year) continue;
      const current = buckets.get(year) ?? { year, patents: 0, exclusivities: 0 };
      current.patents += 1;
      buckets.set(year, current);
    }

    for (const exclusivity of exclusivities) {
      const year = extractYear(exclusivity.expire_date);
      if (!year) continue;
      const current = buckets.get(year) ?? { year, patents: 0, exclusivities: 0 };
      current.exclusivities += 1;
      buckets.set(year, current);
    }

    return [...buckets.values()].sort((left, right) => left.year - right.year).slice(0, 7);
  }, [exclusivities, patents]);

  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <span className="hub-panel-title">Competition map</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {orangeBook?.source_status?.toUpperCase() || 'LOAD'}
        </span>
      </div>
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-2 hub-scrollbar">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-border/80 bg-secondary/30 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">APPLICATION</div>
            <div className="text-[12px] font-semibold text-foreground">
              {orangeBook?.application_number || approval?.application_number || 'n/a'}
            </div>
          </div>
          <div className="rounded border border-border/80 bg-secondary/30 p-2">
            <div className="text-[9px] text-muted-foreground font-mono">GENERIC FIELD</div>
            <div className="text-[12px] font-semibold text-foreground">
              {orangeBook?.generic_equivalent_count ?? 0}
            </div>
          </div>
        </div>

        <div className="rounded border border-border/80 p-2">
          <div className="font-mono text-[10px] text-primary">Sponsor / route</div>
          <div className="mt-1 text-[11px] text-foreground">
            {orangeBook?.applicant || approval?.sponsor_name || 'Sponsor unavailable'}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {orangeBook?.dosage_form_route || [approval?.dosage_form, approval?.route].filter(Boolean).join(' | ') || 'Route unavailable'}
          </div>
        </div>

        {expiryTimeline.length > 0 ? (
          <HubChartSurface className="w-full" minHeight={146}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={expiryTimeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-lo, #94A3B8)' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card, #11161f)',
                    border: '1px solid var(--border, #273142)',
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="patents" stackId="expiry" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="exclusivities" stackId="expiry" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </HubChartSurface>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Orange Book patent and exclusivity rows are unavailable for this query.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded border border-border/80 p-2">
            <div className="font-mono text-muted-foreground">Top patent</div>
            <div className="mt-1 text-foreground">{topPatent?.patent_number || 'None listed'}</div>
            <div className="text-muted-foreground">{compactDate(topPatent?.expire_date)}</div>
          </div>
          <div className="rounded border border-border/80 p-2">
            <div className="font-mono text-muted-foreground">Top exclusivity</div>
            <div className="mt-1 text-foreground">{topExclusivity?.code || 'None listed'}</div>
            <div className="text-muted-foreground">{compactDate(topExclusivity?.expire_date)}</div>
          </div>
        </div>

        {orangeBook?.therapeutic_equivalence_codes?.length ? (
          <div className="flex flex-wrap gap-1">
            {orangeBook.therapeutic_equivalence_codes.slice(0, 6).map((code) => (
              <span key={code} className="hub-tag-info">{code}</span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Therapeutic equivalence codes were not returned for this product.
          </p>
        )}
      </div>
    </div>
  );
}
