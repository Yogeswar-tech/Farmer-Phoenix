from fastapi import FastAPI

from app.api.v1.ask import router as ask_router
from app.api.v1.farmer import router as farmer_router
from app.api.v1.prices import router as prices_router

app = FastAPI(title="Kisan Sethu API", version="1.0.0")

app.include_router(prices_router, prefix="/v1")
app.include_router(ask_router, prefix="/v1")
app.include_router(farmer_router, prefix="/v1")


@app.get("/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
