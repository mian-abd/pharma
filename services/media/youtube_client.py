"""Resolve livestream and upload sources for the hub video panel."""
from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.dashboard_models import MediaBriefing, MediaSource
from services.shared.http_client import fetch_bytes_with_retry, fetch_with_retry, get_client

logger = logging.getLogger(__name__)

_VIDEO_ID_RE = re.compile(r"(?:v=|/embed/|/watch/|youtu\.be/)([A-Za-z0-9_-]{11})")


@dataclass(frozen=True)
class SourcePreset:
    id: str
    label: str
    category: str
    channel_id: str | None = None
    external_url: str | None = None
    note: str | None = None
    prefer_uploads: bool = False


PRESET_SOURCES: list[SourcePreset] = [
    SourcePreset("bloomberg", "BLOOMBERG", "markets", channel_id="UCIALMKvObZNtJ6AmdCLP7Lg", note="Macro, markets, and policy context."),
    SourcePreset("cnbc", "CNBC", "markets", channel_id="UCvJJ_dzjViJCoLf5uKUTwoA", note="Live market-moving headlines and earnings context."),
    SourcePreset("skynews", "SKYNEWS", "general", channel_id="UCoMdktPbSTixAyNGwb-UYkQ", note="General live news context."),
    SourcePreset("euronews", "EURONEWS", "general", channel_id="UCSrZ3UV4jOidv8ppoVuvW9Q", note="International coverage and policy context."),
    SourcePreset("dw", "DW", "general", channel_id="UCknLrEdhRCp1aegoMqRaCZg", note="Global public-affairs coverage."),
    SourcePreset("fda", "FDA", "regulatory", channel_id="UCzW5CLMhGMJOJLhwbRuWvdQ", prefer_uploads=True, note="Official FDA briefings, explainers, and panel recordings."),
    SourcePreset("medscape", "MEDSCAPE", "clinical", channel_id="UCyw9Y26bNNhQPkydxY93jyQ", prefer_uploads=True, note="Clinical explainers and physician-oriented video."),
    SourcePreset("stat", "STAT", "industry", channel_id="UCCFfrVCHMiJuRgDaKUMG6HA", prefer_uploads=True, note="Biotech, pharma, and health-policy reporting."),
    SourcePreset("modern-healthcare", "MODERN HC", "industry", external_url="https://www.modernhealthcare.com/", note="Healthcare business reporting."),
    SourcePreset("kff-health-news", "KFF NEWS", "policy", external_url="https://kffhealthnews.org/", note="Healthcare policy and delivery system reporting."),
]


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _extract_video_id(text: str) -> str | None:
    match = _VIDEO_ID_RE.search(text or "")
    if match:
        return match.group(1)
    return None


def _embed_url_from_video(video_id: str) -> str:
    return (
        f"https://www.youtube-nocookie.com/embed/{video_id}"
        "?autoplay=1&mute=1&controls=1&enablejsapi=1&rel=0"
    )


def _channel_url(channel_id: str) -> str:
    return f"https://www.youtube.com/channel/{channel_id}"


async def _resolve_live_video_via_api(channel_id: str) -> str | None:
    if not settings.youtube_api_key:
        return None
    try:
        data = await fetch_with_retry(
            f"{settings.youtube_api_base_url}/search",
            params={
                "part": "snippet",
                "channelId": channel_id,
                "eventType": "live",
                "type": "video",
                "videoEmbeddable": "true",
                "maxResults": "1",
                "key": settings.youtube_api_key,
            },
            max_retries=1,
            base_delay=0.25,
            timeout_seconds=6.0,
        )
        items = data.get("items", []) if data else []
        if items:
            return items[0].get("id", {}).get("videoId")
    except Exception as exc:
        logger.debug("YouTube API live resolve failed for %s: %s", channel_id, exc)
    return None


async def _resolve_live_video_via_channel_page(channel_id: str) -> str | None:
    channel_live_url = f"{_channel_url(channel_id)}/live"
    try:
        async with get_client(timeout=6.0) as client:
            response = await client.get(
                channel_live_url,
                headers={"User-Agent": "PharmaCortex/1.0 LiveResolver"},
            )
            candidates = [
                str(response.url),
                response.headers.get("location", ""),
                response.text[:4000],
            ]
            for candidate in candidates:
                video_id = _extract_video_id(candidate)
                if video_id:
                    return video_id
    except Exception as exc:
        logger.debug("YouTube /live resolve failed for %s: %s", channel_id, exc)
    return None


