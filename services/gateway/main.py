"""PharmaCortex API Gateway -- FastAPI app with CORS, GZip, and all routers."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from services.gateway.routers import drugs, health, search

logger = logging.getLogger(__name__)

app = FastAPI(
    title="PharmaCortex API Gateway",
    version="1.0.0",
    description="Bloomberg Terminal-style pharmaceutical intelligence API for physicians.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS -- allow Next.js frontend in development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# GZip compression for large API responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount routers
app.include_router(drugs.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(health.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "PharmaCortex API Gateway",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
