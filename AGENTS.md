# Kisan Sethu: project guide for coding agents

Applies to the whole repo. `backend/AGENTS.md` and `frontend/AGENTS.md` add app-specific detail.
This file and the code are the source of truth. Use judgment: when something is unclear, make the most
sensible call, keep the change small, and mention your assumption in the commit or PR note.

## What we're building
An informational app for farmers: regional crop prices (mandi vs retail), weather-aware tips and cautious
crop-health guidance. Voice-first, picture-first, regional languages. No transactions or payments.

Shape of the system:
- A shared regional layer (prices, weather, facts, narratives) is computed once per region, crop and day,
  and cached. A thin personal layer answers an individual farmer by reusing those cached facts.
- Ingestion is deterministic Python on a schedule, not an agent.
- Backend: one FastAPI service with Google ADK agents, managed with uv. Frontend: one Expo app (expo-router)
  for Android, iOS and web. They talk only through the HTTP API (`/v1/*`, OpenAPI is the contract).
- The project is Kisan Sethu. Env prefix `KS_`.

## Freedom
Design, structure and implementation are your call. Choose the simplest approach that fits the patterns
already in the repo. Refactor within the area you're working on if it makes the result cleaner. Propose better
ideas where you see them. The boundaries below are the only fixed points.

## Boundaries
1. **Prompts live in files.** All prompt text goes in `backend/prompts/<feature>/` as versioned files
   (e.g. `prompts/price/insight.v1.md`), with shared fragments in `prompts/_shared/`. Not inline in Python.
   Prompts hold instructions; data arrives as injected facts. Change a prompt by adding a new version.
2. **One LLM gateway.** Only `backend/app/llm/` touches a model SDK or knows model names (from settings).
   Agents are thin: a prompt, tools and an output schema. Logic goes in tools or domain code. New features add
   a prompt folder and register an agent, so existing agents and the orchestrator stay stable.
3. **The API is the only seam.** No shared code between backend and frontend. The frontend renders what the API
   returns and never computes prices, gaps or trends. Contract changes land backend first, additive where possible.
4. **Secrets stay out of the repo.** Config via env vars; update `.env.example` when you add one.
   `EXPO_PUBLIC_*` is public, so never put secrets there.

## Non-negotiables (enforced in code and tests, not just by convention)
- Numbers shown to farmers come from structured facts, never from model output. A validator checks this.
- No pesticide or fertiliser dosages from model knowledge; only from cited, retrieved sources.
- Photo guidance is "possible causes and what to check", never a definite diagnosis.
- No data means say so; never estimate. Every answer carries source and as-of time.
- No scraping that bypasses CAPTCHAs, WAFs, logins or stated terms. Prefer official APIs.
- Collect minimum personal data; keep raw audio and photos out of logs; farmer data never trains models.

## Quality bar
- Backend: typed Python 3.12, async, Pydantic v2; `uv run ruff check . && uv run mypy app && uv run pytest`.
  Deterministic logic is pure and unit-tested; prompt changes get an eval case in `backend/evals/`.
- Frontend: strict TypeScript; all network calls through `src/lib/api.ts`; all user-facing strings from
  `src/i18n/`; accessible by default (large tap targets, never colour alone, speaker button on answers);
  `npx tsc --noEmit && npx expo lint`. Use `npx expo install` for Expo packages and stay on SDK 57.
- Small, scoped commits (`type(scope): summary`). No dead code, no placeholder files, no committed secrets.