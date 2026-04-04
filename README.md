# PharmaCortex

**Bloomberg Terminal-style pharmaceutical intelligence for physicians.**

PharmaCortex is a full-stack intelligence dashboard that gives physicians an adversarial, evidence-based counterweight to pharmaceutical sales representative visits. It aggregates public data from six APIs, generates AI-powered Rep Briefs using Claude, and presents everything in a high-density terminal interface modeled after financial trading systems.

---

## The Problem

Pharmaceutical sales representatives (PSRs) visit US physicians an estimated 350 million times per year. They are trained to present relative risk reductions (RRR), which can make modest absolute risk reductions (ARR) sound dramatic:

- **Rep says:** "This drug reduces your patient's cardiovascular risk by 26% (RRR)"
- **Reality:** Absolute risk reduction is 2.3% — Number Needed to Treat = 43 patients over 5 years

PharmaCortex arms physicians with the NNT, real-world vs. trial performance gaps, FAERS adverse event signals, formulary realities, and adversarial power questions — all in the 4 minutes before the rep walks in.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15)                                              │
│  SearchBar → DrugHeader → [RepBrief | FAERS | FDA] + Sidebar        │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP (proxied via Next.js API routes)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API Gateway (FastAPI)   :8000                                      │
│  ┌───────────┐  ┌───────────────┐  ┌──────────────┐                │
│  │ /api/drug │  │ /api/search   │  │ /api/health  │                │
│  └─────┬─────┘  └───────────────┘  └──────────────┘                │
│        │ asyncio.gather (parallel)                                  │
│        ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Orchestrator → Trust Score Calculator                       │   │
│  └──┬──────────┬──────────┬──────────┬──────────┬─────────────┘   │
│     │          │          │          │          │                   │
└─────┼──────────┼──────────┼──────────┼──────────┼───────────────────┘
      ▼          ▼          ▼          ▼          ▼
  Drug Res.   FAERS     Trials   Formulary  FDA Sigs   AI Synth
  (RxNorm)  (openFDA) (CT.gov)  (CMS CSV) (openFDA) (Claude API)
      │          │          │          │          │          │
      └──────────┴──────────┴─────── MongoDB ────┴──────────┘
                                  Redis Cache
                                  Celery Workers
```

---

## Data Sources

| Source | API / Endpoint | What We Fetch | Update Frequency |
|--------|---------------|---------------|-----------------|
| **RxNorm** (NLM) | `rxnav.nlm.nih.gov/REST/` | RXCUI resolution, brand/generic names, drug class | On search (TTL 30d) |
| **openFDA FAERS** | `api.fda.gov/drug/event.json` | 6-month adverse event trend, top reactions, PRR signal | Daily 02:00 UTC |
| **ClinicalTrials.gov v2** | `clinicaltrials.gov/api/v2/studies` | Trial list, phase, status, enrollment, sponsor type | Daily 03:00 UTC |
| **CMS Part D** | CMS formulary CSV files | Tier, copay estimates, PA/step therapy by payer | 1st of each month |
| **openFDA Enforcement** | `api.fda.gov/drug/enforcement.json` | Recalls, label updates, black box warnings | Hourly |
| **Claude API** (Anthropic) | `claude-sonnet-4-5` | Rep Brief: will_say, reality, power_questions, limitations | TTL 7 days |

---

## Prompt Engineering

### Rep Brief Generation

PharmaCortex uses Claude claude-sonnet-4-5 with a specialized clinical pharmacologist persona:

**System prompt design:**
- Persona: "Clinical pharmacologist and pharmaceutical industry analyst who has read every published trial for this drug"
- Stance: "Pro-evidence, not anti-pharma" — prevents the model from being generically critical
- Output format: Strict JSON enforcement with explicit schema in system prompt
- No preamble / markdown / explanation outside JSON

**Temperature strategy:**
- First attempt: `temperature=0.2` — prioritizes accuracy over creativity
- On JSON parse failure: retry with `temperature=0.1` — tighter adherence to format instructions
- Total max attempts: 2

**Data injection into prompt:**
Every Rep Brief includes NNT (trial + real-world), ARR, RRR, 6-month FAERS signal summary, FDA alert summary, active trial count, and industry vs. non-industry trial ratio. This grounds the model in actual drug-specific data rather than general training knowledge.

**Prompt version tracking:**
Each stored brief records `prompt_version="v1.0"` enabling systematic regression testing when prompts are updated.

---

## NNT Methodology

**Number Needed to Treat (NNT)** = 1 / Absolute Risk Reduction

### Trial NNT
Derived from the pivotal Phase 3 trial's absolute risk reduction endpoint:
```
ARR = Control_Event_Rate - Treatment_Event_Rate
NNT_trial = 1 / ARR
```

### Real-World NNT
Derived from post-market observational studies and registries. Typically 1.3–3× higher than trial NNT due to:
- Trial exclusion criteria removing high-risk patients
- Adherence differences (trials: 85–95%, real-world: 60–80%)
- Comorbidities not represented in trial populations

### Trust Score Formula

```python
evidence_quality  = (50 if nnt_trial else 0) + (30 if arr_trial else 0) + (20 if phase3_completed else 0)
safety_signal     = max(0, 100 - serious_ratio * 500 - (10 if signal_flag else 0))
trial_real_gap    = max(0, 100 - (nnt_rw - nnt_trial) / nnt_trial * 200) if both else 50
formulary_access  = min(100, 25 * (tier1 + tier2) + 10 * tier3)

