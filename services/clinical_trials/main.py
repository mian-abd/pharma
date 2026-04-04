"""Clinical Trials microservice entry point."""
from fastapi import FastAPI

app = FastAPI(title="PharmaCortex Clinical Trials", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "clinical_trials"}
