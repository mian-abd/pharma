"""
PharmaCortex Celery background tasks.

Drug tracking uses Redis sorted set (queried_drugs) populated by the
orchestrator on every drug bundle build. No MongoDB dependency required
for background refresh.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from celery import Celery

logger = logging.getLogger(__name__)

app = Celery("pharmacortex")
app.config_from_object("scheduler.celeryconfig")


def run_async(coro):
    """Run an async coroutine from a synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# FAERS refresh
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=3, default_retry_delay=60,
          name="scheduler.tasks.refresh_faers_all_drugs")
def refresh_faers_all_drugs(self):
    """
    Refresh FAERS adverse event data for drugs queried in the last 30 days.
    Runs daily at 02:00 UTC.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        logger.info("Refreshing FAERS for %d drugs", len(drugs))
        for drug in drugs:
            try:
                run_async(_refresh_faers_for_drug(drug["rxcui"], drug["drug_name"]))
            except Exception as exc:
                logger.warning("FAERS refresh failed for %s: %s", drug.get("brand_name"), exc)
        logger.info("FAERS refresh complete for %d drugs", len(drugs))
    except Exception as exc:
        logger.error("FAERS refresh task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Clinical trials refresh
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=3, default_retry_delay=60,
          name="scheduler.tasks.refresh_trials_all_drugs")
def refresh_trials_all_drugs(self):
    """
    Refresh ClinicalTrials.gov data for recently queried drugs.
    Runs daily at 03:00 UTC.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        logger.info("Refreshing trials for %d drugs", len(drugs))
        for drug in drugs:
            try:
                run_async(_refresh_trials_for_drug(drug["rxcui"], drug["drug_name"]))
            except Exception as exc:
                logger.warning("Trials refresh failed for %s: %s", drug.get("brand_name"), exc)
        logger.info("Trials refresh complete")
    except Exception as exc:
        logger.error("Trials refresh task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# FDA signals refresh
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=3, default_retry_delay=30,
          name="scheduler.tasks.refresh_fda_signals")
def refresh_fda_signals(self):
    """
    Refresh FDA enforcement/label signal data for recently queried drugs.
    Runs every hour.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        for drug in drugs:
            try:
                run_async(_refresh_fda_signals_for_drug(drug["rxcui"], drug["brand_name"]))
            except Exception as exc:
                logger.warning("FDA signals refresh failed for %s: %s", drug.get("brand_name"), exc)
    except Exception as exc:
        logger.error("FDA signals task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Shortage status refresh
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=3, default_retry_delay=60,
          name="scheduler.tasks.refresh_shortage_status")
def refresh_shortage_status(self):
    """
    Refresh drug shortage status for recently queried drugs.
    Runs every hour alongside FDA signals.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        for drug in drugs:
            try:
                run_async(_refresh_shortage_for_drug(drug["rxcui"], drug["drug_name"]))
            except Exception as exc:
                logger.warning("Shortage refresh failed for %s: %s", drug.get("brand_name"), exc)
    except Exception as exc:
        logger.error("Shortage refresh task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Label history refresh (DailyMed)
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=2, default_retry_delay=120,
          name="scheduler.tasks.refresh_label_history")
