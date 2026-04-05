# PharmaCortex

PharmaCortex is a physician-focused pharma intelligence dashboard that helps you quickly review a drug's safety signals, evidence quality, access friction, funding, and market context.

## Live App

- Frontend (deployed): https://pharma-chi-five.vercel.app/
- Local frontend: `http://localhost:3000`
- Local API docs: `http://localhost:8000/docs`

## Who This Is For

- Clinicians preparing for rep visits
- Clinical researchers and analysts
- Product teams building clinical decision support prototypes
- Anyone who wants a fast, data-backed view of drug risk and evidence

## What You Can Do

- Search by drug / ingredient / common chemical names
- Inspect FAERS trends and serious event patterns
- Review clinical trial velocity and status
- Check formulary and market-access pressure
- Track FDA alerts, recalls, and shortage signals
- Watch live medical/news channels in the dashboard

## Product Notes

- The UI is optimized for both light and dark mode
- Dashboard panels are draggable and resizable
- Layout and watchlist preferences are saved locally in your browser
- Most data sources have graceful fallbacks if an API is unavailable

## Quick Start (Local)

### 1) Clone and configure

```bash
git clone <your-repo-url>
cd pharma
cp .env.example .env
```

At minimum, set:

```env
ANTHROPIC_API_KEY=your_key
```

Optional keys and premium data sources are documented in `API_KEYS_GUIDE.md`.

### 2) Start infrastructure (Mongo + Redis)

```bash
docker-compose up mongodb redis -d
```

### 3) Start backend API

```bash
pip install -r requirements.txt
uvicorn services.gateway.main:app --reload --port 8000
```

### 4) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional: Full Docker Compose

```bash
docker-compose up --build
```

## Deploy API on Railway (Railpack)

Use a **separate Railway service** for the backend (not the `frontend/` folder).

1. **Root Directory:** leave empty (repository root), so `requirements.txt` and the `services/` package resolve correctly.
2. **Start command:** already defined in `railpack.json`, `railway.toml`, and `Procfile`:
   `uvicorn services.gateway.main:app --host 0.0.0.0 --port $PORT`
3. **Provision** MongoDB and Redis on Railway (or set `MONGODB_URL` / `REDIS_URL` to your own instances).
4. **Environment variables** (copy from `.env.example` as needed), including:
   - `ALLOWED_ORIGINS` — include your Vercel URL, e.g. `https://pharma-chi-five.vercel.app`
   - `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY`, etc.
5. Point the Vercel frontend at the Railway URL: `GATEWAY_URL=https://<your-service>.up.railway.app`

If the build still fails, open **Build Logs** and confirm Railpack runs `pip install -r requirements.txt` from the repo root.

## Core API Endpoints

- `GET /api/dashboard/home` - dashboard landing payload
- `GET /api/dashboard/drug/{drug_name}` - focused snapshot for selected drug
- `GET /api/drug/{drug_name}` - full drug intelligence bundle
- `GET /api/search/autocomplete?prefix=` - search suggestions
- `GET /api/media/live-briefing` - media/live panel data
- `GET /api/health` - dependency health check

## Data Sources (High Level)

- RxNorm / RxNav
- openFDA (FAERS, enforcement, shortages, labels, Drugs@FDA)
- ClinicalTrials.gov
- CMS datasets (Part D / geography / open payments)
- PubMed and NIH RePORTER
- FDA RSS + Orange Book
- Anthropic Claude (for generated rep brief synthesis)

## Testing

```bash
python -m pytest tests/ -v
```

## Troubleshooting

- If frontend cannot reach API, set `GATEWAY_URL` for Next.js routes:
  - `frontend/.env.local` -> `GATEWAY_URL=http://127.0.0.1:8000`
- If Next.js acts stale after major UI changes, remove `frontend/.next` and restart dev server.
- If ports are busy:
  - Frontend uses `3000`
  - Backend uses `8000`

## Safety Disclaimer

PharmaCortex is an educational and analytical tool, not a clinical decision engine.

- Do not use as a substitute for clinical judgment
- Validate major claims against primary literature and official prescribing information
- FAERS data is signal-oriented and does not prove causality

## Tech Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS v4, SWR, Recharts
- Backend: FastAPI, Pydantic v2
- Data: MongoDB, Redis, Celery
- AI: Anthropic Claude

---

MIT License. PharmaCortex is not affiliated with Bloomberg, FDA, CMS, or any pharmaceutical company.
