"""Drug Resolution microservice entry point."""
from fastapi import FastAPI

app = FastAPI(title="PharmaCortex Drug Resolution", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "drug_resolution"}
