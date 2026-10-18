# Kisan Sethu — Full Deployment Guide for a New GCP Account

This guide walks through every step to deploy Kisan Sethu from scratch on a brand-new GCP account.
Estimated total time: **60–90 minutes** (mostly waiting for GCP provisioning).

---

## Prerequisites

Install these on your local machine before starting:

| Tool | Install |
|---|---|
| `gcloud` CLI | https://cloud.google.com/sdk/docs/install |
| `git` | https://git-scm.com/downloads |
| `uv` (Python package manager) | `pip install uv` or `irm https://astral.sh/uv/install.ps1 \| iex` on Windows |
| GCP account with billing enabled | https://console.cloud.google.com |

After installing gcloud, authenticate:

```bash
gcloud auth login
gcloud auth application-default login
```

> **Windows users**: If `gcloud` fails on Windows (spaces in path), use Python directly:
> ```bash
> PYTHON="C:/Users/YOUR_USER/AppData/Local/Programs/Python/Python312/python.exe"
> GCLOUD="C:/Users/YOUR_USER/AppData/Local/Google/Cloud SDK/google-cloud-sdk/lib/gcloud.py"
> "$PYTHON" "$GCLOUD" <subcommands>
> ```

---

## Architecture Overview

```
GitHub (main branch)
    │  push triggers
    ▼
Cloud Build ──builds──▶ Artifact Registry (docker images)
                                │
                                │ deploys
                                ▼
                        Cloud Run (kisan-sethu)
                         │            │
                   Cloud SQL      Memorystore
                  (PostgreSQL)     (Redis)
                         │
                  Secret Manager
                  (API keys, DB password)
```

**Two GCP/Firebase projects:**
- `YOUR_GCP_PROJECT` — Cloud Run, Cloud SQL, Redis, Secret Manager, Cloud Build
- `YOUR_FIREBASE_PROJECT` — Firebase Phone Auth only (`kisansetu-dev` in the original)

---

## Step 1 — Create GCP Project

```bash
gcloud projects create YOUR_GCP_PROJECT_ID --name="Kisan Sethu"
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud billing projects link YOUR_GCP_PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
```

> Get your billing account ID: `gcloud billing accounts list`

---

## Step 2 — Enable All Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com
```

> Takes ~2 minutes. Wait for the command to return.

---

## Step 3 — Set Up Firebase Phone Auth (separate Firebase project)

1. Go to https://console.firebase.google.com → **Add project**
2. Name it (e.g., `myapp-dev`) — this becomes `YOUR_FIREBASE_PROJECT_ID`
3. Left nav: **Authentication → Sign-in method → Phone** → Enable
4. **Gear ⚙ → Project settings → Your apps → Web (`</>`)** → Register app (any nickname)
5. Copy the config block:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

6. Save these 6 values — you'll need them in Step 6.

> **Test phone numbers (no real SMS)**: Firebase Console → Authentication → Sign-in method → Phone → scroll to "Phone numbers for testing". Add `+919876543210` with code `123456`.

---

## Step 4 — Update Firebase Config in Dockerfile

Edit `Dockerfile` lines 20–25 to your Firebase project values:

```dockerfile
ENV VITE_FIREBASE_API_KEY="YOUR_API_KEY" \
    VITE_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_PROJECT_ID.firebaseapp.com" \
    VITE_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID" \
    VITE_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_PROJECT_ID.firebasestorage.app" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID" \
    VITE_FIREBASE_APP_ID="YOUR_APP_ID"
```

> These are **public values** — safe to hardcode in the Dockerfile. Firebase security comes from Security Rules + authorized domains, not key secrecy.

Commit and push this change:

```bash
git add Dockerfile
git commit -m "config: set Firebase project for new deployment"
git push origin main
```

---

## Step 5 — Create Cloud SQL (PostgreSQL)

```bash
# Create instance (~3 minutes)
gcloud sql instances create kisan-sethu-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --no-backup

# Create database
gcloud sql databases create kisan_sethu --instance=kisan-sethu-db

# Create app user (replace YOUR_DB_PASSWORD with a strong password)
gcloud sql users create kisanapp \
  --instance=kisan-sethu-db \
  --password=YOUR_DB_PASSWORD

