"""Celery configuration for PharmaCortex background jobs."""
from celery.schedules import crontab
from services.shared.config import settings

broker_url = settings.celery_broker_url
result_backend = settings.celery_result_backend

task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"
enable_utc = True

# Retry configuration defaults
task_max_retries = 3
task_default_retry_delay = 60  # seconds

# Beat schedule -- all times UTC
beat_schedule = {
    "refresh-faers-all-drugs": {
        "task": "scheduler.tasks.refresh_faers_all_drugs",
        "schedule": crontab(hour=2, minute=0),  # daily 02:00 UTC
        "options": {"expires": 3600},
    },
    "refresh-trials-all-drugs": {
        "task": "scheduler.tasks.refresh_trials_all_drugs",
        "schedule": crontab(hour=3, minute=0),  # daily 03:00 UTC
        "options": {"expires": 3600},
    },
    "refresh-fda-signals": {
        "task": "scheduler.tasks.refresh_fda_signals",
        "schedule": crontab(minute=0),  # every hour
        "options": {"expires": 1800},
    },
    "cms-formulary-quarterly-sync": {
        "task": "scheduler.tasks.cms_formulary_quarterly_sync",
        "schedule": crontab(hour=4, minute=0, day_of_month=1),  # 1st of each month
        "options": {"expires": 86400},
    },
    "invalidate-stale-rep-briefs": {
        "task": "scheduler.tasks.invalidate_stale_rep_briefs",
        "schedule": crontab(hour=4, minute=30),  # daily 04:30 UTC
        "options": {"expires": 3600},
    },
}

# Worker settings
worker_prefetch_multiplier = 1
task_acks_late = True
worker_max_tasks_per_child = 100
