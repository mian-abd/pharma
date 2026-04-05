"""Media routing for hub livestream/source resolution."""
from __future__ import annotations

from fastapi import APIRouter

from services.gateway.dashboard_service import build_media_briefing
from services.shared.dashboard_models import MediaBriefing

router = APIRouter(tags=["media"])


@router.get("/media/live-briefing", response_model=MediaBriefing)
async def get_media_briefing() -> MediaBriefing:
    return await build_media_briefing()
