"""FDA Signals microservice entry point."""
from fastapi import FastAPI

app = FastAPI(title="PharmaCortex FDA Signals", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "fda_signals"}
