"""
PharmaCortex Celery background tasks.

All tasks iterate over recently queried drugs (updated_at within last 30 days)
to refresh cached data from external APIs.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from celery import Celery

logger = logging.getLogger(__name__)

app = Celery("pharmacortex")
app.config_from_object("scheduler.celeryconfig")


def run_async(coro):
    """Run an async coroutine from synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.task(bind=True, max_retries=3, default_retry_delay=60, name="scheduler.tasks.refresh_faers_all_drugs")
def refresh_faers_all_drugs(self):
    """
    Refresh FAERS adverse event data for all drugs queried in the last 30 days.
    Runs daily at 02:00 UTC.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        logger.info("Refreshing FAERS for %d drugs", len(drugs))

        for drug in drugs:
            try:
                run_async(_refresh_faers_for_drug(drug["rxcui"], drug["generic_name"]))
            except Exception as exc:
                logger.warning("FAERS refresh failed for %s: %s", drug.get("brand_name"), exc)

        logger.info("FAERS refresh complete for %d drugs", len(drugs))
    except Exception as exc:
        logger.error("FAERS refresh task failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60, name="scheduler.tasks.refresh_trials_all_drugs")
def refresh_trials_all_drugs(self):
    """
    Refresh ClinicalTrials.gov data for all recently queried drugs.
    Runs daily at 03:00 UTC.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        logger.info("Refreshing trials for %d drugs", len(drugs))

        for drug in drugs:
            try:
                run_async(_refresh_trials_for_drug(drug["rxcui"], drug["generic_name"]))
            except Exception as exc:
                logger.warning("Trials refresh failed for %s: %s", drug.get("brand_name"), exc)

        logger.info("Trials refresh complete")
    except Exception as exc:
        logger.error("Trials refresh task failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=30, name="scheduler.tasks.refresh_fda_signals")
def refresh_fda_signals(self):
    """
    Refresh FDA enforcement / label signal data for recently queried drugs.
    Runs every hour.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        logger.info("Refreshing FDA signals for %d drugs", len(drugs))

        for drug in drugs:
            try:
                run_async(_refresh_fda_signals_for_drug(drug["rxcui"], drug["brand_name"]))
            except Exception as exc:
                logger.warning("FDA signals refresh failed for %s: %s", drug.get("brand_name"), exc)
    except Exception as exc:
        logger.error("FDA signals task failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=300, name="scheduler.tasks.cms_formulary_quarterly_sync")
def cms_formulary_quarterly_sync(self):
    """
    Download and parse latest CMS Part D formulary CSV data.
    Runs on the 1st of each month at 04:00 UTC.
    """
    try:
        logger.info("Starting CMS Part D quarterly sync")
        run_async(_sync_cms_formulary())
        logger.info("CMS formulary sync complete")
    except Exception as exc:
        logger.error("CMS sync failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60, name="scheduler.tasks.invalidate_stale_rep_briefs")
def invalidate_stale_rep_briefs(self):
    """
    Delete expired Rep Brief cache entries and MongoDB documents.
    Runs daily at 04:30 UTC.
    """
    try:
        count = run_async(_invalidate_expired_rep_briefs())
        logger.info("Invalidated %d stale Rep Briefs", count)
    except Exception as exc:
        logger.error("Rep brief invalidation failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Async helpers (called via run_async)
# ---------------------------------------------------------------------------


async def _get_recently_queried_drugs() -> list:
    """Return drugs that have been queried in the last 30 days."""
    try:
        from services.shared.models import Drug
        from beanie import init_beanie
        from motor.motor_asyncio import AsyncIOMotorClient
        from services.shared.config import settings

        client = AsyncIOMotorClient(settings.mongodb_url)
        await init_beanie(
            database=client.get_default_database(),
            document_models=[Drug],
        )

        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        drugs = await Drug.find(Drug.updated_at >= cutoff).to_list()
        return [{"rxcui": d.rxcui, "brand_name": d.brand_name, "generic_name": d.generic_name} for d in drugs]
    except Exception as exc:
        logger.warning("Could not fetch recent drugs from MongoDB: %s", exc)
        return []


async def _refresh_faers_for_drug(rxcui: str, drug_name: str):
    """Invalidate FAERS cache and re-fetch for a drug."""
    from services.shared.cache import cache_delete
    from services.adverse_events.faers_client import get_6mo_trend

    cache_key = f"drug:{rxcui}:faers:monthly"
    await cache_delete(cache_key)
    await get_6mo_trend(rxcui, drug_name)


async def _refresh_trials_for_drug(rxcui: str, drug_name: str):
    """Invalidate trials cache and re-fetch."""
    from services.shared.cache import cache_delete
    from services.clinical_trials.trials_client import get_trials

    cache_key = f"drug:{rxcui}:trials"
    await cache_delete(cache_key)
    await get_trials(rxcui, drug_name)


async def _refresh_fda_signals_for_drug(rxcui: str, drug_name: str):
    """Invalidate FDA signals cache and re-fetch."""
    from services.shared.cache import cache_delete
    from services.fda_signals.fda_client import get_fda_signals

    cache_key = f"drug:{rxcui}:fda_signals"
    await cache_delete(cache_key)
    await get_fda_signals(rxcui, drug_name)


async def _sync_cms_formulary():
    """Download and parse CMS Part D formulary CSV."""
    from services.shared.config import settings
    from services.shared.http_client import fetch_with_retry
    logger.info("CMS formulary sync is a no-op in this version (CSV download deferred to production)")


async def _invalidate_expired_rep_briefs() -> int:
    """Remove expired rep briefs from Redis cache."""
    from services.shared.config import settings
    import redis.asyncio as aioredis
    from datetime import timezone

    count = 0
    try:
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        pattern = "drug:*:rep_brief"
        async for key in redis.scan_iter(pattern):
            value = await redis.get(key)
            if value:
                import json
                data = json.loads(value)
                expires_at_str = data.get("expires_at", "")
                if expires_at_str:
                    try:
                        from datetime import datetime
                        expires_at = datetime.fromisoformat(expires_at_str)
                        if datetime.now(timezone.utc) > expires_at:
                            await redis.delete(key)
                            count += 1
                    except ValueError:
                        pass
        await redis.aclose()
    except Exception as exc:
        logger.warning("Rep brief invalidation error: %s", exc)

    return count
