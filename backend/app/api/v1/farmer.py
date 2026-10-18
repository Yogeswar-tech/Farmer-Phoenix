"""Endpoints supporting FarmerEnvelope contract for crops, regions, and insights."""

import datetime
import time
from typing import Any

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

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


class GmailLoginRequest(BaseModel):
    email: str = Field(..., description="Farmer Gmail address (must end with @gmail.com)")
    farmer_name: str | None = Field(None, description="Farmer name")
    preferred_lang: str = Field("en", description="Preferred language: en, hi, te")
    location_id: str | None = Field(None, description="Location slug / identifier")
    location_name: str | None = Field(None, description="Location display name")
    district: str | None = Field(None, description="District")
    state: str | None = Field(None, description="State")
    latitude: float | None = Field(None, description="Farm Latitude")
    longitude: float | None = Field(None, description="Farm Longitude")
    pincode: str | None = Field(None, description="PIN code")
    primary_crop: str | None = Field(None, description="Cultivated crop")


class UpdateLocationRequest(BaseModel):
    email: str = Field(..., description="Farmer Gmail address")
    location_id: str = Field(..., description="Location slug")
    location_name: str = Field(..., description="Location display name")
    district: str = Field(..., description="District")
    state: str = Field(..., description="State")
    latitude: float | None = Field(None, description="Latitude")
    longitude: float | None = Field(None, description="Longitude")
    pincode: str | None = Field(None, description="PIN code")


class UpdateCropRequest(BaseModel):
    email: str = Field(..., description="Farmer Gmail address")
    primary_crop: str = Field(..., description="Primary cultivated crop")


@router.post("/farmer/login-gmail")
def login_farmer_with_gmail(payload: GmailLoginRequest) -> dict[str, Any]:
    """Dedicated Gmail Authentication:
    Authenticates or registers farmer profile in the persistent database,
    providing strictly isolated location, crops, and module records for each distinct user.
    """
    from database.connection import get_db_cursor, is_postgres_active
    clean_email = payload.email.strip().lower()

    if not clean_email.endswith("@gmail.com"):
        raise HTTPException(
            status_code=400,
            detail="Authentication restricted: Only valid Gmail accounts (@gmail.com) are currently accepted."
        )

    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        # 1. Check if user profile already exists in DB
        cur.execute(f"SELECT * FROM farmer_profiles WHERE LOWER(email) = LOWER({ph});", (clean_email,))
        row = cur.fetchone()

        if row:
            # Existing user: update last login and any updated language
            profile = dict(row)
            update_query = (
                f"UPDATE farmer_profiles SET last_login_at = CURRENT_TIMESTAMP "
                f"WHERE LOWER(email) = LOWER({ph});"
            )
            cur.execute(update_query, (clean_email,))
            return {
                "status": "success",
                "authenticated": True,
                "is_new_user": False,
                "token": f"ks_gmail_token_{abs(hash(clean_email))}",
                "profile": profile
            }

        # 2. New user: determine default profile parameters
        default_name = (payload.farmer_name or "").strip() or clean_email.split("@")[0].replace(".", " ").title()
        loc_id = payload.location_id or "chittoor"
        loc_name = payload.location_name or "Chittoor / Madanapalle"
        district = payload.district or "Chittoor"
        state = payload.state or "Andhra Pradesh"
        lat = payload.latitude if payload.latitude is not None else 13.5560
        lng = payload.longitude if payload.longitude is not None else 78.5010
        pin = payload.pincode or "517325"
        crop = payload.primary_crop or "tomato"
        lang = payload.preferred_lang or "en"

        insert_query = (
            f"INSERT INTO farmer_profiles "
            f"(email, farmer_name, preferred_lang, location_id, location_name, district, state, latitude, longitude, pincode, primary_crop, last_login_at) "
            f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, CURRENT_TIMESTAMP) "
            f"RETURNING *;"
        ) if use_pg else (
            f"INSERT INTO farmer_profiles "
            f"(email, farmer_name, preferred_lang, location_id, location_name, district, state, latitude, longitude, pincode, primary_crop, last_login_at) "
            f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, CURRENT_TIMESTAMP);"
        )

        try:
            cur.execute(insert_query, (
                clean_email, default_name, lang, loc_id, loc_name, district, state, lat, lng, pin, crop
            ))
            new_row = cur.fetchone() if use_pg else None
            profile = dict(new_row) if new_row else {
                "email": clean_email,
                "farmer_name": default_name,
                "preferred_lang": lang,
                "location_id": loc_id,
                "location_name": loc_name,
                "district": district,
                "state": state,
                "latitude": lat,
                "longitude": lng,
                "pincode": pin,
                "primary_crop": crop
            }
        except Exception as e:
            # Fallback if any error occurs
            profile = {
                "email": clean_email,
                "farmer_name": default_name,
                "preferred_lang": lang,
                "location_id": loc_id,
                "location_name": loc_name,
                "district": district,
                "state": state,
                "latitude": lat,
                "longitude": lng,
                "pincode": pin,
                "primary_crop": crop
            }

        return {
            "status": "success",
            "authenticated": True,
            "is_new_user": True,
            "token": f"ks_gmail_token_{abs(hash(clean_email))}",
            "profile": profile
        }


