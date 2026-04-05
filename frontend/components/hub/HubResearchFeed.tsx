'use client';

import { BookOpen, ExternalLink } from 'lucide-react';
import type { PublicationSummary } from '@/types/pharma';

type Props = {
  publications: PublicationSummary[];
  placeholder?: string;
};

export default function HubResearchFeed({ publications, placeholder }: Props) {
  return (
    <div className="hub-panel h-full">
      <div className="hub-panel-header">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="hub-panel-title">PubMed trail</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{publications.length} ITEMS</span>
      </div>
      <div className="flex-1 overflow-y-auto hub-scrollbar min-h-0">
        {publications.length === 0 && (
          <p className="text-[11px] text-muted-foreground p-3 leading-relaxed">
            {placeholder ||
              'Open a drug to pull recent publications from PubMed (gateway evidence feed).'}
          </p>
        )}
        {publications.map((p, i) => (
          <a
            key={p.pmid || i}
            href={p.source_url || `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 border-b border-border/50 hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-primary font-mono">{p.journal}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{p.pub_date}</span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto" />
            </div>
            <p className="text-[11px] text-foreground leading-relaxed line-clamp-3">{p.title}</p>
            <span className="text-[9px] text-muted-foreground font-mono">PMID {p.pmid}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
