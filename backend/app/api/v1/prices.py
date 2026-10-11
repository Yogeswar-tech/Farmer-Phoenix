"""Price query API endpoint."""

import datetime
from typing import Any

from fastapi import APIRouter, Query

from app.location.mandi_finder import MandiFinder
from app.rag.retriever import PriceRetriever

router = APIRouter(tags=["Prices"])


@router.get("/prices")
async def get_prices(
    commodity: str | None = Query(None, description="Commodity name (e.g. Tomato)"),
    state: str | None = Query(None, description="State filter (e.g. Tamil Nadu)"),
    location: str | None = Query(None, description="Farmer location or city"),
    date: str | None = Query(None, description="Reporting date (YYYY-MM-DD)"),
) -> dict[str, Any]:
    """Retrieve structured prices and trend for commodities."""
    nearby_markets: list[str] = []
    if location:
        finder = MandiFinder()
        nearest = await finder.find_nearest(location, top_n=3, state=state)
        nearby_markets = [m.name for m in nearest]

    retriever = PriceRetriever()
    query_str = f"{commodity or 'Vegetable'} price in {state or 'India'}"
    results = retriever.retrieve(
        query=query_str,
        commodity=commodity,
        state=state,
        markets=nearby_markets if nearby_markets else None,
        top_k=6,
    )

    prices_data: list[dict[str, Any]] = []
    modal_sum = 0.0
    valid_count = 0

    for r in results:
        meta = r.metadata
        if meta.get("chunk_type") == "mandi_price":
            modal_p = float(meta.get("modal_price", 0.0))
            if modal_p > 0:
                modal_sum += modal_p
                valid_count += 1
            prices_data.append(
                {
                    "market": meta.get("market_name"),
                    "district": meta.get("district"),
                    "state": meta.get("state"),
                    "commodity": meta.get("commodity"),
                    "variety": meta.get("variety"),
                    "min_price": meta.get("min_price"),
                    "max_price": meta.get("max_price"),
                    "modal_price": modal_p,
                    "date": meta.get("arrival_date"),
                }
            )

    avg_price = (modal_sum / valid_count) if valid_count > 0 else 0.0
    trend = "stable"
    if valid_count > 1:
        spreads = [p["modal_price"] for p in prices_data]
        if max(spreads) - min(spreads) > 200:
            trend = "volatile"

    return {
        "commodity": commodity,
        "state": state,
        "avg_modal_price": round(avg_price, 2),
        "trend": trend,
        "records_count": len(prices_data),
        "prices": prices_data,
        "as_of": date or datetime.date.today().isoformat(),
    }
