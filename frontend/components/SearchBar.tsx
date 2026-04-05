'use client';

import { useEffect, useRef, useState } from 'react';
import { useAutocomplete } from '../lib/api';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSelect: (drugName: string) => void;
  initialValue?: string;
}

export default function SearchBar({ onSelect, initialValue = '' }: SearchBarProps) {
  const [input, setInput]               = useState(initialValue);
  const [debouncedInput, setDebounced]  = useState('');
  const [isOpen, setIsOpen]             = useState(false);
  const [selectedIndex, setSelectedIdx] = useState(-1);
  const inputRef   = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    setInput(initialValue);
  }, [initialValue]);

  const { suggestions } = useAutocomplete(debouncedInput);

  useEffect(() => {
    setIsOpen(suggestions.length > 0 && input.length >= 2);
    setSelectedIdx(-1);
  }, [suggestions, input]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'Enter' && input.trim()) handleSelect(input.trim());
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) handleSelect(suggestions[selectedIndex]);
      else if (input.trim()) handleSelect(input.trim());
    } else if (e.key === 'Escape') { setIsOpen(false); }
  }

  function handleSelect(name: string) {
    setInput(name);
    setIsOpen(false);
    setSelectedIdx(-1);
    onSelect(name);
  }

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'var(--bg-input)',
        border: `1px solid ${isOpen ? 'var(--green)' : 'var(--border-lit)'}`,
        padding: '0 0.55rem',
        height: '26px',
        transition: 'border-color 0.1s',
      }}>
        <Search size={11} style={{ color: 'var(--text-lo)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder="Drug name (brand or generic)..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-hi)',
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
          }}
          aria-label="Drug search"
          aria-autocomplete="list"
          aria-controls="search-dropdown"
          aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
        />
        {input && (
          <button
            onClick={() => { setInput(''); setDebounced(''); setIsOpen(false); inputRef.current?.focus(); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            aria-label="Clear search"
          >
            <X size={10} style={{ color: 'var(--text-lo)' }} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          id="search-dropdown"
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: 'var(--bg-panel)',
            border: '1px solid rgba(34,197,94,0.22)',
            borderTop: '1px solid var(--border-mid)',
            maxHeight: '200px', overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}
        >
          {suggestions.slice(0, 12).map((s, i) => (
            <button
              key={s}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => handleSelect(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.3rem 0.6rem',
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                background: i === selectedIndex ? 'var(--bg-card)' : 'transparent',
                color: i === selectedIndex ? 'var(--green-bright)' : 'var(--text-mid)',
                borderBottom: '1px solid var(--border-dim)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {i === selectedIndex ? '▶ ' : '  '}{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
