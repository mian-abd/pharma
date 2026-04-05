'use client';

import { useEffect, useState } from 'react';
import { Activity, Trash2 } from 'lucide-react';

interface WatchEntry {
  name: string;
  rxcui?: string;
  signalLevel: 'critical' | 'high' | 'watch' | 'clear' | 'unknown';
  faersCount?: number;
  addedAt: number;
}

interface DrugWatchlistProps {
  selectedDrug: string;
  onSelect: (name: string) => void;
  latestDrug?: { name: string; rxcui?: string; faersCount?: number; hasSignal?: boolean };
}

const STORAGE_KEY = 'pharmasignal_watchlist';

const SIGNAL_DOT: Record<string, string> = {
  critical: 'dot-red',
  high:     'dot-red',
  watch:    'dot-amber',
  clear:    'dot-green',
  unknown:  'dot-muted',
};

const SUGGESTED = ['Ozempic', 'Humira', 'Keytruda', 'Jardiance', 'Lipitor', 'Eliquis', 'Xarelto', 'Opdivo'];

export default function DrugWatchlist({ selectedDrug, onSelect, latestDrug }: DrugWatchlistProps) {
  const [list, setList] = useState<WatchEntry[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setList(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (!latestDrug?.name) return;
    setList(prev => {
      const exists = prev.find(e => e.name.toLowerCase() === latestDrug.name.toLowerCase());
      const entry: WatchEntry = {
        name: latestDrug.name,
        rxcui: latestDrug.rxcui,
        faersCount: latestDrug.faersCount,
        signalLevel: latestDrug.hasSignal ? 'high' : 'clear',
        addedAt: Date.now(),
      };
      const updated = exists
        ? prev.map(e => e.name.toLowerCase() === latestDrug.name.toLowerCase() ? entry : e)
        : [entry, ...prev].slice(0, 20);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [latestDrug?.name, latestDrug?.hasSignal]);

  function remove(name: string) {
    setList(prev => {
      const updated = prev.filter(e => e.name !== name);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '0.45rem 0.5rem',
        borderBottom: '1px solid var(--border-mid)',
        display: 'flex', alignItems: 'center', gap: '5px',
        background: 'var(--bg-void)',
        flexShrink: 0,
      }}>
        <Activity size={10} style={{ color: 'var(--red)' }} />
        <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-lo)', textTransform: 'uppercase' }}>
          Drug Watchlist
        </span>
        {list.length > 0 && (
          <span className="badge badge-red" style={{ marginLeft: 'auto' }}>
            {list.length}
          </span>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {list.length === 0 && (
          <div style={{ padding: '0.5rem', fontSize: '0.6rem', color: 'var(--text-lo)', lineHeight: 1.6 }}>
            Search for a drug to begin tracking.
          </div>
        )}
        {list.map(entry => (
          <div
            key={entry.name}
            className={`watchlist-item ${entry.name === selectedDrug ? 'watchlist-item-active' : ''}`}
            onClick={() => onSelect(entry.name)}
          >
            <span className={SIGNAL_DOT[entry.signalLevel] || 'dot-muted'} />
            <span style={{
              flex: 1,
              color: entry.name === selectedDrug ? 'var(--text-hi)' : 'var(--text-lo)',
              fontWeight: entry.name === selectedDrug ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.65rem',
            }}>
              {entry.name}
            </span>
            {entry.faersCount != null && entry.faersCount > 0 && (
              <span style={{ fontSize: '0.55rem', color: 'var(--red)', flexShrink: 0, fontWeight: 600 }}>
                {entry.faersCount > 999 ? `${(entry.faersCount/1000).toFixed(1)}k` : entry.faersCount}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); remove(entry.name); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.4, flexShrink: 0 }}
            >
              <Trash2 size={9} style={{ color: 'var(--text-lo)' }} />
            </button>
          </div>
        ))}
      </div>

      {/* Quick launch */}
      <div style={{
        borderTop: '1px solid var(--border-mid)',
        padding: '0.4rem 0.5rem',
        flexShrink: 0,
        background: 'var(--bg-void)',
      }}>
        <div style={{ fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-lo)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
          Quick Launch
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {SUGGESTED.map(drug => (
            <button
              key={drug}
              onClick={() => onSelect(drug)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-lit)',
                color: drug === selectedDrug ? 'var(--red-bright)' : 'var(--text-lo)',
                borderColor: drug === selectedDrug ? 'var(--red-dim)' : 'var(--border-lit)',
                fontSize: '0.55rem',
                padding: '1px 5px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                transition: 'color 0.1s',
              }}
            >
              {drug}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
