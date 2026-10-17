# ==============================================================================
# Kisan Sethu Backend - Production Container Dockerfile for Google Cloud Run
# ==============================================================================
# Optimized multi-stage build using Python 3.12 slim & Astral uv
# Compliant with Google Cloud Run specifications:
# 1. Binds dynamically to $PORT (default 8080) on 0.0.0.0
# 2. Handles SIGTERM/SIGINT gracefully via exec
# 3. Liveness/Readiness probes via /v1/health & /
# 4. Runs as secure non-root user (appuser)
# ==============================================================================

FROM python:3.12-slim-bookworm AS base

# Install uv binary from the official Astral container image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Environment settings for Google Cloud Run & optimal Python container execution
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

# ------------------------------------------------------------------------------
# 1. Dependency Resolution & Caching Layer
# ------------------------------------------------------------------------------
COPY pyproject.toml uv.lock ./

# Install locked production dependencies into /app/.venv without installing the project yet
RUN uv sync --frozen --no-dev --no-install-project

# ------------------------------------------------------------------------------
# 2. Application Source & Static Assets Layer
# ------------------------------------------------------------------------------
COPY app ./app
COPY prompts ./prompts
COPY data ./data

# Final sync to install project bindings
RUN uv sync --frozen --no-dev

# Ensure non-root user owns the application directory
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose default Cloud Run container port
EXPOSE 8080

# Container healthcheck using standard Python library on dynamic $PORT
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 -c 'import os, urllib.request; port = os.getenv("PORT", "8080"); urllib.request.urlopen(f"http://127.0.0.1:{port}/v1/health")' || exit 1

# Start FastAPI application via Uvicorn listening dynamically on 0.0.0.0:$PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2"]
