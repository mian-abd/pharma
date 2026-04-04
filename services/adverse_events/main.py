"""Adverse Events microservice entry point."""
from fastapi import FastAPI

app = FastAPI(title="PharmaCortex Adverse Events", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "adverse_events"}
