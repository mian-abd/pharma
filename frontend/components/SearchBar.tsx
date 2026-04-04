'use client';

import { useEffect, useRef, useState } from 'react';
import { useAutocomplete } from '../lib/api';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSelect: (drugName: string) => void;
  initialValue?: string;
}

export default function SearchBar({ onSelect, initialValue = '' }: SearchBarProps) {
  const [input, setInput] = useState(initialValue);
  const [debouncedInput, setDebouncedInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce: update query 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { suggestions } = useAutocomplete(debouncedInput);

  useEffect(() => {
    setIsOpen(suggestions.length > 0 && input.length >= 2);
    setSelectedIndex(-1);
  }, [suggestions, input]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        handleSelect(suggestions[selectedIndex]);
      } else if (input.trim()) {
        handleSelect(input.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }

  function handleSelect(name: string) {
    setInput(name);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect(name);
  }

  function handleClear() {
    setInput('');
    setDebouncedInput('');
    setIsOpen(false);
    inputRef.current?.focus();
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-accent)',
          borderColor: isOpen ? 'var(--accent-green)' : 'var(--border-accent)',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder="Search drug name (brand or generic)..."
          className="flex-1 bg-transparent outline-none"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
          aria-label="Drug search"
          aria-autocomplete="list"
          aria-controls="search-dropdown"
          aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
        />
        {input && (
          <button onClick={handleClear} aria-label="Clear search">
            <X size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          id="search-dropdown"
          role="listbox"
          className="absolute z-50 w-full"
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-accent)',
            borderTop: 'none',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {suggestions.slice(0, 15).map((s, i) => (
            <button
              key={s}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 cursor-pointer transition-colors"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                background: i === selectedIndex ? 'var(--navy-deep)' : 'transparent',
                color: i === selectedIndex ? 'var(--accent-green)' : 'var(--text-primary)',
                borderBottom: '1px solid var(--border-primary)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
