import logging
import sys
import threading
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import database.cibrc_isolated_db as cibrc_isolated_db
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.ask import router as ask_router
from app.api.v1.database_routes import router as db_router
from app.api.v1.doctor import router as doctor_router
from app.api.v1.farmer import router as farmer_router
from app.api.v1.prices import router as prices_router
from app.settings import settings

logger = logging.getLogger("KisanSethuMain")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan manager: initialize DB schema, seed CIBRC registry, and start 6h recurring scraper daemon."""
    try:
        from database.connection import init_database
        init_database()
        logger.info("Database schemas and fallback tables initialized.")
    except Exception as exc:
        logger.error("Database schema init failed: %s", exc)

    try:
        count = cibrc_isolated_db.get_cibrc_row_count()
        if count < 10:
            import sys
            from pathlib import Path
            scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
            if str(scripts_dir.parent) not in sys.path:
                sys.path.insert(0, str(scripts_dir.parent))
            from scripts.seed_cibrc_pesticide_registry import seed_cibrc_registry
            seed_cibrc_registry()
            logger.info("CIBRC registry seeded on startup (was %d records).", count)
        else:
            logger.info("CIBRC registry ready: %d records.", count)
    except Exception as exc:
        logger.warning("CIBRC seed skipped: %s", exc)

    def background_scraper_daemon():
        import time
        # Allow initial server startup to complete
        time.sleep(3)
        try:
            from scrapers.scheduler import run_forever
            run_forever()
        except Exception as exc:
            logger.warning("Background 6h scraper daemon notice: %s", exc)

    daemon_thread = threading.Thread(
        target=background_scraper_daemon,
        daemon=True,
        name="KisanSethu6hScraperDaemon"
    )
    daemon_thread.start()
    logger.info("Automated 6-Hour Recurring Scraper & Data-Pruner Daemon spawned in background.")
    logger.info("Kisan Sethu API operational — Cloud Run asia-south1.")
    yield
    logger.info("Kisan Sethu API shutting down.")


app = FastAPI(title="Kisan Sethu API", version="1.0.0", lifespan=lifespan)

# Restrict CORS to explicit allowed origins (never allow_credentials with "*")
allowed_origins_list = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
if not allowed_origins_list:
    allowed_origins_list = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Enforces HSTS, X-Content-Type-Options: nosniff, and CSP for Vite and Leaflet."""
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    csp_img = (
        "img-src 'self' data: blob: "
        "https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com "
        "https://images.unsplash.com; "
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        # Firebase Phone Auth: reCAPTCHA scripts from gstatic + Google APIs
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://www.gstatic.com https://apis.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        + csp_img
        # Firebase reCAPTCHA renders in a hidden iframe from google.com
        + "frame-src 'self' https://www.google.com; "
        + "connect-src 'self' "
        "https://identitytoolkit.googleapis.com "
        "https://securetoken.googleapis.com "
        "http: https:;"
    )
    return response

app.include_router(prices_router, prefix="/v1")
app.include_router(ask_router, prefix="/v1")
app.include_router(farmer_router, prefix="/v1")
app.include_router(db_router, prefix="/v1")
app.include_router(doctor_router, prefix="/v1")


@app.get("/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/health/ready", response_model=None)
def health_ready() -> Response:
    """Readiness probe for Cloud Run / k8s:
    Returns 200 OK only if the database is reachable and CIBRC registry has rows.
    Returns 503 Service Unavailable if CIBRC row count == 0 or database is unreachable.
    Reports mandi_data telemetry (latest arrival date, total count, active sources, and stale status).
    """
    try:
        count = cibrc_isolated_db.get_cibrc_row_count()
        if count <= 0:
            err_msg = '{"status":"unhealthy","error":"cibrc registry empty","ready":false}'
            return Response(
                content=err_msg,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                media_type="application/json"
            )

        # Mandi data telemetry
        mandi_stats: dict[str, Any] = {
            "latest_arrival_date": None,
            "total_records": 0,
            "sources_active": [],
            "stale": True
        }
        try:
            from database.connection import get_db_cursor
            with get_db_cursor() as cur:
                cur.execute("SELECT MAX(arrival_date) AS max_date, COUNT(*) AS total FROM mandi_prices;")
                m_row = cur.fetchone()
                if m_row:
                    max_d = m_row["max_date"] if isinstance(m_row, dict) else m_row[0]
                    total_r = m_row["total"] if isinstance(m_row, dict) else m_row[1]
                    mandi_stats["total_records"] = int(total_r or 0)
                    if max_d:
                        max_d_str = str(max_d)[:10]
                        mandi_stats["latest_arrival_date"] = max_d_str
                        try:
                            d_obj = datetime.strptime(max_d_str, "%Y-%m-%d").date()
                            now_utc = datetime.now(UTC).date()
                            mandi_stats["stale"] = (now_utc - d_obj).days > 2
                        except Exception:
                            mandi_stats["stale"] = False
                cur.execute("SELECT DISTINCT source FROM mandi_prices WHERE source IS NOT NULL;")
                s_rows = cur.fetchall()
                if s_rows:
                    mandi_stats["sources_active"] = [
                        (r["source"] if isinstance(r, dict) else r[0])
                        for r in s_rows if (r["source"] if isinstance(r, dict) else r[0])
                    ]
        except Exception as m_exc:
            logger.debug("Mandi health telemetry notice: %s", m_exc)

        return JSONResponse(
            content={
                "status": "ready",
                "ready": True,
                "cibrc_records": count,
                "database": "connected",
                "mandi_data": mandi_stats
            }
        )
    except Exception as exc:
        logger.error("Readiness check failure: %s", exc)
        return Response(
            content=f'{{"status":"unhealthy","error":"Database error: {exc}","ready":false}}',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )


# Robots.txt route for search crawlers & production compliance
@app.get("/robots.txt")
def robots_txt() -> PlainTextResponse:
    content = "User-agent: *\nDisallow: /v1/\nAllow: /\n"
    return PlainTextResponse(content=content, media_type="text/plain")


# Explicit handler for unmatched /v1/* routes to ensure strict JSON 404 {"detail": "Not found"}
@app.api_route(
    "/v1/{rest_of_path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
)
async def v1_not_found(rest_of_path: str) -> None:
    raise HTTPException(status_code=404, detail="Not found")


# ------------------------------------------------------------------------------
# Production Static Frontend Mounting (Single-Container Full-Stack Mode)
# ------------------------------------------------------------------------------

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if not STATIC_DIR.exists():
    STATIC_DIR = Path("/app/static")

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Mount assets subfolder
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str) -> FileResponse:
        # Explicitly protect /v1 namespace from ever serving HTML
        clean_path = full_path.lstrip("/")
        if clean_path.startswith("v1/") or clean_path == "v1":
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")

        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/")
    def root() -> dict[str, str]:
        return {"status": "ok", "service": "kisan-sethu-api", "version": "1.0.0"}

