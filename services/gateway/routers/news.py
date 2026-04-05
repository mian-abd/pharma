"""News, regulatory calendar, and supply chain endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Query

from services.news.fda_rss_client import get_fda_news_items, get_fda_regulatory_events
from services.news.supply_chain_client import get_supply_chain_status

router = APIRouter(prefix="/v1", tags=["news"])


@router.get("/news-feed")
async def get_news_feed(
    limit: int = Query(default=30, ge=1, le=100),
) -> list:
    """Live FDA press release and drug safety news from FDA RSS feeds."""
    return await get_fda_news_items(limit=limit)


@router.get("/regulatory-calendar")
async def get_regulatory_calendar(
    limit: int = Query(default=20, ge=1, le=50),
) -> list:
    """Regulatory events (approvals, AdCom, PDUFA) from FDA RSS + openFDA."""
    return await get_fda_regulatory_events(limit=limit)


@router.get("/supply-chain")
async def get_supply_chain() -> dict:
    """Supply chain pressure index from live FDA enforcement and shortage data."""
    return await get_supply_chain_status()
