"""FDA RSS feed client -- parse press releases and drug safety announcements."""
from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional

from services.shared.cache import cache_get, cache_set
from services.shared.config import settings
from services.shared.http_client import get_client

logger = logging.getLogger(__name__)

# FDA public RSS feed URLs
FDA_PRESS_RSS_URL = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml"
FDA_DRUGS_RSS_URL = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml"
FDA_MEDWATCH_RSS_URL = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch-safety-alerts/rss.xml"

_TAG_PATTERNS = {
    "RECALL": re.compile(r"recall|withdrawal|market withdrawal", re.I),
    "SHORTAGE": re.compile(r"shortage|supply", re.I),
    "APPROVAL": re.compile(r"approv|clear|authoriz", re.I),
    "SAFETY": re.compile(r"warning|risk|adverse|black.?box|safety|alert|caution", re.I),
    "STUDY": re.compile(r"study|trial|research|clinical|data|evidence", re.I),
}


def _classify_tag(title: str, description: str) -> str:
    text = f"{title} {description}"
    for tag, pattern in _TAG_PATTERNS.items():
        if pattern.search(text):
            return tag
    return "INFO"


def _classify_severity(tag: str, title: str) -> str:
    if tag == "RECALL":
        if re.search(r"class i\b", title, re.I):
            return "critical"
        if re.search(r"class ii\b", title, re.I):
            return "high"
        return "medium"
    if tag == "SHORTAGE":
        return "high"
    if tag == "SAFETY":
        if re.search(r"black.?box|death|fatal|serious", title, re.I):
            return "critical"
        return "high"
    if tag == "APPROVAL":
        return "info"
    return "low"


def _parse_rss_date(date_str: str) -> str:
    """Parse RFC-2822 dates from RSS into ISO format."""
    if not date_str:
        return datetime.now(timezone.utc).date().isoformat()
    try:
        return parsedate_to_datetime(date_str).date().isoformat()
    except Exception:
        return date_str[:10] if len(date_str) >= 10 else date_str


def _strip_html(text: str) -> str:
    """Remove HTML tags from text."""
    return re.sub(r"<[^>]+>", "", text or "").strip()


async def _fetch_rss(url: str, timeout: float = 8.0) -> Optional[bytes]:
    """Fetch raw RSS XML bytes."""
    try:
        async with get_client(timeout=timeout) as client:
            r = await client.get(url, headers={"User-Agent": "PharmaCortex/1.0 FDA RSS Reader"})
            if r.status_code == 200:
                return r.content
    except Exception as exc:
        logger.warning("RSS fetch failed for %s: %s", url, exc)
    return None


def _parse_items(xml_bytes: bytes, source: str) -> List[dict]:
    """Parse RSS XML into normalized news item dicts."""
    items: List[dict] = []
    try:
        root = ET.fromstring(xml_bytes)
        channel = root.find("channel")
        if channel is None:
            return items
        for item in channel.findall("item"):
            title = _strip_html(item.findtext("title", ""))
            link = item.findtext("link", "") or ""
            desc = _strip_html(item.findtext("description", ""))
            pub_date = _parse_rss_date(item.findtext("pubDate", ""))
            tag = _classify_tag(title, desc)
            severity = _classify_severity(tag, title)
            items.append({
                "title": title[:200],
                "summary": desc[:400] if desc else title[:200],
                "source": source,
                "pub_date": pub_date,
                "source_url": link,
                "tag": tag,
                "severity": severity,
            })
    except ET.ParseError as exc:
        logger.warning("RSS parse error for %s: %s", source, exc)
    return items


async def get_fda_news_items(limit: int = 30) -> List[dict]:
    """
    Fetch and merge FDA press release and drug RSS feeds.
    Returns normalized list of news items, cached for 30 minutes.
    """
    cache_key = "fda:news_feed"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached[:limit]

    # Fetch both feeds concurrently
    import asyncio
    press_bytes, drugs_bytes, medwatch_bytes = await asyncio.gather(
        _fetch_rss(FDA_PRESS_RSS_URL),
        _fetch_rss(FDA_DRUGS_RSS_URL),
        _fetch_rss(FDA_MEDWATCH_RSS_URL),
        return_exceptions=True,
    )

    items: List[dict] = []
    if isinstance(press_bytes, bytes):
        items.extend(_parse_items(press_bytes, "FDA Press"))
    if isinstance(drugs_bytes, bytes):
        items.extend(_parse_items(drugs_bytes, "FDA Drugs"))
    if isinstance(medwatch_bytes, bytes):
        items.extend(_parse_items(medwatch_bytes, "MedWatch"))

    # Sort by date desc, deduplicate by title
    seen_titles: set[str] = set()
    unique: List[dict] = []
    for item in sorted(items, key=lambda x: x["pub_date"], reverse=True):
        key = item["title"][:80].lower()
        if key not in seen_titles:
            seen_titles.add(key)
            unique.append(item)

    await cache_set(cache_key, unique, ttl=1800)  # 30 minutes
    return unique[:limit]


async def get_fda_regulatory_events(limit: int = 20) -> List[dict]:
    """
    Extract regulatory calendar events from FDA drug RSS.
    Filters for approvals, advisory committee meetings, and PDUFA-type items.
    Cached for 1 hour.
    """
    cache_key = "fda:regulatory_events"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached[:limit]

    items = await get_fda_news_items(limit=100)
    approval_pattern = re.compile(
        r"approv|pdufa|adcom|advisory committee|clearance|authoriz|nda|bla|ema|who", re.I
    )
    events: List[dict] = []
    for item in items:
        if approval_pattern.search(f"{item['title']} {item['summary']}"):
            events.append({
                "date": item["pub_date"],
                "event": item["title"],
                "type": item["tag"],
                "source_url": item["source_url"],
                "source": item["source"],
                "severity": item["severity"],
            })

    await cache_set(cache_key, events, ttl=3600)
    return events[:limit]