# Save the connection name (format: PROJECT:REGION:INSTANCE)
gcloud sql instances describe kisan-sethu-db --format="value(connectionName)"
# Outputs: YOUR_GCP_PROJECT_ID:asia-south1:kisan-sethu-db
```

> **Cost**: db-f1-micro ≈ $7/month.

---

## Step 6 — Create Memorystore Redis + VPC Connector

```bash
# Create Redis (~5 minutes)
gcloud redis instances create kisan-sethu-redis \
  --size=1 \
  --region=asia-south1 \
  --redis-version=redis_7_0 \
  --tier=basic

# Get the private IP (save this)
gcloud redis instances describe kisan-sethu-redis \
  --region=asia-south1 \
  --format="value(host)"
# Outputs: 10.x.x.x

# Create VPC connector so Cloud Run can reach Redis
gcloud compute networks vpc-access connectors create kisan-sethu-connector \
  --network=default \
  --region=asia-south1 \
  --range=10.8.0.0/28
```

> **Cost**: 1GB Redis ≈ $35/month.

---

## Step 7 — Get API Keys

### Gemini (LLM):
1. https://aistudio.google.com → **Get API key → Create API key** → select your GCP project
2. Copy key → this is `KS_GEMINI_API_KEY`

### Google Maps:
1. https://console.cloud.google.com/apis/credentials → **Create Credentials → API key**
2. Restrict to **Maps JavaScript API + Geocoding API**
3. Copy key → this is `KS_GOOGLE_MAPS_API_KEY`

### Admin key (generated):
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Save the output → this is `KS_ADMIN_API_KEY`.

---

## Step 8 — Store Secrets in Secret Manager

```bash
# Helper (run once)
create_secret() {
  printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic
}

create_secret KS_GEMINI_API_KEY       "YOUR_GEMINI_KEY"
create_secret KS_GOOGLE_MAPS_API_KEY  "YOUR_MAPS_KEY"
create_secret KS_ADMIN_API_KEY        "YOUR_GENERATED_ADMIN_KEY"
create_secret POSTGRES_PASSWORD       "YOUR_DB_PASSWORD"
```

---

## Step 9 — Create Artifact Registry

```bash
gcloud artifacts repositories create kisan-sethu \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Kisan Sethu container images"
```

---

## Step 10 — Set Up Continuous Deployment (Cloud Build from GitHub)

1. In GCP Console → **Cloud Run → Create Service**
2. Under **"Continuously deploy from a repository"** → click **Set up with Cloud Build**
3. Connect your GitHub repo (`somu325/kisan-sethu` or your fork)
4. Branch: `^main$`, Build type: **Dockerfile**, Dockerfile path: `/Dockerfile`
5. Configure the service:
   - **Region**: `asia-south1`
   - **CPU**: 1, **Memory**: 1GiB
   - **Min instances**: 0, **Max**: 10
   - **Port**: 8080
   - **Allow unauthenticated**
6. Under **"Variables & Secrets"** add plain env vars:

| Name | Value |
|---|---|
| `KS_ENV` | `production` |
| `KS_GCP_PROJECT_ID` | `YOUR_FIREBASE_PROJECT_ID` |
| `KS_GCP_LOCATION` | `asia-south1` |
| `KS_CLOUD_SQL_CONNECTION_NAME` | `YOUR_GCP_PROJECT:asia-south1:kisan-sethu-db` |
| `POSTGRES_USER` | `kisanapp` |
| `POSTGRES_DB` | `kisan_sethu` |
| `KS_REDIS_URL` | `redis://YOUR_REDIS_IP:6379` |

7. Under **"Secrets"** add secret references:

| Env var name | Secret | Version |
|---|---|---|
| `KS_GEMINI_API_KEY` | `KS_GEMINI_API_KEY` | latest |
| `KS_GOOGLE_MAPS_API_KEY` | `KS_GOOGLE_MAPS_API_KEY` | latest |
| `KS_ADMIN_API_KEY` | `KS_ADMIN_API_KEY` | latest |
| `POSTGRES_PASSWORD` | `POSTGRES_PASSWORD` | latest |

8. Under **"Networking"**:
   - Check **"Connect to a VPC for outbound traffic"**
   - VPC Connector: `kisan-sethu-connector`
   - VPC egress: **All traffic**