async def _resolve_latest_upload(channel_id: str) -> tuple[str | None, str | None]:
    feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        xml_bytes = await fetch_bytes_with_retry(
            feed_url,
            max_retries=1,
            base_delay=0.25,
            timeout_seconds=6.0,
            headers={"User-Agent": "PharmaCortex/1.0 YouTubeFeed"},
        )
        if not xml_bytes:
            return None, None
        root = ET.fromstring(xml_bytes)
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "yt": "http://www.youtube.com/xml/schemas/2015",
        }
        entry = root.find("atom:entry", ns)
        if entry is None:
            return None, None
        video_id = entry.findtext("yt:videoId", default="", namespaces=ns) or None
        title = entry.findtext("atom:title", default="", namespaces=ns) or None
        return video_id, title
    except Exception as exc:
        logger.debug("YouTube uploads feed failed for %s: %s", channel_id, exc)
        return None, None


async def _resolve_source(preset: SourcePreset) -> MediaSource:
    if preset.external_url:
        return MediaSource(
            id=preset.id,
            label=preset.label,
            category=preset.category,
            status="external",
            embed_url=None,
            external_url=preset.external_url,
            note=preset.note,
            thumbnail_url=None,
            video_id=None,
        )

    if not preset.channel_id:
        return MediaSource(
            id=preset.id,
            label=preset.label,
            category=preset.category,
            status="unavailable",
            embed_url=None,
            external_url=None,
            note=preset.note,
        )

    channel_url = _channel_url(preset.channel_id)
    latest_video_id, latest_title = await _resolve_latest_upload(preset.channel_id)

    if not preset.prefer_uploads:
        live_video_id = await _resolve_live_video_via_api(preset.channel_id) or await _resolve_live_video_via_channel_page(preset.channel_id)
        if live_video_id:
            return MediaSource(
                id=preset.id,
                label=preset.label,
                category=preset.category,
                status="live",
                embed_url=_embed_url_from_video(live_video_id),
                external_url=f"https://www.youtube.com/watch?v={live_video_id}",
                note=preset.note,
                thumbnail_url=f"https://i.ytimg.com/vi/{live_video_id}/hqdefault.jpg",
                video_id=live_video_id,
            )

    if latest_video_id:
        latest_note = preset.note
        if latest_title:
            latest_note = f"{preset.note or ''} Latest upload: {latest_title}".strip()
        return MediaSource(
            id=preset.id,
            label=preset.label,
            category=preset.category,
            status="latest",
            embed_url=_embed_url_from_video(latest_video_id),
            external_url=f"https://www.youtube.com/watch?v={latest_video_id}",
            note=latest_note,
            thumbnail_url=f"https://i.ytimg.com/vi/{latest_video_id}/hqdefault.jpg",
            video_id=latest_video_id,
        )

    return MediaSource(
        id=preset.id,
        label=preset.label,
        category=preset.category,
        status="unavailable",
        embed_url=None,
        external_url=f"{channel_url}/live",
        note=preset.note or "Source unavailable right now. Open in browser for direct access.",
        thumbnail_url=None,
        video_id=None,
    )


async def get_media_briefing() -> MediaBriefing:
    cache_key = "media:briefing:v1"
    cached = await cache_get(cache_key)
    if cached:
        return MediaBriefing(**cached)

    import asyncio

    resolved = await asyncio.gather(*(_resolve_source(preset) for preset in PRESET_SOURCES), return_exceptions=True)
    sources: list[MediaSource] = []
    for preset, result in zip(PRESET_SOURCES, resolved):
        if isinstance(result, MediaSource):
            sources.append(result)
        else:
            sources.append(
                MediaSource(
                    id=preset.id,
                    label=preset.label,
                    category=preset.category,
                    status="unavailable",
                    embed_url=None,
                    external_url=preset.external_url or (f"{_channel_url(preset.channel_id)}/live" if preset.channel_id else None),
                    note=preset.note or "Resolver failed for this source.",
                )
            )

    briefing = MediaBriefing(
        generated_at=_utc_now(),
        sources=sources,
    )
    await cache_set(cache_key, briefing.model_dump(), ttl=settings.ttl_media)
    return briefing
