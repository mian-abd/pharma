export function alertSeverityClass(sev: string): 'critical' | 'warning' | 'approval' | 'pending' {
  const s = sev.toLowerCase();
  if (s === 'high' || s === 'critical') return 'critical';
  if (s === 'medium' || s === 'warning') return 'warning';
  if (s === 'info' || s === 'low') return 'pending';
  return 'approval';
}

export function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function trialFromApi(t: Record<string, unknown>) {
  const interventions = (t.interventions as string[] | undefined) || [];
  const conditions = (t.conditions as string[] | undefined) || [];
  return {
    id: String(t.nct_id ?? ''),
    drug: interventions[0] || String(t.title ?? '').slice(0, 40) || 'Trial',
    sponsor: String(t.sponsor ?? ''),
    condition: conditions[0] || '',
    phase: String(t.phase ?? '').replace(/Phase\s*/gi, ''),
    enrollment: typeof t.enrollment === 'number' ? t.enrollment : 0,
    status: String(t.status ?? ''),
  };
}

export type HubLayerId = 'fda' | 'market' | 'trials' | 'evidence';

export const DEFAULT_LAYERS: Record<HubLayerId, boolean> = {
  fda: true,
  market: true,
  trials: true,
  evidence: true,
};
