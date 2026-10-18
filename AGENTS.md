# Kisan Sethu: Project Guide for Coding Agents

Applies to the entire repository. `backend/AGENTS.md` provides backend-specific rules.
This file and the active code are the source of truth.

---

## 1. What We're Building
An informational decision-support web application for Indian smallholder farmers: real-time APMC mandi prices, weather-aware harvest/spray advice, soil health guides, and cautious crop doctor guidance.
- **Primary Audience**: Telugu-first farmers operating on low-bandwidth mobile networks.
- **Deployment**: **Single Dockerfile deployed on Google Cloud Run (`asia-south1`)**. The multi-stage root `Dockerfile` compiles the Vite frontend into static assets and runs the FastAPI backend serving both the API (`/v1/*`) and static client.
- **Core Technology Stack**:
  - **Frontend**: Vite + React 19 + `react-native-web` (Standard React Web SPA, **NOT Expo / expo-router**).
  - **Backend**: FastAPI (Python 3.12, managed with `uv`).
  - **Single Network Client**: `frontend/src/services/api.ts` is the **only network client** for backend communication.
  - **Backend API Routes**: In `backend/app/api/v1/`.
  - **Domain Logic**: In `backend/app/domain/`.
  - **CIBRC Database**: In `database/cibrc_isolated_db.py`.
  - **Environment Prefix**: Secrets and configuration only via `KS_*` environment variables.

---

## 2. Boundaries
1. **Prompts live in files**: All prompt text lives in `backend/prompts/<feature>/` as versioned files (e.g. `prompts/price/insight.v1.md`), with shared policy fragments in `prompts/_shared/`. Never inline prompts in Python code.
2. **One LLM gateway**: Only `backend/app/llm/` touches an AI model SDK or reads model names. Agents are thin wrappers around prompts, tools, and output schemas.
3. **The API is the only seam**: No shared code between backend and frontend. The frontend renders what the API returns. Network requests flow strictly through `frontend/src/services/api.ts`.
4. **Secrets stay out of the repo**: Configuration only via `KS_*` environment variables. Never commit `.env`.

---

## 3. Non-Negotiables (Enforced in Code and Tests)
- **Never return mock or fallback data without a visible 'sample data' flag in the API response and UI.** Silent fallback to synthetic numbers is strictly forbidden.
- **Numbers shown to farmers come from structured data, never model output.** A validator checks all responses against factual data.
- **Pesticide and fertilizer dosages only from retrieved CIBRC records.** No dosages from LLM hallucinations; CIBRC data is isolated in `database/cibrc_isolated_db.py`.
- **Photo guidance is advisory only**: Provides possible causes and check points, never a definitive statutory diagnosis.
- **No data means say so**: If data is unavailable, state it clearly along with source attribution and as-of timestamp.
- **Telugu-first accessibility**: Large touch targets, high-contrast layouts, Web Speech Synthesis audio assistance, and complete i18n coverage.

---

## 4. Verification Workflow
Work in small, testable steps. Before editing, write a plan and list files you will change. After editing, verify:
```bash
# Backend checks
cd backend && uv run pytest && uv run ruff check .

# Frontend checks
cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm test
```
*Note: Do not touch `uv.lock` unless a dependency was explicitly changed.*