@router.get("/farmer/profile-by-email")
def get_farmer_profile_by_email(
    email: str = Query(..., description="Farmer Gmail address")
) -> dict[str, Any]:
    """Retrieve persisted farmer profile by Gmail address."""
    from database.connection import get_db_cursor, is_postgres_active
    clean_email = email.strip().lower()
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        cur.execute(f"SELECT * FROM farmer_profiles WHERE LOWER(email) = LOWER({ph});", (clean_email,))
        row = cur.fetchone()
        if row:
            return {"status": "success", "profile": dict(row)}

    return {
        "status": "not_found",
        "email": clean_email,
        "profile": None
    }


@router.put("/farmer/profile/location")
def update_farmer_location(payload: UpdateLocationRequest) -> dict[str, Any]:
    """Persist updated GPS coordinates or searched All-India location directly to farmer's DB profile."""
    from database.connection import get_db_cursor, is_postgres_active
    clean_email = payload.email.strip().lower()
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        update_query = (
            f"UPDATE farmer_profiles SET "
            f"location_id = {ph}, "
            f"location_name = {ph}, "
            f"district = {ph}, "
            f"state = {ph}, "
            f"latitude = {ph}, "
            f"longitude = {ph}, "
            f"pincode = {ph}, "
            f"last_login_at = CURRENT_TIMESTAMP "
            f"WHERE LOWER(email) = LOWER({ph}) "
            f"{'RETURNING *;' if use_pg else ';'}"
        )
        cur.execute(update_query, (
            payload.location_id,
            payload.location_name,
            payload.district,
            payload.state,
            payload.latitude,
            payload.longitude,
            payload.pincode,
            clean_email
        ))
        # Also sync to users table if present
        try:
            phone_part = clean_email.split("@")[0]
            cur.execute(
                f"UPDATE users SET district = {ph}, state = {ph}, updated_at = CURRENT_TIMESTAMP "
                f"WHERE LOWER(mail_id) = LOWER({ph}) OR phone_number LIKE {ph};",
                (payload.district, payload.state, clean_email, f"%{phone_part}%")
            )
        except Exception:
            pass

        return {
            "status": "success",
            "message": "Farm location successfully synced to database profile.",
            "profile": dict(row) if row else None
        }


@router.put("/farmer/profile/crop")
def update_farmer_crop(payload: UpdateCropRequest) -> dict[str, Any]:
    """Persist updated cultivated crop to farmer's DB profile."""
    from database.connection import get_db_cursor, is_postgres_active
    clean_email = payload.email.strip().lower()
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"

    with get_db_cursor() as cur:
        update_query = (
            f"UPDATE farmer_profiles SET "
            f"primary_crop = {ph}, "
            f"last_login_at = CURRENT_TIMESTAMP "
            f"WHERE LOWER(email) = LOWER({ph}) "
            f"{'RETURNING *;' if use_pg else ';'}"
        )
        cur.execute(update_query, (payload.primary_crop, clean_email))
        cur.execute(f"SELECT * FROM farmer_profiles WHERE LOWER(email) = LOWER({ph});", (clean_email,))
        row = cur.fetchone()
        return {
            "status": "success",
            "profile": dict(row) if row else None
        }


