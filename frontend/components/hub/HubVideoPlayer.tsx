'use client';

import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Play, Tv2, X, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'pharmasignal-video';

interface Channel {
  id: string;
  label: string;
  type: 'live' | 'uploads' | 'video' | 'external';
  /** YouTube channel ID or video ID, depending on type */
  ytId?: string;
  externalUrl?: string;
  note?: string;
}

const PRESET_CHANNELS: Channel[] = [
  {
    id: 'bloomberg',
    label: 'BLOOMBERG',
    type: 'live',
    ytId: 'UCIALMKvObZNtJ6AmdCLP7Lg',
    note: 'Bloomberg live financial coverage',
  },
  {
    id: 'skynews',
    label: 'SKYNEWS',
    type: 'live',
    ytId: 'UCoMdktPbSTixAyNGwb-UYkQ',
  },
  {
    id: 'euronews',
    label: 'EURONEWS',
    type: 'live',
    ytId: 'UCSrZ3UV4jOidv8ppoVuvW9Q',
  },
  {
    id: 'dw',
    label: 'DW',
    type: 'live',
    ytId: 'UCknLrEdhRCp1aegoMqRaCZg',
  },
  {
    id: 'cnbc',
    label: 'CNBC',
    type: 'live',
    ytId: 'UCvJJ_dzjViJCoLf5uKUTwoA',
  },
  {
    id: 'france24',
    label: 'FRANCE24',
    type: 'live',
    ytId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
  },
  {
    id: 'aljazeera',
    label: 'ALJAZEERA',
    type: 'live',
    ytId: 'UCGCZAYq5Xxojl_tSXcVJhiQ',
  },
  {
    id: 'medscape',
    label: 'MEDSCAPE',
    type: 'uploads',
    ytId: 'UCyw9Y26bNNhQPkydxY93jyQ',
    note: 'Healthcare commentary and explainers',
  },
  {
    id: 'stat-news',
    label: 'STAT',
    type: 'uploads',
    ytId: 'UCCFfrVCHMiJuRgDaKUMG6HA',
    note: 'Biotech and pharma reporting',
  },
  {
    id: 'fda',
    label: 'FDA',
    type: 'uploads',
    ytId: 'UCzW5CLMhGMJOJLhwbRuWvdQ',
  },
  {
    id: 'modern-healthcare',
    label: 'MODERN HC',
    type: 'external',
    externalUrl: 'https://www.modernhealthcare.com/',
    note: 'Industry-leading healthcare business reporting',
  },
  {
    id: 'kff-health-news',
    label: 'KFF NEWS',
    type: 'external',
    externalUrl: 'https://kffhealthnews.org/',
    note: 'Non-profit healthcare policy and system reporting',
  },
  {
    id: 'fierce-healthcare',
    label: 'FIERCE HC',
    type: 'external',
    externalUrl: 'https://www.fiercehealthcare.com/',
    note: 'Regulation, digital health, and healthcare deals',
  },
  {
    id: 'healthcare-dive',
    label: 'HC DIVE',
    type: 'external',
    externalUrl: 'https://www.healthcaredive.com/',
    note: 'High-frequency healthcare operations and IT updates',
  },
  {
    id: 'openmd',
    label: 'OPENMD',
    type: 'external',
    externalUrl: 'https://openmd.com/',
    note: 'Clinical reference and medical data utilities',
  },
];

