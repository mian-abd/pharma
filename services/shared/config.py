from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_url: str = "mongodb://localhost:27017/pharmacortex"
    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    openfda_api_key: str = ""

    rxnorm_base_url: str = "https://rxnav.nlm.nih.gov"
    clinicaltrials_base_url: str = "https://clinicaltrials.gov/api/v2"
    pubmed_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    dailymed_base_url: str = "https://dailymed.nlm.nih.gov/dailymed/services/v2"
    openfda_base_url: str = "https://api.fda.gov"

    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8000

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Cache TTLs (seconds)
    ttl_bundle: int = 3600           # 1 hour
    ttl_faers: int = 86400           # 24 hours
    ttl_trials: int = 86400          # 24 hours
    ttl_formulary: int = 7776000     # 90 days
    ttl_fda_signals: int = 3600      # 1 hour
    ttl_rep_brief: int = 604800      # 7 days
    ttl_autocomplete: int = 3600     # 1 hour
    ttl_rxnorm: int = 2592000        # 30 days
    ttl_health: int = 300            # 5 minutes


settings = Settings()
