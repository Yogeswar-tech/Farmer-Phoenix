import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.ask import router as ask_router
from app.api.v1.farmer import router as farmer_router
from app.api.v1.prices import router as prices_router
from app.api.v1.database_routes import router as db_router

logger = logging.getLogger("KisanSethuMain")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan manager: Starts automated 6-hour scraper & pruning daemon in background."""
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
    yield


app = FastAPI(title="Kisan Sethu API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prices_router, prefix="/v1")
app.include_router(ask_router, prefix="/v1")
app.include_router(farmer_router, prefix="/v1")
app.include_router(db_router, prefix="/v1")


@app.get("/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ------------------------------------------------------------------------------
# Production Static Frontend Mounting (Single-Container Full-Stack Mode)
# ------------------------------------------------------------------------------
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if not STATIC_DIR.exists():
    STATIC_DIR = Path("/app/static")

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Mount assets subfolder
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/")
    def root() -> dict[str, str]:
        return {"status": "ok", "service": "kisan-sethu-api", "version": "1.0.0"}