function parseYouTubeUrl(input: string): { type: 'video' | 'channel' | null; id: string } {
  input = input.trim();
  // Already just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return { type: 'video', id: input };
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { type: 'channel', id: input };

  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    const v = url.searchParams.get('v');
    if (v) return { type: 'video', id: v };
    const live = url.searchParams.get('channel');
    if (live) return { type: 'channel', id: live };
    const match = url.pathname.match(/\/(?:channel|c|user)\/([^/?#]+)/);
    if (match) return { type: 'channel', id: match[1] };
    const shortMatch = url.pathname.match(/\/([a-zA-Z0-9_-]{11})$/);
    if (shortMatch) return { type: 'video', id: shortMatch[1] };
  } catch { /* not a url */ }
  return { type: null, id: '' };
}

function buildEmbedUrl(channel: Channel): string {
  if (channel.type === 'video' && channel.ytId) {
    return `https://www.youtube.com/embed/${channel.ytId}?autoplay=1&mute=1&controls=1&enablejsapi=1&rel=0`;
  }
  if (channel.type === 'uploads' && channel.ytId) {
    // Reliable fallback when a channel is not currently live
    return `https://www.youtube.com/embed?listType=user_uploads&list=${channel.ytId}&autoplay=1&mute=1&controls=1&rel=0`;
  }
  if (channel.type === 'live' && channel.ytId) {
    return `https://www.youtube.com/embed/live_stream?channel=${channel.ytId}&autoplay=1&mute=1&controls=1&enablejsapi=1&rel=0`;
  }
  return '';
}

function isValidStoredChannel(ch: unknown): ch is Channel {
  if (!ch || typeof ch !== 'object') return false;
  const o = ch as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return false;
  if (typeof o.label !== 'string' || !o.label) return false;
  const t = o.type;
  if (t !== 'live' && t !== 'uploads' && t !== 'video' && t !== 'external') return false;
  if (t === 'external') {
    return typeof o.externalUrl === 'string' && o.externalUrl.length > 0;
  }
  return typeof o.ytId === 'string' && o.ytId.length > 0;
}

export default function HubVideoPlayer() {
  const [activeChannel, setActiveChannel] = useState<Channel>(PRESET_CHANNELS[0]);
  /** YouTube/embed sources autoplay muted on load; external sites use open-in-browser only. */
  const [playing, setPlaying] = useState(true);
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState('');

  // Restore from localStorage before paint (avoids flash of default channel).
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (isValidStoredChannel(parsed)) {
        setActiveChannel(parsed);
        setPlaying(parsed.type !== 'external');
      }
    } catch { /* ignore */ }
  }, []);

  const selectChannel = useCallback((ch: Channel) => {
    setActiveChannel(ch);
    setPlaying(ch.type !== 'external');
    setCustomError('');
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ch)); } catch { /* ignore */ }
  }, []);

  const handleCustomSubmit = () => {
    const { type, id } = parseYouTubeUrl(customUrl);
    if (!type || !id) {
      setCustomError('Invalid YouTube URL or ID');
      return;
    }
    const custom: Channel = {
      id: `custom-${id}`,
      label: `CUSTOM-${type === 'video' ? 'VIDEO' : 'CHANNEL'}`,
      type: type === 'video' ? 'video' : 'uploads',
      ytId: id,
    };
    selectChannel(custom);
    setCustomUrl('');
  };

  const handlePlay = () => {
    setPlaying(true);
  };

  const embedUrl = useMemo(() => buildEmbedUrl(activeChannel), [activeChannel]);
  const canEmbed = activeChannel.type !== 'external';
  const externalUrl = activeChannel.externalUrl || (activeChannel.ytId
    ? (activeChannel.type === 'video'
      ? `https://youtube.com/watch?v=${activeChannel.ytId}`
      : `https://youtube.com/channel/${activeChannel.ytId}`)
    : undefined);

  return (
    <div className="hub-panel h-full flex flex-col">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <Tv2 className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">Live News</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(playing || activeChannel.type === 'external') && <div className="hub-live-dot" />}
          {playing && (
            <button
              onClick={() => setPlaying(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Stop"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Source tabs (inspired by monitor-style ribbon) */}
        <div className="shrink-0 border-b border-border/60">
          <div className="flex gap-1 px-2 py-1 overflow-x-auto hub-scrollbar">
            {PRESET_CHANNELS.map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => selectChannel(ch)}
                className={`text-[9px] font-mono px-2 py-0.5 border rounded-md whitespace-nowrap transition-colors ${
                  activeChannel.id === ch.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Custom URL quick input */}
          <div className="px-2 pb-1">
            <div className="flex gap-1">
              <input
                type="text"
                value={customUrl}
                onChange={e => { setCustomUrl(e.target.value); setCustomError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="Paste YouTube URL / channel ID"
                className="flex-1 bg-secondary border border-border rounded-md text-[9px] font-mono px-1.5 py-0.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="text-[9px] font-mono bg-primary text-primary-foreground px-2 py-0.5 rounded-md hover:opacity-90 transition-opacity"
              >
                ADD
              </button>
            </div>
            {customError && <p className="text-[9px] text-critical mt-0.5">{customError}</p>}
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 relative bg-black min-h-0">
          {canEmbed && playing && embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={activeChannel.label}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/80">
              <button
                type="button"
                onClick={() => {
                  if (canEmbed) handlePlay();
                  else if (externalUrl) window.open(externalUrl, '_blank', 'noopener,noreferrer');
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Play className="w-4 h-4 text-primary ml-0.5" />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground">
                  {canEmbed ? `Play ${activeChannel.label}` : `Open ${activeChannel.label}`}
                </span>
              </button>
              {activeChannel.note && (
                <p className="text-[9px] text-muted-foreground font-mono text-center px-5 leading-relaxed">
                  {activeChannel.note}
                </p>
              )}
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  Open in YouTube <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="shrink-0 px-2 py-1 text-[8px] text-muted-foreground font-mono border-t border-border/40 leading-tight">
          Live streams are muted by default (browser autoplay policy). If a source has no active stream, use uploads or open source.
        </div>
      </div>
    </div>
  );
}