9. Under **"Cloud SQL connections"**: add `YOUR_GCP_PROJECT:asia-south1:kisan-sethu-db`

10. Click **Create** → Cloud Build triggers automatically from main branch.

> **First build takes 8–12 minutes** (Vite build + Python deps). Subsequent builds ~5 minutes.

---

## Step 11 — Grant IAM Permissions

After the Cloud Run service is created, grant it access to secrets and Cloud SQL:

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_GCP_PROJECT_ID --format="value(projectNumber)")
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Access secrets
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"

# Connect to Cloud SQL
gcloud projects add-iam-policy-binding YOUR_GCP_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"
```

---

## Step 12 — Initialize Database Schema + CIBRC Data

After the first deploy is live:

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region=asia-south1 --format="value(status.url)")

ADMIN_KEY=$(gcloud secrets versions access latest --secret=KS_ADMIN_API_KEY)

curl -X POST "$SERVICE_URL/v1/db/pesticides/sync" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Expected response: `{"status":"success","message":"Pesticides and Crops database synchronized..."}`.

> This creates all tables AND populates the CIBRC statutory pesticide registry.

---

## Step 13 — Update CORS for Your Live URL

**Important**: Do NOT use `--update-env-vars` with URLs on the command line — gcloud misparses the `:` in `https://`. Use a flags YAML file instead:

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region=asia-south1 --format="value(status.url)")

cat > /tmp/cors_flags.yaml <<EOF
--update-env-vars:
  KS_ALLOWED_ORIGINS: "${SERVICE_URL}"
EOF

gcloud run services update kisan-sethu \
  --region=asia-south1 \
  --flags-file=/tmp/cors_flags.yaml
```

> If you have a custom domain too, add it comma-separated inside the YAML value.

---

## Step 14 — Add Firebase Authorized Domain

In Firebase Console (`YOUR_FIREBASE_PROJECT_ID`) → **Authentication → Settings → Authorized domains** → **Add domain** → paste your Cloud Run URL (without `https://`).

Example: `kisan-sethu-XXXX-as.a.run.app`

---

## Step 15 — Set Up Cloud Scheduler (6-Hour Mandi Scraping)

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region=asia-south1 --format="value(status.url)")

# Create service account
gcloud iam service-accounts create kisan-sethu-scheduler \
  --display-name="Kisan Sethu Scheduler"

SCHEDULER_SA="kisan-sethu-scheduler@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com"

# Grant invoker permission
gcloud run services add-iam-policy-binding kisan-sethu \
  --region=asia-south1 \
  --member="serviceAccount:$SCHEDULER_SA" \
  --role="roles/run.invoker"

ADMIN_KEY=$(gcloud secrets versions access latest --secret=KS_ADMIN_API_KEY)

# Job 1: 6-hour mandi price scraping
gcloud scheduler jobs create http kisan-sethu-mandi-refresh \
  --location=asia-south1 \
  --schedule="0 */6 * * *" \
  --uri="$SERVICE_URL/v1/db/scrapers/trigger" \
  --http-method=POST \
  --headers="Content-Type=application/json,X-Admin-Key=${ADMIN_KEY}" \
  --message-body='{"scraper":"agmarknet"}' \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --time-zone="Asia/Kolkata"

# Job 2: Daily DB cleanup at midnight IST (keeps only last 30 days of mandi prices)
gcloud scheduler jobs create http kisan-sethu-db-cleanup \
  --location=asia-south1 \
  --schedule="0 0 * * *" \
  --uri="$SERVICE_URL/v1/db/admin/cleanup-old-data?days_to_keep=30" \
  --http-method=POST \
  --headers="Content-Type=application/json,X-Admin-Key=${ADMIN_KEY}" \
  --message-body='{}' \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --time-zone="Asia/Kolkata"
```

---

## Step 16 — Verify Everything

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region=asia-south1 --format="value(status.url)")

# Basic health
curl "$SERVICE_URL/v1/health"
# Expected: {"status":"ok"}

# Full readiness (DB connected + CIBRC populated)
curl "$SERVICE_URL/v1/health/ready"
# Expected: {"status":"ready","ready":true,"cibrc_records":...,"database":"connected"}

# Live mandi prices
curl "$SERVICE_URL/v1/db/live-today/crop-search?q=tomato"
# Expected: JSON with price data
```

