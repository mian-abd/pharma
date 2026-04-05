# PharmaCortex User Guide

This guide explains how to use the dashboard effectively as a general user.

## 1) Open the App

- Deployed app: https://pharma-chi-five.vercel.app/
- If running locally: `http://localhost:3000`

## 2) Search for a Drug

Use the top search bar to enter:

- Brand name
- Generic name
- Ingredient name
- Common chemical terms

Press `Enter` to load the selected drug snapshot.

## 3) Read the Dashboard

### Header

- Shows overall threat/watch status and alert count
- Contains the global ticker and quick search

### Core Panels

- **FAERS chart**: trend of adverse-event reports
- **Global overview**: source health and system-level risk
- **FDA alerts feed**: recalls, warnings, shortage updates
- **Clinical trials**: trial status and study activity
- **Market movers / market pulse**: spending and movement signals
- **Research feed**: publication and evidence cues
- **Video panel**: live/upload media sources

## 4) Customize Your Workspace

- Drag panel headers to reposition
- Resize from panel corners
- Toggle layers from the left rail
- Reset layout from the left rail if needed

## 5) Understand Status Labels

- **Critical**: high-risk or urgent safety signal
- **Warning/Elevated**: notable concern requiring review
- **Stable/Calm**: lower near-term concern
- **Live / Degraded** source labels indicate upstream feed health

## 6) Common Tips

- If one source is degraded, keep working; most panels have fallback logic.
- For best autoplay behavior in the video panel, browser policies may require muted playback.
- Use the autocomplete suggestions for faster and cleaner query resolution.

## 7) If Something Looks Wrong

- Confirm the drug spelling and try a generic/ingredient variant
- Check backend health endpoint: `http://localhost:8000/api/health`
- Refresh the page after major backend restarts

## Disclaimer

PharmaCortex is for education and analysis. It does **not** replace clinical judgment, prescribing guidance, or primary literature review.
