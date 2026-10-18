# ==============================================================================
# Kisan Sethu - Production Full-Stack Container Dockerfile
# ==============================================================================
# Multi-Stage Build:
#   Stage 1: Node.js 20 - Builds frontend Vite SPA bundle
#   Stage 2: Python 3.12 - Installs FastAPI backend, multi-database, and scrapers
#   Result: Single unified production container serving frontend & backend
# Compliant with Google Cloud Run, AWS ECS, Render, Railway, and standard Docker
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Frontend Build
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

# Install dependencies using lockfile caching
COPY frontend/package.json ./
# If package-lock exists, copy it as well
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy frontend source files and run production build
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# STAGE 2: Backend & Unified Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runner

# Install uv binary from the official Astral container image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Environment settings for optimal production execution
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PORT=8080 \
    PYTHONPATH="/app:/app/backend" \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Create a non-root system user and group for security
RUN groupadd -r appuser -g 1000 && \
    useradd -u 1000 -r -g appuser -m -d /home/appuser -s /bin/bash appuser

# 1. Dependency Resolution & Caching Layer
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 2. Application Source, Database & Scraper Modules
COPY backend/app ./app
COPY backend/prompts ./prompts
COPY backend/data ./data
COPY database ./database
COPY scrapers ./scrapers

# 3. Copy compiled Frontend SPA bundle from Stage 1 into /app/static
COPY --from=frontend-builder /app/frontend/dist /app/static

# Final sync to install project bindings
RUN uv sync --frozen --no-dev

# Ensure non-root user owns the application directory
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose default Cloud Run / container port
EXPOSE 8080

# Container healthcheck using standard Python library on dynamic $PORT
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 -c 'import os, urllib.request; port = os.getenv("PORT", "8080"); urllib.request.urlopen(f"http://127.0.0.1:{port}/v1/health")' || exit 1

# Start FastAPI application via Uvicorn listening dynamically on 0.0.0.0:$PORT (Single worker per Cloud Run container)
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
