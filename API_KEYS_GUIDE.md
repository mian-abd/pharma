# PharmaCortex — API Keys & Paid Data Sources Guide

This document lists external API keys that unlock additional real-time data in PharmaCortex. All features degrade gracefully — the dashboard still works without them, using free public APIs and seed data.

---

## Currently Active (Free Public APIs)

These work out of the box with no key required:

| API | Use | Endpoint |
|-----|-----|----------|
| openFDA FAERS | Adverse event counts, top drugs, recalls | `api.fda.gov/drug/event.json` |
| openFDA Enforcement | Drug recalls, supply chain pressure | `api.fda.gov/drug/enforcement.json` |
| openFDA Drugs@FDA | Approval history, sponsor, NDA/BLA | `api.fda.gov/drug/drugsfda.json` |
| openFDA Drug Label | Black box warnings, label updates | `api.fda.gov/drug/label.json` |
| ClinicalTrials.gov v2 | Active/completed trial counts | `clinicaltrials.gov/api/v2/studies` |
| RxNorm / RxNav | Drug resolution, autocomplete, synonyms | `rxnav.nlm.nih.gov` |
| PubMed E-utilities (NCBI) | Publication counts, recent papers | `eutils.ncbi.nlm.nih.gov` |
| NIH RePORTER API v2 | Federally funded project counts, recent grants | `api.reporter.nih.gov` |
| DailyMed | Drug label version history | `dailymed.nlm.nih.gov` |
| FDA RSS Feeds | Live drug news, approvals, safety alerts | FDA website RSS |
| CMS Part D CSV | Market spend, market movers | `data.cms.gov` (free download) |
| FDA Orange Book Data Files | Patents, exclusivity, therapeutic equivalence, generic competition | FDA download ZIP |

**Optional:** Add your NCBI/PubMed API key for higher rate limits:
```env
PUBMED_EMAIL=your@email.com
```

---

## Optional Paid / Freemium APIs

### 1. Benzinga FDA Calendar API
**What it unlocks:** PDUFA decision dates, NDA/BLA filing schedules, advisory committee meetings, clinical data readouts with market cap context.  
**Replaces:** Static seed events in the Regulatory Calendar panel.  
**Sign up:** https://www.benzinga.com/apis/cloud-product/fda-calendar/  
**Pricing:** Paid subscription (contact for pricing).

**Configuration:**
```env
BENZINGA_API_KEY=your_key_here
```

**To activate in code:** Add a `benzinga_client.py` in `services/news/` calling:
```
GET https://api.benzinga.com/api/v2/calendar/fda?token={key}
```
Then replace `get_fda_regulatory_events()` in `fda_rss_client.py` with Benzinga data when key is present.

---

### 2. BioAPI
**What it unlocks:** 44 endpoints covering FDA press releases, device approvals, advisory committee calendars, PDUFA tracking, Purple Book, real-time regulatory intelligence across 15 live data sources.  
**Replaces:** FDA RSS for Regulatory Calendar + Signal River; dramatically more structured.  
**Sign up:** https://bioapi.dev/  
**Pricing:** API key required (free tier may be available).

**Configuration:**
```env
BIOAPI_KEY=your_key_here
```

**To activate:** Create `services/news/bioapi_client.py` and call endpoints like:
```
GET https://api.bioapi.dev/fda/pdufa?apiKey={key}
GET https://api.bioapi.dev/fda/advisory-committees?apiKey={key}
```

---

### 3. UnusualWhales FDA Calendar API
**What it unlocks:** FDA event calendar with catalyst type, drug info, outcomes, market cap, source links. Supports Q1-Q4 / H1-H2 target date formats.  
**Replaces:** Static Regulatory Calendar seed data.  
**Sign up:** https://api.unusualwhales.com/docs/operations/PublicApi.MarketController.fda_calendar  
**Pricing:** Subscription (also offers free tier for limited calls).

**Configuration:**
```env
UNUSUALWHALES_API_KEY=your_key_here
```

**To activate:** Create `services/news/unusualwhales_client.py` calling:
```
GET https://api.unusualwhales.com/api/fda_calendar?token={key}
```

---

### 4. NewsAPI.org
**What it unlocks:** Full-text medical and pharma news headlines from 75,000+ sources (Reuters, Bloomberg, STAT, Endpoints News, FiercePharma). Filters by keyword and domain.  
**Replaces:** FDA RSS Signal River with richer source diversity.  
**Sign up:** https://newsapi.org/  
**Pricing:** Free tier — 100 requests/day (developer plan); paid for production.