---

## Complete Environment Variables Reference

| Variable | Where to set | Value |
|---|---|---|
| `KS_ENV` | Plain env var in Cloud Run | `production` |
| `KS_GCP_PROJECT_ID` | Plain env var | Your **Firebase** project ID |
| `KS_GCP_LOCATION` | Plain env var | `asia-south1` |
| `KS_CLOUD_SQL_CONNECTION_NAME` | Plain env var | `GCP_PROJECT:asia-south1:kisan-sethu-db` |
| `POSTGRES_USER` | Plain env var | `kisanapp` |
| `POSTGRES_DB` | Plain env var | `kisan_sethu` |
| `KS_REDIS_URL` | Plain env var | `redis://MEMORYSTORE_IP:6379` |
| `KS_ALLOWED_ORIGINS` | Plain env var | Your Cloud Run URL(s) |
| `KS_GEMINI_API_KEY` | Secret Manager | Gemini API key |
| `KS_GOOGLE_MAPS_API_KEY` | Secret Manager | Maps API key |
| `KS_ADMIN_API_KEY` | Secret Manager | Generated 64-char hex |
| `POSTGRES_PASSWORD` | Secret Manager | Database password |

> **Two separate project IDs**: `KS_GCP_PROJECT_ID` must be your **Firebase project ID** (used for token verification), NOT your GCP infrastructure project ID. These are different projects.

---

## Cost Estimate (Google Cloud, asia-south1)

| Service | Tier | Monthly cost |
|---|---|---|
| Cloud Run | 0–10 instances | **Free** (2M req/month) |
| Cloud SQL | db-f1-micro, 10GB SSD | ~$7 |
| Memorystore | 1GB Redis Basic | ~$35 |
| Artifact Registry | < 0.5GB | **Free** |
| Secret Manager | < 6 secret versions | **Free** |
| Cloud Scheduler | 1 job | **Free** (3 free jobs/month) |
| **Total** | | **~$42/month** |

> GCP $300 free credit covers ~7 months. After credit expires, you can stop Memorystore — the app falls back to in-memory cache automatically with no code changes.

---

## Dependency Notes (Critical)

The Python lock file (`backend/uv.lock`) must include `psycopg2-binary` and `redis` or the container silently falls back to SQLite even in production.

If you add or update Python dependencies:

```bash
cd backend && uv lock
git add uv.lock
git commit -m "fix(deps): regenerate uv.lock"
git push origin main
```

This triggers Cloud Build automatically.

---

## Troubleshooting

### `/v1/health/ready` returns unhealthy (PostgreSQL not active)

Check Cloud Run logs:
```bash
gcloud run services logs read kisan-sethu --region=asia-south1 --limit=50 \
  | grep -i "postgres\|psycopg\|critical"
```

Common causes:
1. `No module named 'psycopg2'` → `uv.lock` is missing psycopg2-binary. Run `cd backend && uv lock && git add uv.lock && git commit && git push`.
2. `localhost:5432 connection refused` → `KS_CLOUD_SQL_CONNECTION_NAME` is not set in Cloud Run env vars.
3. `CRITICAL: KS_ENV=prod but PostgreSQL connection is not active` → Either cause above.

### Traffic pinned to old revision

After deploying a new image, if the service stays on the old revision:
```bash
gcloud run services update-traffic kisan-sethu --region=asia-south1 --to-latest
```

### gcloud URL env var update fails (bad syntax for dict arg)

Never pass `https://` URLs directly in `--update-env-vars` on the command line — the colon confuses gcloud's parser. Always use a `--flags-file` YAML:

```bash
cat > /tmp/env_flags.yaml <<EOF
--update-env-vars:
  MY_URL_VAR: "https://example.com"
EOF
gcloud run services update MY_SERVICE --region=REGION --flags-file=/tmp/env_flags.yaml
```

### CIBRC records = 0 after deploy

Run the sync endpoint manually:
```bash
ADMIN_KEY=$(gcloud secrets versions access latest --secret=KS_ADMIN_API_KEY)
curl -X POST "$SERVICE_URL/v1/db/pesticides/sync" \
  -H "X-Admin-Key: $ADMIN_KEY" -H "Content-Type: application/json" -d "{}"
```