def refresh_label_history(self):
    """
    Refresh DailyMed label history for recently queried drugs.
    Runs daily at 05:00 UTC.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        for drug in drugs:
            try:
                run_async(_refresh_label_history_for_drug(drug["rxcui"], drug["drug_name"]))
            except Exception as exc:
                logger.warning("Label history refresh failed for %s: %s", drug.get("brand_name"), exc)
    except Exception as exc:
        logger.error("Label history refresh task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Influence panel refresh (Open Payments)
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=2, default_retry_delay=300,
          name="scheduler.tasks.refresh_influence_panels")
def refresh_influence_panels(self):
    """
    Refresh Open Payments influence panels for recently queried drugs.
    Runs weekly (payments data refreshes infrequently).
    """
    try:
        drugs = run_async(_get_recently_queried_drugs())
        logger.info("Refreshing influence panels for %d drugs", len(drugs))
        for drug in drugs:
            try:
                run_async(_refresh_influence_for_drug(
                    drug["rxcui"], drug["drug_name"], drug.get("drug_class", "")
                ))
            except Exception as exc:
                logger.warning("Influence refresh failed for %s: %s", drug.get("brand_name"), exc)
    except Exception as exc:
        logger.error("Influence refresh task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# CMS Formulary quarterly sync
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=2, default_retry_delay=300,
          name="scheduler.tasks.cms_formulary_quarterly_sync")
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


# ---------------------------------------------------------------------------
# Rep Brief invalidation
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=3, default_retry_delay=60,
          name="scheduler.tasks.invalidate_stale_rep_briefs")
def invalidate_stale_rep_briefs(self):
    """
    Delete expired Rep Brief cache entries.
    Runs daily at 04:30 UTC.
    """
    try:
        count = run_async(_invalidate_expired_rep_briefs())
        logger.info("Invalidated %d stale Rep Briefs", count)
    except Exception as exc:
        logger.error("Rep brief invalidation failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Bundle cache invalidation (stale-while-revalidate support)
# ---------------------------------------------------------------------------

@app.task(bind=True, max_retries=2, default_retry_delay=60,
          name="scheduler.tasks.invalidate_stale_bundles")
def invalidate_stale_bundles(self):
    """
    Invalidate full drug bundles for recently queried drugs so the next
    request triggers a fresh parallel fetch. Runs every 2 hours.
    """
    try:
        drugs = run_async(_get_recently_queried_drugs(lookback_days=7))
        count = 0
        for drug in drugs:
            run_async(_invalidate_bundle(drug["rxcui"]))
            count += 1
        logger.info("Invalidated %d drug bundles", count)
    except Exception as exc:
        logger.error("Bundle invalidation task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Async helpers
# ---------------------------------------------------------------------------

async def _get_recently_queried_drugs(lookback_days: int = 30) -> list:
    """Return drugs queried in the last N days from Redis sorted set."""
    from services.shared.cache import cache_get_recent_drugs
    return await cache_get_recent_drugs(lookback_days)


async def _refresh_faers_for_drug(rxcui: str, drug_name: str):
    from services.shared.cache import cache_delete
    from services.adverse_events.faers_client import get_6mo_trend
    await cache_delete(f"drug:{rxcui}:faers:monthly")
    await cache_delete(f"panel:{rxcui}:safety")
    await get_6mo_trend(rxcui, drug_name)


async def _refresh_trials_for_drug(rxcui: str, drug_name: str):
    from services.shared.cache import cache_delete
    from services.clinical_trials.trials_client import get_trials
    await cache_delete(f"drug:{rxcui}:trials")
    await cache_delete(f"panel:{rxcui}:trials")
    await get_trials(rxcui, drug_name)


async def _refresh_fda_signals_for_drug(rxcui: str, drug_name: str):
    from services.shared.cache import cache_delete
    from services.fda_signals.fda_client import get_fda_signals
    await cache_delete(f"drug:{rxcui}:fda_signals")
    await cache_delete(f"panel:{rxcui}:safety")
    await get_fda_signals(rxcui, drug_name)


async def _refresh_shortage_for_drug(rxcui: str, drug_name: str):
    from services.shared.cache import cache_delete
    from services.fda_signals.shortage_client import get_shortage_status
    await cache_delete(f"drug:{rxcui}:shortage")
    await get_shortage_status(rxcui, drug_name)


async def _refresh_label_history_for_drug(rxcui: str, drug_name: str):
    from services.shared.cache import cache_delete
    from services.dailymed.dailymed_client import get_label_history
    await cache_delete(f"drug:{rxcui}:label_history")
    await get_label_history(rxcui, drug_name)


async def _refresh_influence_for_drug(rxcui: str, drug_name: str, drug_class: str = ""):
    from services.shared.cache import cache_delete
    from services.open_payments.payments_client import get_influence_panel
    await cache_delete(f"drug:{rxcui}:influence")
    await cache_delete(f"panel:{rxcui}:influence")
    await get_influence_panel(rxcui, drug_name, drug_class)


async def _invalidate_bundle(rxcui: str):
    from services.shared.cache import cache_delete
    await cache_delete(f"drug:{rxcui}:bundle")
    await cache_delete(f"panel:{rxcui}:core")
    await cache_delete(f"dashboard:{rxcui}:snapshot")


@app.task(bind=True, max_retries=2, default_retry_delay=600,
          name="scheduler.tasks.download_cms_partd_spending")
def download_cms_partd_spending(self):
    """
    Download CMS Part D Spending by Drug CSV and warm the market movers cache.
    Runs monthly on the 2nd of each month at 06:00 UTC.
    """
    try:
        logger.info("Starting CMS Part D spending CSV download")
        run_async(_do_download_cms_partd_spending())
        logger.info("CMS Part D spending CSV download complete")
    except Exception as exc:
        logger.error("CMS Part D spending download failed: %s", exc)
        raise self.retry(exc=exc)


async def _do_download_cms_partd_spending():
    """Download CMS spending CSV and invalidate dashboard home cache to force refresh."""
    from services.shared.cache import cache_delete
    from services.gateway.dashboard_service import _download_cms_spending_csv
    try:
        raw = await _download_cms_spending_csv()
        if raw:
            logger.info("CMS spending CSV downloaded: %d bytes", len(raw))
        # Invalidate home cache so next request rebuilds with fresh CSV data
        await cache_delete("dashboard:home")
        await cache_delete("cms:partd:spending_csv_bytes")
    except Exception as exc:
        logger.warning("CMS CSV download helper failed: %s", exc)


async def _sync_cms_formulary():
    """Download and parse CMS Part D formulary CSV (production stub)."""
    from services.shared.config import settings
    logger.info("CMS formulary sync: using estimated data for demo. "
                "Replace with actual CMS CSV download in production.")


async def _invalidate_expired_rep_briefs() -> int:
    from services.shared.config import settings
    import json
    import redis.asyncio as aioredis

    count = 0
    try:
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        pattern = "drug:*:rep_brief"
        async for key in redis.scan_iter(pattern):
            value = await redis.get(key)
            if value:
                data = json.loads(value)
                expires_at_str = data.get("expires_at", "")
                if expires_at_str:
                    try:
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
