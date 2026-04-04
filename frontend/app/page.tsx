'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SearchBar from '../components/SearchBar';
import DrugHeader from '../components/DrugHeader';
import RepBrief from '../components/RepBrief';
import AdverseEventPanel from '../components/AdverseEventPanel';
import ClinicalTrials from '../components/ClinicalTrials';
import FormularyPanel from '../components/FormularyPanel';
import FDASignalFeed from '../components/FDASignalFeed';
import AIInsightsPanel from '../components/AIInsightsPanel';
import { useDrug } from '../lib/api';
import { Activity, Clock, Terminal } from 'lucide-react';

type Tab = 'rep_brief' | 'faers' | 'fda';

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      gap: '1rem',
    }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              width: '4px',
              height: '20px',
              background: 'var(--accent-green)',
              animation: 'pulse-green 1.2s infinite',
              animationDelay: `${i * 0.15}s`,
              opacity: 0.8,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
        FETCHING PHARMACEUTICAL INTELLIGENCE...
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      gap: '0.75rem',
      textAlign: 'center',
    }}>
      <Terminal size={32} style={{ color: 'var(--text-muted)' }} />
      <div style={{ fontSize: '1rem', color: 'var(--accent-green)', fontWeight: 600 }}>
        Enter a drug name to begin
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.5 }}>
        Search by brand name (Ozempic) or generic name (semaglutide). PharmaCortex will retrieve FAERS adverse events,
        clinical trial data, formulary coverage, and generate an adversarial Rep Brief.
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        Try: Ozempic · Lipitor · Humira · Jardiance · Keytruda
      </div>
    </div>
  );
}

function UtcClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function update() {
      setTime(new Date().toUTCString().slice(17, 25) + ' UTC');
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Clock size={11} />
      {time}
    </span>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drugParam = searchParams.get('drug') || '';

  const [selectedDrug, setSelectedDrug] = useState(drugParam);
  const [activeTab, setActiveTab] = useState<Tab>('rep_brief');

  const { drug, isLoading, isError } = useDrug(selectedDrug || null);

  function handleDrugSelect(name: string) {
    setSelectedDrug(name);
    setActiveTab('rep_brief');
    router.push(`?drug=${encodeURIComponent(name)}`, { scroll: false });
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'rep_brief', label: 'Rep Brief' },
    { id: 'faers', label: 'FAERS Signals' },
    { id: 'fda', label: 'FDA Feed' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <header style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <Activity size={16} style={{ color: 'var(--accent-green)' }} />
          <span style={{
            fontWeight: 700,
            fontSize: '0.9rem',
            color: 'var(--accent-green)',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)',
          }}>
            PHARMA<span style={{ color: 'var(--text-secondary)' }}>CORTEX</span>
          </span>
        </div>

        {/* Search bar */}
        <div style={{ flex: 1, maxWidth: '480px' }}>
          <SearchBar onSelect={handleDrugSelect} initialValue={selectedDrug} />
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <UtcClock />
        </div>
      </header>

      {/* DRUG HEADER (sticky) */}
      {drug && <DrugHeader drug={drug} />}

      {/* MAIN CONTENT */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '220px 1fr 240px',
      }}>

        {/* LEFT SIDEBAR */}
        <aside style={{
          borderRight: '1px solid var(--border-primary)',
          overflowY: 'auto',
          padding: '0.75rem',
        }}>
          {drug ? (
            <>
              <div className="panel-header">Clinical Trials</div>
              <ClinicalTrials trials={drug.trials} />
            </>
          ) : (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
              Trial data will appear here
            </div>
          )}
        </aside>

        {/* CENTER CONTENT */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {isLoading && <LoadingScreen />}

          {isError && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--accent-red)',
              fontSize: '0.8rem',
            }}>
              Could not resolve drug. Check spelling or try a generic name.
            </div>
          )}

          {!isLoading && !isError && !drug && <EmptyState />}

          {drug && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Tab bar */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-primary)',
                background: 'var(--bg-panel)',
                flexShrink: 0,
              }}>
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      color: activeTab === tab.id ? 'var(--accent-green)' : 'var(--text-muted)',
                      borderBottom: activeTab === tab.id ? '2px solid var(--accent-green)' : '2px solid transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      transition: 'color 0.15s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
                {activeTab === 'rep_brief' && (
                  drug.rep_brief
                    ? <RepBrief data={drug.rep_brief} drugName={drug.drug_name} />
                    : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '2rem', textAlign: 'center' }}>
                        Rep Brief unavailable — AI synthesis failed or API key not configured.
                      </div>
                    )
                )}

                {activeTab === 'faers' && (
                  drug.faers
                    ? <AdverseEventPanel data={drug.faers} />
                    : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '2rem', textAlign: 'center' }}>
                        FAERS data unavailable
                      </div>
                    )
                )}

                {activeTab === 'fda' && (
                  <FDASignalFeed signals={drug.fda_signals} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside style={{
          borderLeft: '1px solid var(--border-primary)',
          overflowY: 'auto',
          padding: '0.75rem',
        }}>
          {drug ? (
            <>
              <div className="panel-header">AI Insights</div>
              <AIInsightsPanel drug={drug} />
              {drug.formulary.length > 0 && (
                <>
                  <div className="panel-header" style={{ marginTop: '1rem' }}>Formulary</div>
                  <FormularyPanel data={drug.formulary} />
                </>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
              Insights will appear here
            </div>
          )}
        </aside>
      </main>

      {/* STATUS BAR */}
      <footer style={{
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-primary)',
        padding: '0.25rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexShrink: 0,
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
      }}>
        <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>● LIVE</span>
        <span>Data: openFDA · ClinicalTrials.gov · RxNorm · CMS Part D · Claude API</span>
        <span style={{ marginLeft: 'auto', color: 'var(--accent-red)', fontWeight: 600 }}>
          NOT FOR CLINICAL USE · For physician education only
        </span>
      </footer>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
        LOADING...
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
