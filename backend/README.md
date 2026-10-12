# Kisan Sethu Backend: Setup & Clean Run Guide

This document provides a complete, step-by-step guide to configure, run, test, and maintain the Kisan Sethu FastAPI backend without making assumptions about pre-installed system tools or external credentials.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:

1. **Python 3.12+**
   Verify with:
   ```bash
   python3 --version
   ```

2. **`uv` (Fast Python Package & Environment Manager)**
   The backend uses `uv` for dependency resolution, virtual environment management, and test execution. Do **not** use `pip` directly.
   
   If `uv` is not installed on your system, install it via:
   - **Linux / macOS**:
     ```bash
     curl -LsSf https://astral.sh/uv/install.sh | sh
     ```
   - **Windows (PowerShell)**:
     ```powershell
     powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
     ```
   Verify installation:
   ```bash
   uv --version
   ```

3. **Working Directory**
   **Crucial**: Always ensure your working directory is the `backend/` folder. All paths (`data/`, `prompts/`, `.env`) are resolved relative to `backend/`.
   ```bash
   cd backend
   ```

---

## 2. Environment Configuration (`.env`)

1. Copy the example environment template:
   ```bash
   cp .env.example .env
   ```

2. Configure the variables in `.env`:

| Variable | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `KS_ENV` | Optional | `local` | Environment identifier (`local`, `dev`, `prod`). |
| `KS_GEMINI_API_KEY` | **Optional** | *(empty)* | Google Gemini API key. If empty, the backend runs in **offline deterministic mode** (uses factual templates and mock embeddings). |
| `KS_MODEL_FAST` | Optional | `gemini-2.5-flash` | Lightweight fast model for farmer Q&A. |
| `KS_MODEL_STRONG` | Optional | `gemini-2.5-pro` | High-reasoning model for complex queries. |
| `KS_GOOGLE_MAPS_API_KEY` | Optional | *(empty)* | Google Maps Geocoding API key. If empty, built-in coordinates for major mandis are used. |
| `KS_DATA_GOV_API_KEY` | Optional | *(empty)* | data.gov.in AGMARKNET API key for live government mandi price feeds. Falls back to local sample records if empty. |
| `KS_DATA_GOV_RESOURCE_ID` | Optional | `9ef84268-d588-465a-a308-a864a43d0070` | Resource ID for AGMARKNET on data.gov.in. |
| `KS_VECTOR_STORE_TYPE` | Optional | `local` | Vector store backend: `local` (JSON), `vertex`, or `bigquery`. |
| `KS_VECTOR_STORE_PATH` | Optional | `data/rag_docs/vector_store.json` | Path where local vector store data is persisted. |
| `KS_GOOGLE_SHEETS_SPREADSHEET_ID` | Optional | *(empty)* | Google Spreadsheet ID for logging mandi audit trail. |
| `KS_GOOGLE_SERVICE_ACCOUNT_PATH` | Optional | *(empty)* | Path to Google Service Account JSON credentials. |
| `KS_GCP_PROJECT_ID` | Optional | *(empty)* | Google Cloud Project ID (if running on Vertex AI). |
| `KS_GCP_LOCATION` | Optional | `asia-south1` | GCP region for Vertex AI endpoints. |
| `KS_EMBEDDING_MODEL` | Optional | `text-embedding-004` | Model name for text embeddings. |

> [!NOTE]
> **Zero-Credential Offline Mode**:
> You do **not** need cloud credentials or an active Gemini API key to develop, test, or run the backend locally. When `KS_GEMINI_API_KEY` is blank, the backend falls back to offline deterministic generation, pre-indexed vectors, and bundled sample data.

---

## 3. Dependency Installation

Synchronize dependencies and create the `.venv` virtual environment automatically using `uv`:

```bash
uv sync
```

To include development dependencies (`pytest`, `ruff`, `mypy`):
```bash
uv sync --dev
```

This will automatically create a `.venv` directory in `backend/` and install pinned dependencies from `uv.lock`.

---

## 4. Initializing Data & Vector Store (RAG)

The backend comes pre-seeded with sample mandi chunks in `data/rag_docs/`. To index or verify the vector store:

1. **Index or verify vector store**:
   ```bash
   uv run python -m app.rag.indexer
   ```

2. **Test vector retrieval from the CLI**:
   ```bash
   uv run python -m app.rag.indexer --query "What is tomato price near Chennai?" --top-k 3
   ```

3. **(Optional) Run live ingestion pipeline**:
   To fetch recent records, generate embeddings, and update chunks:
   ```bash
   uv run python -m app.ingestion.pipeline --limit 20
   ```

---

## 5. Starting the Backend Server

Start the FastAPI application with live hot-reload using `uvicorn`:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Once running, access:
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON Contract**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

## 6. Running with Docker & Docker Compose

The backend includes a production-ready, multi-stage Docker build using `python:3.12-slim-bookworm` and `uv` with a dedicated non-root user.

