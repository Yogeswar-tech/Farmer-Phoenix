# Kisan Sethu Backend: Rules for Coding Agents

Refer to `docs/ARCHITECTURE.md` and repository `AGENTS.md`. Single FastAPI service managed with `uv`, deployed via single root `Dockerfile` to Google Cloud Run (`asia-south1`).

---

## 1. Directory Structure & Architecture
- **API Endpoints**: `backend/app/api/v1/` (`prices.py`, `farmer.py`, `database_routes.py`, `ask.py`).
- **Domain Services**: `backend/app/domain/` (`pesticide_service.py`, `crop_doctor_service.py`, `climate_service.py`, `soil_service.py`, `logistics_service.py`, `validator.py`).
- **CIBRC Statutory Data**: `database/cibrc_isolated_db.py` (standalone isolated database manager for certified chemical recommendations).
- **Prompt Files**: `backend/prompts/<feature>/<name>.v<N>.md` (versioned, instruction-only, data injected as JSON facts).
- **LLM Gateway**: `backend/app/llm/` is the **only** module authorized to import or communicate with model SDKs.

---

## 2. Hard Non-Negotiables
- **Never return mock or fallback data without a visible 'sample data' flag in the API response and UI.** Silent mock values are completely prohibited.
- **Numbers shown to farmers come from structured data, never model output.** The validator rigorously cross-checks numbers against factual records.
- **Pesticide/fertilizer dosages must only come from retrieved, cited CIBRC records.** Never guess or permit LLMs to generate chemical quantities.
- **Secrets only via `KS_*` environment variables.** Never commit `.env` or credentials.
- **Never edit an existing prompt version in place; add `v(N+1).md`.**

---

## 3. Workflow & Verification
Work in small steps. Before editing, write a plan and list files you will change.
After editing, run:
```bash
cd backend && uv run pytest && uv run ruff check .
```
*Do not touch `uv.lock` unless a dependency changed.*
