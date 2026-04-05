'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboardDrug, useDashboardHome } from '@/lib/api';
import type { HubLayerId } from './hubTypes';
import { DEFAULT_LAYERS } from './hubTypes';
import HubDashboardHeader from './HubDashboardHeader';
import HubLayersRail from './HubLayersRail';
import HubGridLayout from './HubGridLayout';
import type { PanelMap } from './HubGridLayout';
import HubFDAAlertsFeed from './HubFDAAlertsFeed';
import HubDrugPipeline from './HubDrugPipeline';
import HubMarketMovers from './HubMarketMovers';
import HubClinicalTrials from './HubClinicalTrials';
import HubMedicalNewsFeed from './HubMedicalNewsFeed';
import HubSupplyChain from './HubSupplyChain';
import HubFaersChart from './HubFaersChart';
import HubGlobalOverview from './HubGlobalOverview';
import HubResearchFeed from './HubResearchFeed';
import HubRegulatoryCalendar from './HubRegulatoryCalendar';
import HubMarketPulse from './HubMarketPulse';
import HubVideoPlayer from './HubVideoPlayer';

function threatFromData(drug: { trust_score?: number } | null, maxTrend: number) {
  if (drug && typeof drug.trust_score === 'number') {
    if (drug.trust_score < 32) return { label: 'THREAT 3', level: 'critical' as const };
    if (drug.trust_score < 48) return { label: 'THREAT 4', level: 'elevated' as const };
    if (drug.trust_score < 62) return { label: 'WATCH', level: 'watch' as const };
    return { label: 'STABLE', level: 'calm' as const };
  }
  if (maxTrend > 68) return { label: 'THREAT 3', level: 'critical' as const };
  if (maxTrend > 52) return { label: 'THREAT 4', level: 'elevated' as const };
  if (maxTrend > 38) return { label: 'WATCH', level: 'watch' as const };
  return { label: 'STABLE', level: 'calm' as const };
}

function HubDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qDrug = searchParams.get('drug') || '';

  const [selectedDrug, setSelectedDrug] = useState(qDrug);
  const [layers, setLayers] = useState<Record<HubLayerId, boolean>>({ ...DEFAULT_LAYERS });

  useEffect(() => {
    setSelectedDrug(qDrug || '');
  }, [qDrug]);

  const { home, isLoading: homeLoading, isError: homeError } = useDashboardHome();
  const { snapshot: drug, isLoading: drugLoading, isError: drugError } = useDashboardDrug(selectedDrug || null);

  const setDrug = useCallback(
    (name: string) => {
      setSelectedDrug(name);
      router.push(`/?drug=${encodeURIComponent(name)}`, { scroll: false });
    },
    [router]
  );

  const clearDrug = useCallback(() => {
    setSelectedDrug('');
    router.push('/', { scroll: false });
  }, [router]);

  const trending = home?.trending_drugs ?? [];
  const maxTrend = trending.length ? Math.max(...trending.map(t => t.trend_score)) : 0;
  const threat = threatFromData(drug ?? null, maxTrend);

  const alerts = useMemo(() => {
    if (drug?.live_alerts?.length) return drug.live_alerts;
    return home?.global_alerts ?? [];
  }, [drug, home]);

  const sourceHealth = drug?.source_health?.length ? drug.source_health : home?.source_health ?? [];
  const peerRows = drug?.peer_comparison?.rows ?? [];
  const pipelineMode = drug && peerRows.length > 0 ? 'drug' : 'home';

  const toggleLayer = (id: HubLayerId) => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const panels: PanelMap = useMemo(() => ({
    'fda-alerts': (
      <HubFDAAlertsFeed alerts={alerts} loading={homeLoading && !home} />
    ),
    'pipeline': (
      <HubDrugPipeline
        mode={pipelineMode}
        trending={trending}
        peerRows={peerRows}
        loading={(homeLoading && !home) || (!!selectedDrug && drugLoading && !drug)}
        onSelectDrug={setDrug}
      />
    ),
    'market-movers': (
      <HubMarketMovers
        movers={home?.market_movers ?? []}
        loading={homeLoading && !home}
        onSelectDrug={setDrug}
      />
    ),
    'global-overview': (
      <HubGlobalOverview
        sourceHealth={sourceHealth}
        trending={trending}
        drugTrust={drug?.trust_score ?? null}
      />
    ),
    'faers-chart': (
      <HubFaersChart
        mode={drug?.faers?.monthly_data?.length ? 'drug' : 'home'}
        trending={trending}
        faers={drug?.faers ?? undefined}
        drugLabel={drug?.brand_name || drug?.drug_name || selectedDrug || undefined}
      />
    ),
    'clinical-trials': (
      <HubClinicalTrials trials={drug?.trials ?? []} loading={!!selectedDrug && drugLoading && !drug} />
    ),
    'supply-chain': (
      <HubSupplyChain trending={trending} />
    ),
    'signal-river': (
      <HubMedicalNewsFeed alerts={alerts} />
    ),
    'research': (
      <HubResearchFeed
        publications={drug?.evidence?.recent_publications ?? []}
        placeholder={
          selectedDrug
            ? 'No PubMed hits returned for this molecule yet.'
            : undefined
        }
      />
    ),
    'reg-calendar': (
      <HubRegulatoryCalendar />
    ),
    'market-pulse': (
      <HubMarketPulse
        featured={home?.featured_watchlist ?? []}
        trending={trending}
        onSelectDrug={setDrug}
      />
    ),
    'video': (
      <HubVideoPlayer />
    ),
  }), [
    alerts, home, drug, trending, peerRows, pipelineMode,
    selectedDrug, homeLoading, drugLoading, sourceHealth, setDrug,
  ]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground font-sans">
      <HubDashboardHeader
        selectedDrug={selectedDrug || null}
        onSelectDrug={setDrug}
        onClearDrug={clearDrug}
        tickerItems={home?.ticker_items ?? []}
        alertCount={alerts.length}
        threatLabel={threat.label}
        threatLevel={threat.level}
      />

      {homeError && (
        <div className="shrink-0 bg-critical/15 border-b border-critical text-critical text-[10px] font-mono px-3 py-1">
          Gateway unreachable — start the API (`GATEWAY_URL`) or check `/api/dashboard/home`. Showing empty tiles until connected.
        </div>
      )}
      {selectedDrug && drugError && (
        <div className="shrink-0 bg-warning/15 border-b border-warning text-warning text-[10px] font-mono px-3 py-1">
          Drug snapshot failed for &quot;{selectedDrug}&quot;. Verify spelling and gateway logs.
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <HubLayersRail layers={layers} onToggle={toggleLayer} />
        <HubGridLayout panels={panels} visibleLayers={layers} />
      </div>

      {selectedDrug && drug && (
        <footer className="shrink-0 border-t border-border px-3 py-1 text-[10px] text-muted-foreground font-mono flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="text-primary font-semibold">ACTIVE: {drug.brand_name || drug.drug_name}</span>
          <span>Trust {Math.round(drug.trust_score)}</span>
          <span>{drug.trending_reason?.slice(0, 120)}</span>
          <span className="text-critical ml-auto">Not for clinical use</span>
        </footer>
      )}
    </div>
  );
}

export default function HubDashboard() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-background text-primary flex items-center justify-center font-mono text-sm">
          Initializing PharmaSignal board…
        </div>
      }
    >
      <HubDashboardInner />
    </Suspense>
  );
}
