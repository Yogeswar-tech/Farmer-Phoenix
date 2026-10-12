# ==============================================================================
# Kisan Sethu Backend - Production Container Dockerfile
# ==============================================================================
# Multi-stage / optimized build using official Python 3.12 slim and uv binary.
# Runs as non-root user with zero external build assumptions.
# ==============================================================================

FROM python:3.12-slim-bookworm AS base

# Install uv binary from the official Astral container image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Environment settings for optimal Python container execution
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Create a non-root system user and group for security
RUN groupadd -r appuser -g 1000 && \
    useradd -u 1000 -r -g appuser -m -d /home/appuser -s /bin/bash appuser

# ------------------------------------------------------------------------------
# 1. Dependency Resolution & Caching Layer
# ------------------------------------------------------------------------------
# Copy dependency manifests first to leverage Docker layer caching
COPY pyproject.toml uv.lock ./

# Install locked production dependencies into /app/.venv without installing the project yet
RUN uv sync --frozen --no-dev --no-install-project

# ------------------------------------------------------------------------------
# 2. Application Source & Static Assets Layer
# ------------------------------------------------------------------------------
# Copy core application code, prompt templates, and data assets
COPY app ./app
COPY prompts ./prompts
COPY data ./data

# Final sync to install project bindings
RUN uv sync --frozen --no-dev

# Ensure non-root user owns the application directory (needed for vector store persistence)
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose default HTTP port
EXPOSE 8000

# Container healthcheck using standard Python library (zero curl/wget assumption)
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
    CMD python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/v1/health")' || exit 1

# Start FastAPI application via Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
