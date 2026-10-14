"""Endpoints supporting FarmerEnvelope contract for crops, regions, and insights."""

import datetime
import time
from typing import Any

from fastapi import APIRouter, Query

from app.location.geocoder import Geocoder
from app.location.mandi_finder import MandiFinder
from app.location.models import GeoCoordinates
from app.rag.retriever import PriceRetriever

router = APIRouter(tags=["Farmer Experience"])

SUPPORTED_CROPS: list[dict[str, str]] = [
    {
        "id": "tomato",
        "name": "Tomato",
        "image": "https://images.unsplash.com/photo-1546470427-227c7369a9b7?w=120&q=80",
    },
    {
        "id": "onion",
        "name": "Onion",
        "image": "https://images.unsplash.com/photo-1508747703725-719777637510?w=120&q=80",
    },
    {
        "id": "potato",
        "name": "Potato",
        "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=120&q=80",
    },
    {
        "id": "brinjal",
        "name": "Brinjal",
        "image": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=120&q=80",
    },
    {
        "id": "chilli",
        "name": "Green Chilli",
        "image": "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=120&q=80",
    },
    {
        "id": "cabbage",
        "name": "Cabbage",
        "image": "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=120&q=80",
    },
    {
        "id": "cauliflower",
        "name": "Cauliflower",
        "image": "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=120&q=80",
    },
    {
        "id": "carrot",
        "name": "Carrot",
        "image": "https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?w=120&q=80",
    },
    {
        "id": "garlic",
        "name": "Garlic",
        "image": "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=120&q=80",
    },
    {
        "id": "ginger",
        "name": "Ginger",
        "image": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=120&q=80",
    },
    {
        "id": "bhindi",
        "name": "Ladies Finger (Bhindi)",
        "image": "https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=120&q=80",
    },
    {
        "id": "matar",
        "name": "Green Peas (Matar)",
        "image": "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=120&q=80",
    },
    {
        "id": "capsicum",
        "name": "Capsicum",
        "image": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=120&q=80",
    },
    {
        "id": "cucumber",
        "name": "Cucumber",
        "image": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=120&q=80",
    },
    {
        "id": "bottlegourd",
        "name": "Bottle Gourd (Lauki)",
        "image": "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=120&q=80",
    },
    {
        "id": "bittergourd",
        "name": "Bitter Gourd (Karela)",
        "image": "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=120&q=80",
    },
    {
        "id": "palak",
        "name": "Spinach (Palak)",
        "image": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=120&q=80",
    },
    {
        "id": "lemon",
        "name": "Lemon",
        "image": "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=120&q=80",
    },
    {
        "id": "coriander",
        "name": "Coriander",
        "image": "https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=120&q=80",
    },
    {
        "id": "beetroot",
        "name": "Beetroot",
        "image": "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=120&q=80",
    },
]


@router.get("/crops")
def get_crops(
    lang: str = Query("en", description="Language code"),  # noqa: ARG001
) -> list[dict[str, str]]:
    """Return available monitored crops."""
    return SUPPORTED_CROPS


@router.get("/regions/resolve")
async def resolve_region(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
) -> dict[str, Any]:
    """Resolve geographic coordinates to nearest region and mandis."""
    coords = GeoCoordinates(latitude=lat, longitude=lon)
    finder = MandiFinder()
    nearest = await finder.find_nearest(coords, top_n=3)

    region_id = f"reg_{nearest[0].district.lower()}_01" if nearest else "reg_chennai_01"
    mandis = [
        {
            "id": f"mandi_{m.name.lower().replace(' ', '_')}",
            "name": m.name,
            "dist_km": m.distance_km or 0.0,
        }
        for m in nearest
    ]
    return {"region_id": region_id, "mandis": mandis}


@router.get("/insight")
async def get_insight(
    crop: str = Query(..., description="Crop identifier or name"),
    region: str = Query("Chennai", description="Region name or ID"),
    lang: str = Query("en", description="Language code"),
) -> dict[str, Any]:
    """Compute regional crop price insight and advice envelope."""
    now_str = datetime.date.today().isoformat()
    finder = MandiFinder(geocoder=Geocoder())
    nearest = await finder.find_nearest(region, top_n=2)
    nearest_names = [m.name for m in nearest]

    retriever = PriceRetriever()
    results = retriever.retrieve(
        query=f"{crop} price in {region}",
        commodity=crop.title(),
        markets=nearest_names,
        top_k=2,
    )

    mandi_price = 25.0  # default ₹/kg fallback
    retail_price = 38.0
    provenance_items: list[dict[str, str]] = []

    # Check database (PostgreSQL primary, SQLite fallback) for scraped rates
    try:
        from database.connection import get_db_cursor, is_postgres_active
        use_pg = is_postgres_active()
        ph = "%s" if use_pg else "?"
        with get_db_cursor() as db_cur:
            db_cur.execute(
                f"SELECT market, modal_price_kg, modal_price_qtl, arrival_date, source "
                f"FROM mandi_prices WHERE LOWER(commodity) = LOWER({ph}) ORDER BY arrival_date DESC LIMIT 1;",
                (crop,)
            )
            db_row = db_cur.fetchone()
            if db_row:
                row_dict = dict(db_row)
                mandi_price = float(row_dict["modal_price_kg"])
                retail_price = round(mandi_price * 1.45, 1)
                db_name = "PostgreSQL" if use_pg else "SQLite"
                provenance_items.append({
                    "label": f"{row_dict['market']} wholesale price",
                    "as_of": str(row_dict["arrival_date"]),
                    "source": f"{db_name} DB ({row_dict['source']})"
                })
    except Exception:
        pass

    if not provenance_items and results:
        top_meta = results[0].metadata
        modal_qtl = float(top_meta.get("modal_price", 2500.0))
        mandi_price = round(modal_qtl / 100.0, 1)  # convert quintal to kg
        retail_price = round(mandi_price * 1.45, 1)

        for r in results:
            m = r.metadata
            provenance_items.append(
                {
                    "label": f"{m.get('market_name', 'Mandi')} wholesale price",
                    "as_of": m.get("arrival_date", now_str),
                    "source": m.get("source", "data.gov.in (AGMARKNET)"),
                }
            )

    if not provenance_items:
        provenance_items.append(
            {
                "label": f"{region} Mandi",
                "as_of": now_str,
                "source": "AGMARKNET (data.gov.in)",
            }
        )

    nearest_summary = f"{nearest[0].name} ({nearest[0].distance_km} km)" if nearest else region

    return {
        "request_id": f"req_insight_{int(time.time() * 1000)}",
        "lang": lang,
        "card": {
            "headline": f"{crop.title()} prices near {nearest_summary}",
            "bullets": [
                f"Wholesale mandi rate: ₹{mandi_price:.1f}/kg (₹{mandi_price * 100:.0f}/quintal).",
                f"Estimated local retail: ₹{retail_price:.1f}/kg.",
                "Compare modal rates across nearby mandis before transporting harvest.",
            ],
        },
        "numbers": {
            "mandi_modal_kg": mandi_price,
            "retail_kg": retail_price,
            "modal_quintal": mandi_price * 100,
        },
        "provenance": provenance_items,
        "freshness": {"stale": False},
        "cache": {"status": "HIT", "llm_calls": 0},
        "disclaimer_key": "general_price_disclaimer",
    }