trust_score = 0.30 * evidence_quality + 0.25 * safety_signal
            + 0.25 * trial_real_gap   + 0.20 * formulary_access
```

Score interpretation:
- **75–100**: Strong evidence base, good access, no major signals
- **50–74**: Moderate evidence, some concerns
- **0–49**: Weak evidence, significant safety signals, or poor access

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker + Docker Compose

### 1. Clone and configure

```bash
git clone <repo>
cd pharmacortex
cp .env.example .env
# Edit .env -- set ANTHROPIC_API_KEY at minimum
```

### 2. Start infrastructure

```bash
docker-compose up mongodb redis -d
```

### 3. Start the API gateway

```bash
pip install -r requirements.txt
uvicorn services.gateway.main:app --reload --port 8000
```

### 4. Start Celery worker (optional -- for background refresh)

```bash
celery -A scheduler.tasks worker --loglevel=info
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Using Docker Compose (full stack)

```bash
docker-compose up --build
```

Gateway available at: `http://localhost:8000`
Frontend available at: `http://localhost:3000` (run separately with `npm run dev`)
Swagger UI: `http://localhost:8000/docs`

---

## API Documentation

Interactive Swagger UI: `http://localhost:8000/docs`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/drug/{name}` | Full drug intelligence bundle |
| `GET` | `/api/search/autocomplete?prefix=` | Drug name suggestions |
| `GET` | `/api/health` | External API status check |

### DrugBundle response shape

```json
{
  "drug_name": "Ozempic",
  "rxcui": "2395492",
  "brand_name": "Ozempic",
  "generic_name": "semaglutide",
  "trust_score": 72.5,
  "trust_score_breakdown": {
    "evidence_quality": 100.0,
    "safety_signal": 65.0,
    "trial_real_gap": 60.0,
    "formulary_access": 50.0
  },
  "faers": { ... },
  "trials": [ ... ],
  "formulary": [ ... ],
  "fda_signals": [ ... ],
  "rep_brief": {
    "will_say": ["Reduces CV events by 26% in SUSTAIN-6 ..."],
    "reality": ["Absolute risk reduction was 2.3% over 2 years ..."],
    "power_questions": ["What was the absolute risk reduction in SUSTAIN-6?", ...],
    "study_limitations": "SUSTAIN-6 excluded patients with severe renal impairment..."
  },
  "source_statuses": {
    "faers": "live",
    "clinical_trials": "live",
    "formulary": "live",
    "fda_signals": "live",
    "ai_synthesis": "live"
  }
}
```

---

## Running Tests

```bash
# All backend tests
python -m pytest tests/ -v

# Specific test modules
python -m pytest tests/services/test_models.py -v
python -m pytest tests/gateway/test_trust_score.py -v
```

Current test coverage: **66 tests across models, cache, HTTP client, signal detection, and gateway.**

---

## Security

- All drug name inputs are validated against `[a-zA-Z0-9 \-]+` allowlist — no injection vectors
- API keys stored in environment variables only — never logged or returned in responses
- Global exception handler strips stack traces from error responses
- CORS restricted to `localhost:3000` in development
- httpx clients use TLS verification by default
- No user authentication or PII storage

---

## ⚠️ Disclaimer

**PharmaCortex is NOT for clinical use.** It is an educational tool for physician awareness.

- Drug efficacy data may be outdated or incomplete
- NNT values may not apply to individual patients
- FAERS data represents voluntary reports, not confirmed causal relationships
- Formulary data is estimated — verify with actual payer benefit documents
- Always consult primary literature before making prescribing decisions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4, Recharts, SWR |
| API Gateway | FastAPI, Pydantic v2 |
| Database | MongoDB 7.0 (Beanie ODM) |
| Cache | Redis 7 |
| AI | Anthropic Claude claude-sonnet-4-5 |
| Background Jobs | Celery 5, Celery Beat |
| HTTP Client | httpx (async, retry, pooling) |
| Data Parsing | pandas |
| Infrastructure | Docker Compose |

---

*MIT License · PharmaCortex is not affiliated with Bloomberg L.P., the FDA, CMS, or any pharmaceutical company.*
