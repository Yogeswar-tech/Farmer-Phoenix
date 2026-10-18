# Automated Ingestion Architecture: Cloud Run Jobs & Cloud Scheduler

This document details the exact Google Cloud commands and architecture for running the Kisan Sethu data ingestion pipeline in production using **Cloud Run Jobs** triggered by **Cloud Scheduler** every 6 hours in `asia-south1`.

---

## 1. Architectural Rationale

Previously, a background scraper daemon thread was executed inside the FastAPI `lifespan` handler. In production on Google Cloud Run:
- Cloud Run scales instances dynamically and throttles CPU outside of active HTTP request lifecycles.
- Multiple uvicorn workers or multi-instance autoscaling caused scraper jobs to execute concurrently, leading to duplicate writes, rate limits, and database lock contention.
- Scraper failures could crash or slow down the web API container.

**The Solution:**
1. **Decouple Web Service from Scrapers**: The web API runs on Cloud Run with `--min-instances=1` and a single uvicorn worker per container (`--workers 1`).
2. **Cloud Run Job (`kisan-ingester`)**: Dedicated container task dedicated exclusively to running the ingestion pipeline (`python -m scrapers.ingester`).
3. **Cloud Scheduler (`kisan-scheduler-6h`)**: Executes every 6 hours (`0 */6 * * *`) via Google Cloud IAM OIDC authentication.
4. **Resilient Data Retention**: If a scraping cycle fails or third-party government portal is unreachable, the system catches the error, writes a `FAILED` audit record, retains the last good dataset, and serves it with `stale: true` and `last_sync_at`.

---

## 2. Configuration Parameters

| Parameter | Production Value | Description |
|:---|:---|:---|
| **GCP Project** | `kisan-sethu` | Target GCP Project ID |
| **GCP Region** | `asia-south1` | Mumbai region (low latency across India) |
| **Service Name** | `kisan-sethu-app` | FastAPI Web API service (`--min-instances=1`, 1 worker) |
| **Job Name** | `kisan-ingester` | Cloud Run Ingestion Job |
| **Scheduler Job** | `kisan-scheduler-6h` | Cloud Scheduler Cron trigger |
| **Schedule** | `0 */6 * * *` | Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC) |
| **Service Account** | `kisan-runner@kisan-sethu.iam.gserviceaccount.com` | Least-privilege IAM service account |

---

## 3. Step 1: Deploy Web Service with Single Worker & Min Instances

Deploy the main API container with `min-instances=1` and single uvicorn worker:

```bash
gcloud run deploy kisan-sethu-app \
    --project=kisan-sethu \
    --region=asia-south1 \
    --image=asia-south1-docker.pkg.dev/kisan-sethu/kisan-sethu-repo/kisan-sethu-app:latest \
    --platform=managed \
    --allow-unauthenticated \
    --min-instances=1 \
    --max-instances=10 \
    --cpu=1 \
    --memory=1Gi \
    --concurrency=80 \
    --set-env-vars="KS_ENV=prod,POSTGRES_SSL=true" \
    --set-secrets="KS_DATABASE_URL=ks-database-url:latest,GEMINI_API_KEY=gemini-api-key:latest" \
    --set-cloudsql-instances="kisan-sethu:asia-south1:kisan-sethu-pg"
```

> **Note**: The container `CMD` in `Dockerfile` is configured as:
> `CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]`

---

## 4. Step 2: Create the Dedicated Cloud Run Ingestion Job

Create the Cloud Run Job `kisan-ingester` that executes `scrapers/ingester.py`:

```bash
gcloud run jobs create kisan-ingester \
    --project=kisan-sethu \
    --region=asia-south1 \
    --image=asia-south1-docker.pkg.dev/kisan-sethu/kisan-sethu-repo/kisan-sethu-app:latest \
    --command="python" \
    --args="-m,scrapers.ingester" \
    --service-account=kisan-runner@kisan-sethu.iam.gserviceaccount.com \
    --set-env-vars="KS_ENV=prod,POSTGRES_SSL=true" \
    --set-secrets="KS_DATABASE_URL=ks-database-url:latest,GEMINI_API_KEY=gemini-api-key:latest" \
    --set-cloudsql-instances="kisan-sethu:asia-south1:kisan-sethu-pg" \
    --cpu=2 \
    --memory=2Gi \
    --max-retries=2 \
    --task-timeout=1200s
```

---

## 5. Step 3: Configure Cloud Scheduler (Every 6 Hours)

Create the Cloud Scheduler job to trigger the Cloud Run Job every 6 hours via Google Cloud Run API:

```bash
gcloud scheduler jobs create http kisan-scheduler-6h \
    --project=kisan-sethu \
    --location=asia-south1 \
    --schedule="0 */6 * * *" \
    --time-zone="Asia/Kolkata" \
    --uri="https://asia-south1-run.googleapis.com/v2/projects/kisan-sethu/locations/asia-south1/jobs/kisan-ingester:run" \
    --http-method=POST \
    --oauth-service-account-email=kisan-runner@kisan-sethu.iam.gserviceaccount.com \
    --description="Triggers the 6-hour APMC mandi and weather data ingestion pipeline"
```

---

## 6. Manual Execution & Verification

### Trigger Ingestion on Demand
```bash
gcloud run jobs execute kisan-ingester \
    --project=kisan-sethu \
    --region=asia-south1 \
    --wait
```

### Check Logs & Status
```bash
# List recent job executions
gcloud run jobs executions list \
    --job=kisan-ingester \
    --region=asia-south1 \
    --project=kisan-sethu

# View execution logs
gcloud logging read \
    'resource.type="cloud_run_job" AND resource.labels.job_name="kisan-ingester"' \
    --limit=50 \
    --format="table(timestamp,severity,textPayload)"
```

### Verify API Sync Status
Verify that `/v1/db/sync-status` reports health, stale flag, and last synchronization timestamp:
```bash
curl -s https://kisan-sethu-app-xxx-asia-south1.a.run.app/v1/db/sync-status | jq .
```

Expected response:
```json
{
  "status": "healthy",
  "stale": false,
  "database_engine": "PostgreSQL",
  "cadence": "Every 6 Hours (Cloud Scheduler + Cloud Run Job)",
  "retention_policy": "Last-Good-Data Protected Retention (Data never deleted when scrape fails)",
  "max_freshness_window_hours": 6,
  "hours_retention": 6,
  "last_sync_at": "2026-10-18T00:00:00Z",
  "total_records": {
    "mandi_prices": 420,
    "cold_storages": 50,
    "government_schemes": 12,
    "weather_advisories": 28
  }
}
```
