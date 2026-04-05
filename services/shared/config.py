from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_url: str = "mongodb://localhost:27017/pharmacortex"
    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    openfda_api_key: str = ""
    youtube_api_key: str = ""

    # External API base URLs
    rxnorm_base_url: str = "https://rxnav.nlm.nih.gov"
    clinicaltrials_base_url: str = "https://clinicaltrials.gov/api/v2"
    pubmed_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    nih_reporter_base_url: str = "https://api.reporter.nih.gov"
    dailymed_base_url: str = "https://dailymed.nlm.nih.gov/dailymed/services/v2"
    openfda_base_url: str = "https://api.fda.gov"
    fda_shortage_url: str = "https://api.fda.gov/drug/shortage.json"
    orange_book_data_url: str = "https://www.fda.gov/media/76860/download?attachment="
    orange_book_data_path: str = ""
    youtube_api_base_url: str = "https://www.googleapis.com/youtube/v3"
    cms_formulary_url: str = ""
    cms_formulary_local_zip: str = ""
    cms_open_payments_csv_path: str = ""
    cms_open_payments_csv_url: str = ""
    cms_partd_geography_csv_path: str = ""
    cms_partd_geography_csv_url: str = "https://data.cms.gov/sites/default/files/2025-04/9fe6b8a6-0cb9-4b7c-9760-87800da010a8/MUP_DPR_RY25_P04_V10_DY23_Geo.csv"
    cms_partd_spending_csv_url: str = "https://data.cms.gov/sites/default/files/2025-05/56d95a8b-138c-4b60-84a5-613fbab7197f/DSD_PTD_RY25_P04_V10_DY23_BGM.csv"
    cms_partd_spending_csv_path: str = ""
    fda_rss_drugs_url: str = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml"
    fda_rss_press_url: str = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml"
    pubmed_tool: str = "pharmacortex"
    pubmed_email: str = ""
    cms_open_payments_data_year: int = 2023
    cms_partd_data_year: int = 2024

    # CORS origins (comma-separated in .env: ALLOWED_ORIGINS=http://a,http://b)
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8000

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Feature flags
    feature_ml_insights: bool = False
    feature_open_payments: bool = True

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
    ttl_label_history: int = 86400   # 24 hours
    ttl_shortage: int = 3600         # 1 hour
    ttl_influence: int = 604800      # 7 days (payments data refreshes weekly)
    ttl_panels: int = 3600           # 1 hour (per-panel TTL)
    ttl_evidence: int = 21600        # 6 hours
    ttl_market: int = 86400          # 24 hours
    ttl_approval: int = 86400        # 24 hours
    ttl_competition: int = 86400     # 24 hours
    ttl_funding: int = 21600         # 6 hours
    ttl_media: int = 900             # 15 minutes
    ttl_dashboard_home: int = 900    # 15 minutes
    ttl_dashboard_snapshot: int = 1800  # 30 minutes

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