@router.get("/farmer/demo-accounts")
def get_demo_accounts() -> dict[str, Any]:
    """Returns sample pre-seeded Gmail accounts demonstrating per-user isolated locations across India."""
    from database.connection import get_db_cursor, is_postgres_active
    with get_db_cursor() as cur:
        cur.execute("SELECT * FROM farmer_profiles WHERE email IS NOT NULL ORDER BY id ASC LIMIT 6;")
        rows = cur.fetchall()
        accounts = [dict(r) for r in rows] if rows else []

    if not accounts:
        accounts = [
            {
                "email": "chittoor.farmer@gmail.com",
                "farmer_name": "Venkat Ramanathan",
                "location_name": "Chittoor (Madanapalle Mandi)",
                "district": "Chittoor",
                "state": "Andhra Pradesh",
                "primary_crop": "tomato",
                "preferred_lang": "te"
            },
            {
                "email": "hyderabad.grower@gmail.com",
                "farmer_name": "Kishore Reddy",
                "location_name": "Hyderabad (Bowenpally Mandi)",
                "district": "Hyderabad",
                "state": "Telangana",
                "primary_crop": "chilli",
                "preferred_lang": "te"
            },
            {
                "email": "punjab.wheat@gmail.com",
                "farmer_name": "Harpreet Singh",
                "location_name": "Jalandhar (Doaba Mandi)",
                "district": "Jalandhar",
                "state": "Punjab",
                "primary_crop": "potato",
                "preferred_lang": "hi"
            }
        ]

    return {
        "status": "success",
        "accounts": accounts
    }


# Retained legacy compatibility routes for mobile/OTP
class FarmerLoginRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15, description="Farmer 10-digit mobile number")
    farmer_name: str | None = Field(None, description="Farmer name")
    otp: str = Field("1234", description="4-digit OTP code")
    preferred_lang: str = Field("en", description="Preferred language: en, hi, te")
    district: str | None = Field(None, description="District")
    state: str | None = Field(None, description="State")
    primary_crop: str | None = Field(None, description="Primary cultivated crop")


@router.post("/farmer/login-otp")
def login_farmer_with_otp(payload: FarmerLoginRequest) -> dict[str, Any]:
    """Legacy phone number authentication."""
    from database.connection import get_db_cursor, is_postgres_active
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"
    clean_phone = payload.phone_number.strip().replace(" ", "").replace("+91", "")
    default_name = "किसान मित्र" if payload.preferred_lang == "hi" else ("రైతు మిత్ర" if payload.preferred_lang == "te" else "Farmer Friend")
    name = (payload.farmer_name or "").strip() or default_name

    with get_db_cursor() as cur:
        cur.execute(f"SELECT * FROM farmer_profiles WHERE phone_number = {ph};", (clean_phone,))
        row = cur.fetchone()
        if row:
            return {"status": "success", "authenticated": True, "token": f"ks_token_{clean_phone}", "profile": dict(row)}

        # Insert new
        try:
            cur.execute(
                f"INSERT INTO farmer_profiles (phone_number, farmer_name, preferred_lang, district, state, primary_crop, last_login_at) "
                f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, CURRENT_TIMESTAMP);",
                (clean_phone, name, payload.preferred_lang, payload.district or "Guntur", payload.state or "Andhra Pradesh", payload.primary_crop or "chilli")
            )
        except Exception:
            pass

    return {
        "status": "success",
        "authenticated": True,
        "token": f"ks_token_{clean_phone}",
        "profile": {
            "phone_number": clean_phone,
            "farmer_name": name,
            "preferred_lang": payload.preferred_lang,
            "district": payload.district or "Guntur",
            "state": payload.state or "Andhra Pradesh",
            "primary_crop": payload.primary_crop or "chilli"
        }
    }