**Configuration:**
```env
NEWSAPI_KEY=your_key_here
```

**To activate:** In `services/news/fda_rss_client.py`, add:
```python
async def get_newsapi_items(query="pharmaceutical FDA drug approval", limit=20):
    url = "https://newsapi.org/v2/everything"
    data = await fetch_with_retry(url, params={
        "q": query, "language": "en", "sortBy": "publishedAt",
        "pageSize": limit, "apiKey": settings.newsapi_key
    })
    ...
```

---

### 5. openFDA API Key (Free, Rate Limit Upgrade)
**What it unlocks:** Higher rate limits (240 requests/minute vs 40/minute without key).  
**Sign up:** https://open.fda.gov/apis/authentication/  
**Pricing:** Free.

**Configuration:**
```env
OPENFDA_API_KEY=your_key_here
```

The key is already configured in `services/shared/config.py` as `openfda_api_key`. Append `?api_key={key}` to all openFDA requests in `services/shared/http_client.py` or individual clients.

---

### 6. YouTube Data API v3
**What it unlocks:** More reliable live-stream resolution for the video panel by detecting active live broadcasts per channel before embedding.  
**Fallback without key:** PharmaCortex will still resolve latest uploads and open channel/live pages directly.  
**Sign up:** https://developers.google.com/youtube/v3  
**Pricing:** Free quota with Google Cloud project.

**Configuration:**
```env
YOUTUBE_API_KEY=your_key_here
```

The app already supports the key via `services/media/youtube_client.py`.

---

## CMS Data Files (Free Downloads)

### CMS Part D Spending by Drug
Auto-downloaded by Celery task on the 2nd of each month. Can also be manually configured:

```env
CMS_PARTD_SPENDING_CSV_URL=https://data.cms.gov/sites/default/files/2025-05/56d95a8b-138c-4b60-84a5-613fbab7197f/DSD_PTD_RY25_P04_V10_DY23_BGM.csv
# OR point to a local file:
CMS_PARTD_SPENDING_CSV_PATH=/path/to/DSD_PTD_RY25_P04_V10_DY23_BGM.csv
```

### CMS Part D Geography
```env
CMS_PARTD_GEOGRAPHY_CSV_URL=https://data.cms.gov/sites/default/files/2025-04/9fe6b8a6-0cb9-4b7c-9760-87800da010a8/MUP_DPR_RY25_P04_V10_DY23_Geo.csv
# OR:
CMS_PARTD_GEOGRAPHY_CSV_PATH=/path/to/MUP_DPR_RY25_P04_V10_DY23_Geo.csv
```

### CMS Open Payments (HCP financial influence data)
```env
CMS_OPEN_PAYMENTS_CSV_URL=https://openpaymentsdata.cms.gov/...
# OR:
CMS_OPEN_PAYMENTS_CSV_PATH=/path/to/open_payments.csv
```

### FDA Orange Book Data Files
```env
ORANGE_BOOK_DATA_URL=https://www.fda.gov/media/76860/download?attachment=
# OR:
ORANGE_BOOK_DATA_PATH=/path/to/orange_book.zip
```

### NIH RePORTER
```env
NIH_REPORTER_BASE_URL=https://api.reporter.nih.gov
```

---

## Adding a New API Key

1. Add the setting to `services/shared/config.py`:
```python
your_api_key: str = ""
```

2. Add to your `.env` file:
```env
YOUR_API_KEY=key_value
```

3. Create a client in `services/news/` or the appropriate service directory.

4. Wire it into the relevant endpoint in `services/gateway/routers/news.py` or `services/gateway/dashboard_service.py`.

5. Update `source_health` in `build_dashboard_home()` to show `"live"` once the key is configured.

---

## .env Template

```env
# Free (required)
REDIS_URL=redis://localhost:6379/0

# Optional: higher rate limits
OPENFDA_API_KEY=

# Optional: more reliable YouTube live resolution
YOUTUBE_API_KEY=

# Optional: AI rep brief generation
ANTHROPIC_API_KEY=

# Optional: paid regulatory calendar
BENZINGA_API_KEY=
BIOAPI_KEY=
UNUSUALWHALES_API_KEY=

# Optional: news aggregation
NEWSAPI_KEY=

# Optional: CMS file paths
CMS_PARTD_SPENDING_CSV_PATH=
CMS_PARTD_GEOGRAPHY_CSV_PATH=
CMS_OPEN_PAYMENTS_CSV_PATH=
ORANGE_BOOK_DATA_PATH=

# Optional: PubMed rate limit (free, just needs email)
PUBMED_EMAIL=your@email.com
```
