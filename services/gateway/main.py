"""PharmaCortex API Gateway -- FastAPI app with CORS, GZip, and all routers."""
import hashlib
import json
import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return clean error JSON -- never expose internal details or stack traces."""
    logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "path": str(request.url.path)},
    )


@app.middleware("http")
async def add_etag_header(request: Request, call_next):
    """
    Add ETag headers to GET responses for conditional caching.
    Clients can send If-None-Match to avoid re-downloading identical bundles.
    """
    response: Response = await call_next(request)

    if request.method == "GET" and response.status_code == 200:
        body_chunks = []
        async for chunk in response.body_iterator:
            body_chunks.append(chunk)
        body = b"".join(body_chunks)

        etag = '"' + hashlib.md5(body).hexdigest()[:16] + '"'
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=7200"

        if_none_match = request.headers.get("If-None-Match", "")
        if if_none_match == etag:
            return Response(status_code=304, headers={"ETag": etag})

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    return response


@app.get("/")
async def root():
    return {
        "service": "PharmaCortex API Gateway",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
