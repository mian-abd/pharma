import useSWR from 'swr';
import type {
  AccessPanel,
  DashboardHome,
  DrugBundle,
  DrugCommandCenter,
  DrugCorePanel,
  InfluencePanel,
  MLInsightsPanel,
  NewsItem,
  RegulatoryEvent,
  SafetyPanel,
  SupplyChainData,
  TrialsPanel,
} from '../types/pharma';

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
    throw err;
  }
  return res.json();
};

// ------------------------------------------------------------------- Drug ---
// Legacy full-bundle hook (kept for backwards compatibility)
export function useDrug(name: string | null) {
  const { data, error, isLoading } = useSWR<DrugBundle>(
    name ? `/api/drug/${encodeURIComponent(name)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  return { drug: data, isLoading, isError: !!error, error };
}

export function useDashboardHome() {
  const { data, error, isLoading } = useSWR<DashboardHome>(
    '/api/dashboard/home',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  return { home: data, isLoading, isError: !!error, error };
}

export function useDashboardDrug(name: string | null) {
  const { data, error, isLoading } = useSWR<DrugCommandCenter>(
    name ? `/api/dashboard/drug/${encodeURIComponent(name)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 20000 }
  );
  return { snapshot: data, isLoading, isError: !!error, error };
}

// ----------------------------------------------------------------- Panels --

function panelKey(rxcui: string | null, panel: string, extra?: string): string | null {
  if (!rxcui) return null;
  const base = `/api/drug/${encodeURIComponent(rxcui)}/${panel}`;
  return extra ? `${base}?${extra}` : base;
}

export function useCorePanel(rxcui: string | null) {
  const { data, error, isLoading } = useSWR<DrugCorePanel>(
    panelKey(rxcui, 'core'),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  return { core: data, isLoading, isError: !!error };
}

export function useSafetyPanel(rxcui: string | null, drugName?: string) {
  const extra = drugName ? `drug_name=${encodeURIComponent(drugName)}` : undefined;
  const { data, error, isLoading } = useSWR<SafetyPanel>(
    panelKey(rxcui, 'safety', extra),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  return { safety: data, isLoading, isError: !!error };
}

export function useTrialsPanel(rxcui: string | null, drugName?: string) {
  const extra = drugName ? `drug_name=${encodeURIComponent(drugName)}` : undefined;
  const { data, error, isLoading } = useSWR<TrialsPanel>(
    panelKey(rxcui, 'trials', extra),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  return { trials: data, isLoading, isError: !!error };
}

export function useAccessPanel(rxcui: string | null, drugName?: string) {
  const extra = drugName ? `drug_name=${encodeURIComponent(drugName)}` : undefined;
  const { data, error, isLoading } = useSWR<AccessPanel>(
    panelKey(rxcui, 'access', extra),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  return { access: data, isLoading, isError: !!error };
}

export function useInfluencePanel(rxcui: string | null, drugName?: string, drugClass?: string) {
  const params = new URLSearchParams();
  if (drugName) params.set('drug_name', drugName);
  if (drugClass) params.set('drug_class', drugClass);
  const extra = params.toString() || undefined;
  const { data, error, isLoading } = useSWR<InfluencePanel>(
    panelKey(rxcui, 'influence', extra),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600000 }
  );
  return { influence: data, isLoading, isError: !!error };
}

export function useMLPanel(rxcui: string | null, drugName?: string, drugClass?: string) {
  const params = new URLSearchParams();
  if (drugName) params.set('drug_name', drugName);
  if (drugClass) params.set('drug_class', drugClass);
  const extra = params.toString() || undefined;
  const { data, error, isLoading } = useSWR<MLInsightsPanel>(
    panelKey(rxcui, 'ml', extra),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  return { ml: data, isLoading, isError: !!error };
}

// --------------------------------------------------------- News & Calendar --

export function useNewsFeed() {
  const { data, error, isLoading } = useSWR<NewsItem[]>(
    '/api/news/feed',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 1800000, refreshInterval: 1800000 }
  );
  return { news: data ?? [], isLoading, isError: !!error };
}

export function useRegulatoryCalendar() {
  const { data, error, isLoading } = useSWR<RegulatoryEvent[]>(
    '/api/regulatory/calendar',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600000, refreshInterval: 3600000 }
  );
  return { events: data ?? [], isLoading, isError: !!error };
}

export function useSupplyChain() {
  const { data, error, isLoading } = useSWR<SupplyChainData>(
    '/api/supply-chain',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600000, refreshInterval: 3600000 }
  );
  return { supply: data ?? null, isLoading, isError: !!error };
}

// ----------------------------------------------------------- Autocomplete --
export function useAutocomplete(prefix: string) {
  const { data, error } = useSWR<string[]>(
    prefix && prefix.length >= 2
      ? `/api/search/autocomplete?prefix=${encodeURIComponent(prefix)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3000 }
  );
  return {
    suggestions: data || [],
    isLoading: !error && !data && prefix.length >= 2,
    isError: !!error,
  };
}
