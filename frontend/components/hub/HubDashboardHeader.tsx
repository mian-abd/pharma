'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bell, Search, Settings, X } from 'lucide-react';
import { useAutocomplete } from '@/lib/api';

type Props = {
  selectedDrug: string | null;
  onSelectDrug: (name: string) => void;
  onClearDrug: () => void;
  tickerItems: string[];
  alertCount: number;
  threatLabel: string;
  threatLevel: 'calm' | 'watch' | 'elevated' | 'critical';
};

export default function HubDashboardHeader({
  selectedDrug,
  onSelectDrug,
  onClearDrug,
  tickerItems,
  alertCount,
  threatLabel,
  threatLevel,
}: Props) {
  const [timeStr, setTimeStr] = useState('SYNCING UTC');
  const [input, setInput] = useState(selectedDrug || '');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(selectedDrug || '');
  }, [selectedDrug]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(input), 280);
    return () => clearTimeout(timeoutId);
  }, [input]);

  useEffect(() => {
    function tick() {
      setTimeStr(
        new Date().toLocaleString('en-US', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'UTC',
        }) + ' UTC'
      );
    }

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const { suggestions } = useAutocomplete(debounced);

  useEffect(() => {
    setOpen(suggestions.length > 0 && debounced.length >= 2);
  }, [suggestions, debounced]);

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, []);

  useEffect(() => {
    function onWindowKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === '/') {
        event.preventDefault();
        document.getElementById('hub-drug-search')?.focus();
      }
    }

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);

  const onPick = useCallback(
    (name: string) => {
      setInput(name);
      setOpen(false);
      onSelectDrug(name);
    },
    [onSelectDrug]
  );

  const threatBox =
    threatLevel === 'critical'
      ? 'border-critical/30 text-critical bg-critical/8'
      : threatLevel === 'elevated'
        ? 'border-warning/30 text-warning bg-warning/8'
        : threatLevel === 'watch'
          ? 'border-primary/30 text-primary bg-primary/8'
          : 'border-border text-muted-foreground bg-secondary';

  const scrollText = tickerItems.length ? tickerItems.join('   //   ') : 'PharmaCortex command center';

  return (
    <header className="flex flex-col border-b border-border bg-card shrink-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-foreground">
              PHARMA<span className="text-primary">CORTEX</span>
            </span>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">v2</span>
          </div>
          <div className="h-4 w-px shrink-0 bg-border" />
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="hub-live-dot" />
            <span className="font-mono text-[10px] text-muted-foreground">LIVE</span>
          </div>
          <span className="hidden truncate font-mono text-[10px] uppercase text-muted-foreground md:inline">
            {timeStr}
          </span>
        </div>

        <div ref={wrapRef} className="relative flex-1 min-w-[120px] max-w-xl">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              id="hub-drug-search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && input.trim()) onPick(input.trim());
                if (event.key === 'Escape') setOpen(false);
              }}
              placeholder="Drug, ingredient, or company - Enter (press /)"
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none"
              aria-label="Drug and company search"
            />
            {selectedDrug && (
              <button type="button" onClick={onClearDrug} className="rounded p-0.5 hover:bg-muted" aria-label="Clear drug">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg hub-scrollbar">
              {suggestions.slice(0, 12).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="w-full border-b border-border/30 px-3 py-2 text-left font-mono text-[11px] text-foreground transition-colors last:border-0 hover:bg-secondary"
                  onClick={() => onPick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className={`hidden items-center rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold sm:flex ${threatBox}`}>
            {threatLabel}
          </div>
          <div className="hub-tag-info whitespace-nowrap">FDA WATCH</div>
          <div className="hub-tag-warning whitespace-nowrap">{alertCount} ALERTS</div>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <button type="button" className="hidden rounded-md p-1.5 transition-colors hover:bg-secondary sm:block">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button type="button" className="hidden rounded-md p-1.5 transition-colors hover:bg-secondary sm:block">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden border-t border-border bg-background/80">
        <div className="flex items-stretch">
          <div className="flex shrink-0 items-center rounded-r-md bg-primary px-3 text-[9px] font-bold tracking-wider text-primary-foreground">
            TICKER
          </div>
          <div className="min-w-0 flex-1 overflow-hidden py-1">
            <div className="hub-marquee-track px-2 font-mono text-[10px] text-muted-foreground">
              <span className="whitespace-nowrap pr-16">{scrollText}</span>
              <span className="whitespace-nowrap pr-16">{scrollText}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
