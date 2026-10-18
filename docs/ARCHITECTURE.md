# Kisan Sethu: Architecture Overview

Kisan Sethu is an informational decision-support platform for smallholder farmers across India, with first-class support for Telugu-speaking farmers on low-bandwidth mobile devices.

The system is deployed as a single consolidated container on Google Cloud Run (`asia-south1`).

---

## 1. System Topology

```
+-------------------------------------------------------------+
|                      Client Browser / PWA                   |
|          (Vite + React 19 + react-native-web)               |
+-------------------------------------------------------------+
                               |
                               | HTTPS / JSON (`/v1/*`)
                               v
+-------------------------------------------------------------+
|                      Google Cloud Run                       |
|           Single Container (asia-south1)                    |
|                                                             |
|  +-------------------------------------------------------+  |
|  |                 FastAPI (Python 3.12, uv)             |  |
|  |                                                       |  |
|  |  [API Routes] backend/app/api/v1/                     |  |
|  |    - prices.py, farmer.py, database_routes.py, ask.py |  |
|  |                                                       |  |
|  |  [Domain Logic] backend/app/domain/                   |  |
|  |    - pesticide_service.py, crop_doctor_service.py     |  |
|  |    - climate_service.py, soil_service.py              |  |
|  |    - logistics_service.py, validator.py               |  |
|  |                                                       |  |
|  |  [LLM Gateway] backend/app/llm/ (ONLY SDK touchpoint) |  |
|  |  [Prompts]     backend/prompts/<feature>/*.vN.md      |  |
|  +-------------------------------------------------------+  |
|                               |                             |
|  +----------------------------v--------------------------+  |
|  |                   Data Grounding Layer                |  |
|  |  - CIBRC Statutory DB: database/cibrc_isolated_db.py  |  |
|  |  - Multi-DB Engine:    database/multi_db_manager.py   |  |
|  |  - Agmarknet / APMC:   backend/data/apmc_data.json    |  |
|  |  - Open-Meteo & IMD:   Live weather radar integration |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

---

## 2. Frontend Architecture
- **Framework**: Vite + React 19 + `react-native-web` (Standard React Web SPA, **NOT Expo / expo-router**).
- **Network Seam**: `frontend/src/services/api.ts` is the **only network client** communicating with the backend.
- **Localization**: Telugu (`te`) default, Hindi (`hi`), English (`en`). All UI text managed in `frontend/src/data/i18n.ts`.
- **Accessibility & Resilience**: High contrast, audio read-aloud support via Web Speech Synthesis, resilient to intermittent 2G/3G connectivity.

---

## 3. Backend Architecture
- **Runtime**: Python 3.12 managed via `uv` and served via `uvicorn`.
- **API Endpoints**: Structured in `backend/app/api/v1/` (`prices.py`, `farmer.py`, `database_routes.py`, `ask.py`).
- **Domain Services**: All agricultural business logic lives in `backend/app/domain/` (pure services for pesticide safety, crop doctor vision guidance, climate scenarios, soil chemistry, and mandi price analytics).
- **Statutory CIBRC Database**: Grounded pesticide formulations and 15L knapsack dosages are retrieved strictly through `database/cibrc_isolated_db.py`.
- **LLM Gateway**: Isolated in `backend/app/llm/`. No other module calls AI model SDKs directly. Prompts reside as versioned markdown files in `backend/prompts/<feature>/*.vN.md`.

---

## 4. Architectural Invariants
1. **Never return mock or fallback data without a visible 'sample data' flag in the API response and UI.**
2. **Numbers shown to farmers come from structured data, never model output.**
3. **Pesticide and fertilizer dosages only originate from verified CIBRC records.**
4. **Secrets are passed solely via `KS_*` environment variables.**
