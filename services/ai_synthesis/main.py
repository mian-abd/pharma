"""AI Synthesis microservice entry point."""
from fastapi import FastAPI

app = FastAPI(title="PharmaCortex AI Synthesis", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai_synthesis"}