### A. Using Docker Compose (Recommended)
Build and run the containerized backend with volume-persisted data:
```bash
# Build and start in background
docker compose up --build -d

# Check live logs
docker compose logs -f

# Check container health status
docker compose ps

# Stop container
docker compose down
```

### B. Using Standalone Docker CLI
1. **Build the image**:
   ```bash
   docker build -t kisan-sethu-backend:latest .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name kisan-backend \
     -p 8000:8000 \
     --env-file .env \
     -v $(pwd)/data:/app/data \
     kisan-sethu-backend:latest
   ```

3. **Check container health**:
   ```bash
   docker inspect --format='{{json .State.Health.Status}}' kisan-backend
   ```

---

## 7. Verifying the Endpoints (Smoke Tests)

You can verify the backend is running cleanly by making simple HTTP requests using `curl` or any API client:

### 1. Health Check
```bash
curl -s http://localhost:8000/v1/health
```
**Expected Output:**
```json
{"status": "ok"}
```

### 2. Available Monitored Crops
```bash
curl -s "http://localhost:8000/v1/crops?lang=en"
```

### 3. Resolve Farmer Location to Nearest Mandis
```bash
curl -s "http://localhost:8000/v1/regions/resolve?lat=13.0827&lon=80.2707"
```

### 4. Regional Price Insight (Precomputed / Cached Layer)
```bash
curl -s "http://localhost:8000/v1/insight?crop=tomato&region=Chennai&lang=en"
```

### 5. Raw Mandi Prices & Volatility
```bash
curl -s "http://localhost:8000/v1/prices?commodity=Tomato&state=Tamil+Nadu"
```

### 6. Farmer Natural Language Q&A (RAG + LLM Gateway)
```bash
curl -X POST http://localhost:8000/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is tomato price near Chennai?",
    "commodity": "Tomato",
    "location": "Chennai, Tamil Nadu",
    "lang": "en"
  }'
```

---

## 8. Quality Checks & Testing

The repository enforces strict code quality bars before changes are committed:

### A. Run Linting (Ruff)
```bash
uv run ruff check .
```
To automatically fix formatting and import order:
```bash
uv run ruff format .
```

### B. Run Strict Static Type Checking (Mypy)
```bash
uv run mypy app
```

### C. Run the Test Suite (Pytest)
For fast, deterministic offline testing (recommended):
```bash
KS_GEMINI_API_KEY="" uv run pytest
```
To run a specific test file:
```bash
KS_GEMINI_API_KEY="" uv run pytest tests/test_api.py -v
```

### D. Single Command Full Quality Gate
Run all checks at once:
```bash
uv run ruff check . && uv run mypy app && KS_GEMINI_API_KEY="" uv run pytest
```

---

## 9. Common Troubleshooting & Gotchas

1. **`FileNotFoundError: Prompt file not found: prompts/...`**
   - **Cause**: The command was executed from the repository root instead of the `backend/` directory.
   - **Fix**: Run `cd backend` first before running `uvicorn`, `python`, or `pytest`.

2. **Tests or `/v1/ask` hanging for 60+ seconds**
   - **Cause**: `KS_GEMINI_API_KEY` in `.env` is set to an invalid token or there is a network issue, causing the Google GenAI SDK to wait for connection timeouts.
   - **Fix**: Leave `KS_GEMINI_API_KEY=` blank in `.env` or run with `KS_GEMINI_API_KEY="" uv run pytest` to force deterministic offline mode.

3. **`Address already in use` on Port 8000**
   - **Cause**: Another process is already bound to port 8000.
   - **Fix**: Either stop the existing process:
     ```bash
     lsof -i :8000
     # kill -9 <PID>
     ```
     Or start uvicorn on another port:
     ```bash
     uv run uvicorn app.main:app --reload --port 8001
     ```

4. **Package Installation Issues**
   - Always install new packages through `uv` rather than `pip`:
     ```bash
     uv add <package-name>
     # Or for dev dependencies:
     uv add --dev <package-name>
     ```

---

## 10. Architectural Boundaries & Conventions

When modifying or expanding the backend, adhere to the core boundaries in [`AGENTS.md`](file:///home/thor/Desktop/Projects/kisan-sethu/backend/AGENTS.md):
- **Prompts live in files**: All prompts belong in `prompts/<feature>/<name>.v<N>.md`. Never hardcode prompt strings inside Python code.
- **Single LLM Gateway**: Only [`app/llm/client.py`](file:///home/thor/Desktop/Projects/kisan-sethu/backend/app/llm/client.py) touches the model SDK.
- **Numbers come from facts**: All prices presented to farmers are validated by [`app/domain/validator.py`](file:///home/thor/Desktop/Projects/kisan-sethu/backend/app/domain/validator.py) against retrieved facts.
- **No medical or chemical dosages**: Never generate chemical pesticide or fertilizer dosage instructions from model memory.