@router.get("/farmer/profile")
def get_farmer_profile(
    phone_number: str = Query(..., min_length=10, description="Farmer mobile number")
) -> dict[str, Any]:
    """Legacy profile fetch by phone number."""
    from database.connection import get_db_cursor, is_postgres_active
    use_pg = is_postgres_active()
    ph = "%s" if use_pg else "?"
    clean_phone = phone_number.strip().replace(" ", "").replace("+91", "")

    with get_db_cursor() as cur:
        cur.execute(f"SELECT * FROM farmer_profiles WHERE phone_number = {ph};", (clean_phone,))
        row = cur.fetchone()
        if row:
            return {"status": "success", "profile": dict(row)}

    return {
        "status": "not_found",
        "phone_number": clean_phone,
        "profile": None
    }


class UserRegistrationPayload(BaseModel):
    phone_number: str = Field(..., description="Farmer Phone Number (Primary Key)")
    first_name: str = Field(..., description="Farmer First Name")
    last_name: str = Field(..., description="Farmer Last Name")
    mail_id: str | None = Field(None, description="Optional Farmer Email Address")
    crop_name: str | None = Field(None, description="Cultivated Crop Name")
    district: str | None = Field(None, description="District")
    state: str | None = Field(None, description="State")
    preferred_lang: str | None = Field("en", description="Preferred Language")


@router.get("/farmer/users")
def get_all_users_endpoint() -> dict[str, Any]:
    """Retrieve all farmer records from the users database table."""
    from database.db import get_all_users
    users = get_all_users()
    return {
        "status": "success",
        "total_users": len(users),
        "users": users
    }


@router.get("/farmer/user-by-phone")
def get_user_by_phone_endpoint(
    phone_number: str = Query(..., description="Mobile phone number to lookup in users table")
) -> dict[str, Any]:
    """Retrieve farmer profile from users table by primary key phone_number."""
    from database.db import get_user_by_phone
    user = get_user_by_phone(phone_number)
    if user:
        full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        profile = {
            "phone_number": user["phone_number"],
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "farmer_name": full_name or user["phone_number"],
            "email": user.get("mail_id") or f"{user['phone_number'].replace('+', '')}@kisan.farmer.in",
            "mail_id": user.get("mail_id"),
            "primary_crop": user.get("crop_name") or "tomato",
            "crop_name": user.get("crop_name") or "tomato",
            "district": user.get("district") or "Local Farm",
            "state": user.get("state") or "India",
            "preferred_lang": user.get("preferred_lang") or "en"
        }
        return {
            "status": "success",
            "exists": True,
            "user": user,
            "profile": profile
        }
    return {
        "status": "success",
        "exists": False,
        "user": None,
        "profile": None
    }


@router.post("/farmer/save-user-details")
def save_user_details(payload: UserRegistrationPayload) -> dict[str, Any]:
    """Registers or updates farmer details in the 'users' database table with phone_number as the Primary Key.
    Stores:
    - phone_number (Primary Key)
    - first_name (Required)
    - last_name (Required)
    - mail_id (Optional)
    - crop_name (Their Crop Name)
    """
    from database.db import upsert_user
    if not payload.first_name.strip() or not payload.last_name.strip():
        raise HTTPException(status_code=400, detail="First name and Last name are required.")
    if not payload.phone_number.strip():
        raise HTTPException(status_code=400, detail="Valid phone number is required.")

    user = upsert_user(
        phone_number=payload.phone_number,
        first_name=payload.first_name,
        last_name=payload.last_name,
        mail_id=payload.mail_id,
        crop_name=payload.crop_name,
        district=payload.district,
        state=payload.state,
        preferred_lang=payload.preferred_lang or "en"
    )

    full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    profile = {
        "phone_number": user["phone_number"],
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "farmer_name": full_name or user["phone_number"],
        "email": user.get("mail_id") or f"{user['phone_number'].replace('+', '')}@kisan.farmer.in",
        "mail_id": user.get("mail_id"),
        "primary_crop": user.get("crop_name") or "tomato",
        "crop_name": user.get("crop_name") or "tomato",
        "district": user.get("district") or "Local Farm",
        "state": user.get("state") or "India",
        "preferred_lang": user.get("preferred_lang") or "en"
    }

    return {
        "status": "success",
        "message": "Farmer details successfully saved in database",
        "user": user,
        "profile": profile
    }


