'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [timeStr, setTimeStr] = useState('');
  const [input, setInput] = useState(selectedDrug || '');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(selectedDrug || '');
  }, [selectedDrug]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 280);
    return () => clearTimeout(t);
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
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { suggestions } = useAutocomplete(debounced);

  useEffect(() => {
    setOpen(suggestions.length > 0 && debounced.length >= 2);
  }, [suggestions, debounced]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('hub-drug-search')?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      ? 'border-critical text-critical bg-critical/10'
      : threatLevel === 'elevated'
        ? 'border-warning text-warning bg-warning/10'
        : threatLevel === 'watch'
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border text-muted-foreground bg-secondary';

  const scrollText = tickerItems.length ? tickerItems.join('   //   ') : 'PharmaSignal command center';

  return (
    <header className="flex flex-col border-b border-border bg-card shrink-0">
      <div className="flex items-center justify-between px-3 py-2 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm tracking-wide text-foreground whitespace-nowrap">
              PHARMA<span className="text-primary">SIGNAL</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">v2</span>
          </div>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hub-live-dot" />
            <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground uppercase truncate hidden md:inline">
            {timeStr}
          </span>
        </div>

        <div
          ref={wrapRef}
          className="flex-1 max-w-xl min-w-[120px] relative"
        >
          <div className="flex items-center gap-1 bg-secondary rounded px-2 py-1 border border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              id="hub-drug-search"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && input.trim()) onPick(input.trim());
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Drug, ingredient, or company — Enter (press /)"
              className="flex-1 bg-transparent text-[11px] text-foreground outline-none min-w-0 font-mono"
              aria-label="Drug and company search"
            />
            {selectedDrug && (
              <button type="button" onClick={onClearDrug} className="p-0.5 hover:bg-muted rounded" aria-label="Clear drug">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {open && (
            <div className="absolute z-50 left-0 right-0 top-full mt-0.5 max-h-48 overflow-y-auto hub-scrollbar bg-card border border-border rounded shadow-lg">
              {suggestions.slice(0, 12).map(s => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-[11px] font-mono hover:bg-secondary text-foreground border-b border-border/50 last:border-0"
                  onClick={() => onPick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`hidden sm:flex items-center px-2 py-1 rounded border text-[10px] font-mono font-bold ${threatBox}`}>
            {threatLabel}
          </div>
          <div className="hub-tag-info whitespace-nowrap">FDA WATCH</div>
          <div className="hub-tag-warning whitespace-nowrap">{alertCount} ALERTS</div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <button type="button" className="p-1.5 hover:bg-secondary rounded hidden sm:block">
            <Bell className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button type="button" className="p-1.5 hover:bg-secondary rounded hidden sm:block">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="border-t border-border bg-background/80 overflow-hidden">
        <div className="flex items-stretch">
          <div className="bg-primary text-primary-foreground text-[9px] font-bold px-2 flex items-center tracking-wider shrink-0">
            TICKER
          </div>
          <div className="flex-1 overflow-hidden py-1 min-w-0">
            <div className="hub-marquee-track text-[10px] font-mono text-muted-foreground px-2">
              <span className="whitespace-nowrap pr-16">{scrollText}</span>
              <span className="whitespace-nowrap pr-16">{scrollText}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
