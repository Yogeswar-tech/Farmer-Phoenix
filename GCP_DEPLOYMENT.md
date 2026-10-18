# Kisan Sethu — Google Cloud Run Deployment Guide

**100% Google Cloud** — Cloud SQL (PostgreSQL), Memorystore (Redis), Cloud Run, Secret Manager.

---

## Prerequisites (do these first)

| Tool | Install |
|---|---|
| `gcloud` CLI | https://cloud.google.com/sdk/docs/install |
| Docker Desktop | https://docs.docker.com/desktop/ |
| GCP account with billing enabled | https://console.cloud.google.com |

After installing gcloud, log in:

```bash
gcloud auth login
gcloud auth application-default login
```

---

## Step 1 — Set Active GCP Project

Your GCP project **`kisan-sethu`** already exists (visible in the Cloud Console project selector).
`kisansetu-dev` is a **separate Firebase project** used only for Phone Auth — do not confuse the two.

```bash
# Point gcloud at your existing GCP project
gcloud config set project kisan-sethu
gcloud auth application-default login
```

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
  compute.googleapis.com
```

> This takes about 2 minutes. Wait for the command to complete.

---

## Step 3 — Get API Keys

### 3a. Gemini API Key (Google AI Studio — free)
1. Go to: **https://aistudio.google.com**
2. Click **"Get API key"** → **"Create API key"** → select your project `kisan-sethu`
3. Copy the key — this is `KS_GEMINI_API_KEY`

### 3b. Google Maps API Key
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **Create Credentials → API key**
3. Click the key → under "API restrictions" → restrict to **Maps JavaScript API + Geocoding API**
4. Copy the key — this is `KS_GOOGLE_MAPS_API_KEY`

### 3c. Generate Admin Key
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Save this output — it is `KS_ADMIN_API_KEY`. Never put it in frontend code.

### 3d. Firebase Phone Auth Setup (for real SMS OTP)

> **Two separate projects**: Your GCP infrastructure runs in `kisan-sethu`. Firebase Auth lives in
> a separate Firebase project `kisansetu-dev`. The backend receives Firebase tokens from `kisansetu-dev`
> and verifies them with `KS_GCP_PROJECT_ID=kisansetu-dev`. They are already created.

1. Firebase project `kisansetu-dev` already exists — go to [Firebase Console](https://console.firebase.google.com)
2. Select `kisansetu-dev` — do **not** use `kisan-sethu` here
3. In the left nav: **Authentication → Sign-in method → Phone** → Enable
4. Click the **gear ⚙ → Project settings → Your apps** → click **Web `</>`**
5. Register the app (any nickname), then copy the config block that looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSyD1Jw46rpGDOckqBh2sGqePmYHXvJZFL2s",
     authDomain: "kisansetu-dev.firebaseapp.com",
     projectId: "kisansetu-dev",
     storageBucket: "kisansetu-dev.firebasestorage.app",
     messagingSenderId: "66226476599",
     appId: "1:66226476599:web:7efe71ca2f83c32818d1b2"
   };
   ```
6. Save these 6 values — you will use them as `--build-arg` in Step 8.

> **Test numbers (free, no real SMS)**: In Firebase Console → Authentication → Sign-in method → Phone → Scroll down to "Phone numbers for testing". Add `+919876543210` with code `123456`. This lets you demo the OTP flow without consuming SMS credits.

> **Local dev without Firebase**: Create `frontend/.env.local` with the same `VITE_FIREBASE_*` values. If this file is absent, the app falls back to mock tokens (works with `KS_ENV=local` backend).

---

## Step 4 — Create Cloud SQL (PostgreSQL)

```bash
# Create PostgreSQL 16 instance (db-f1-micro = smallest/cheapest)
gcloud sql instances create kisan-sethu-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --no-backup

# Wait for creation (~3 minutes), then create the database
gcloud sql databases create kisan_sethu \
  --instance=kisan-sethu-db

# Create database user (replace YOUR_STRONG_PASSWORD)
gcloud sql users create kisanapp \
  --instance=kisan-sethu-db \
  --password=YOUR_STRONG_PASSWORD
```

> **Cost**: db-f1-micro = ~$7/month. Covered by the GCP $300 free credit.

Get your Cloud SQL connection name (you will need this later):

```bash
gcloud sql instances describe kisan-sethu-db \
  --format="value(connectionName)"
# Output looks like: kisan-sethu:asia-south1:kisan-sethu-db
```

**Save this connection name.**

---

## Step 5 — Create Memorystore (Redis) + VPC Connector

Memorystore is inside a private VPC. Cloud Run needs a VPC Access Connector to reach it.

### 5a. Create Memorystore Redis instance

```bash
gcloud redis instances create kisan-sethu-redis \
  --size=1 \
  --region=asia-south1 \
  --redis-version=redis_7_0 \
  --tier=basic

# Wait ~5 minutes, then get the private IP
gcloud redis instances describe kisan-sethu-redis \
  --region=asia-south1 \
  --format="value(host)"
# Output: 10.x.x.x  ← save this IP
```

> **Cost**: 1GB Redis = ~$35/month. Covered by the GCP $300 free credit.

### 5b. Create Serverless VPC Access Connector (required for Cloud Run → Memorystore)

```bash
# Create a connector in the same region
gcloud compute networks vpc-access connectors create kisan-sethu-connector \
  --network=default \
  --region=asia-south1 \
  --range=10.8.0.0/28
```

> This allows Cloud Run (which runs in Google's managed infrastructure) to reach your private VPC where Memorystore lives.

---

## Step 6 — Store All Secrets in Secret Manager

```bash
PROJECT_ID=$(gcloud config get-value project)

# Helper function
create_secret() {
  echo -n "$2" | gcloud secrets create "$1" \
    --data-file=- \
    --replication-policy="automatic"
}

# Your GCP API keys
create_secret KS_GEMINI_API_KEY       "YOUR_GEMINI_API_KEY_FROM_STEP_3A"
create_secret KS_GOOGLE_MAPS_API_KEY  "YOUR_MAPS_API_KEY_FROM_STEP_3B"
create_secret KS_ADMIN_API_KEY        "YOUR_GENERATED_ADMIN_KEY_FROM_STEP_3C"

# Cloud SQL — password only (connection name goes as plain env var)
create_secret POSTGRES_PASSWORD       "YOUR_STRONG_PASSWORD_FROM_STEP_4"
```

---

## Step 7 — Create Artifact Registry Repository

```bash
gcloud artifacts repositories create kisan-sethu \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Kisan Sethu container images"

gcloud auth configure-docker asia-south1-docker.pkg.dev
```

---

## Step 8 — Build & Push Docker Image

Replace the `FIREBASE_*` placeholders with the values from Step 3d before running:

```bash
# Run from the root of this repo (where Dockerfile lives)
PROJECT_ID=$(gcloud config get-value project)

docker build \
  --platform linux/amd64 \
  --build-arg VITE_FIREBASE_API_KEY="AIzaSyD1Jw46rpGDOckqBh2sGqePmYHXvJZFL2s" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="kisansetu-dev.firebaseapp.com" \
  --build-arg VITE_FIREBASE_PROJECT_ID="kisansetu-dev" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="kisansetu-dev.firebasestorage.app" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="66226476599" \
  --build-arg VITE_FIREBASE_APP_ID="1:66226476599:web:7efe71ca2f83c32818d1b2" \
  -t asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-sethu/app:latest \
  .

docker push asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-sethu/app:latest
```

> On Mac with Apple Silicon: `--platform linux/amd64` is required.
> Firebase config values are **public** (not secrets) — it's safe to bake them into the Docker image.

---

## Step 9 — Deploy to Cloud Run

Replace the values in CAPITALS before running:

```bash
PROJECT_ID=$(gcloud config get-value project)
IMAGE="asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-sethu/app:latest"

# Cloud SQL connection name from Step 4 (format: GCP_PROJECT:REGION:INSTANCE)
# GCP project is kisan-sethu; kisansetu-dev is the Firebase project (different thing)
CLOUD_SQL_CONN="kisan-sethu:asia-south1:kisan-sethu-db"

# Memorystore private IP from Step 5a
REDIS_IP="10.x.x.x"

gcloud run deploy kisan-sethu \
  --image "$IMAGE" \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80 \
  --add-cloudsql-instances "$CLOUD_SQL_CONN" \
  --vpc-connector kisan-sethu-connector \
  --vpc-egress all-traffic \
  --set-env-vars "\
KS_ENV=production,\
KS_GCP_PROJECT_ID=kisansetu-dev,\
KS_GCP_LOCATION=asia-south1,\
KS_CLOUD_SQL_CONNECTION_NAME=$CLOUD_SQL_CONN,\
POSTGRES_USER=kisanapp,\
POSTGRES_DB=kisan_sethu,\
KS_REDIS_URL=redis://$REDIS_IP:6379" \
  --set-secrets "\
KS_GEMINI_API_KEY=KS_GEMINI_API_KEY:latest,\
KS_GOOGLE_MAPS_API_KEY=KS_GOOGLE_MAPS_API_KEY:latest,\
KS_ADMIN_API_KEY=KS_ADMIN_API_KEY:latest,\
POSTGRES_PASSWORD=POSTGRES_PASSWORD:latest"
```

Cloud Run prints your live URL when done:
```
Service URL: https://kisan-sethu-XXXX-as.a.run.app
```

---

## Step 10 — Grant Cloud Run Permission to Access Secrets & Cloud SQL

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

# Read secrets
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"

# Connect to Cloud SQL
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"
```

---

## Step 11 — Initialize the Database Schema

Run once after first deploy to create all tables:

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region asia-south1 \
  --format "value(status.url)")

ADMIN_KEY=$(gcloud secrets versions access latest --secret=KS_ADMIN_API_KEY)

# Trigger schema init + CIBRC data sync
curl -X POST "$SERVICE_URL/v1/db/pesticides/sync" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json"
```

---

## Step 12 — Update CORS for Your Live URL

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region asia-south1 \
  --format "value(status.url)")

gcloud run services update kisan-sethu \
  --region asia-south1 \
  --update-env-vars \
  "KS_ALLOWED_ORIGINS=$SERVICE_URL,https://yourdomain.com"
```

---

## Step 13 — Set Up Cloud Scheduler (6-Hour Mandi Scraping)

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region asia-south1 \
  --format "value(status.url)")

# Create scheduler service account
gcloud iam service-accounts create kisan-sethu-scheduler \
  --display-name="Kisan Sethu Scheduler"

SCHEDULER_SA="kisan-sethu-scheduler@$PROJECT_ID.iam.gserviceaccount.com"

# Allow it to invoke Cloud Run
gcloud run services add-iam-policy-binding kisan-sethu \
  --region asia-south1 \
  --member="serviceAccount:$SCHEDULER_SA" \
  --role="roles/run.invoker"

# Read admin key for the request header
ADMIN_KEY=$(gcloud secrets versions access latest --secret=KS_ADMIN_API_KEY)

# Create 6-hour job
gcloud scheduler jobs create http kisan-sethu-mandi-refresh \
  --location asia-south1 \
  --schedule "0 */6 * * *" \
  --uri "$SERVICE_URL/v1/db/scrapers/trigger" \
  --http-method POST \
  --headers "Content-Type=application/json,X-Admin-Key=$ADMIN_KEY" \
  --message-body '{"scraper":"agmarknet"}' \
  --oidc-service-account-email "$SCHEDULER_SA" \
  --time-zone "Asia/Kolkata"
```

---

## Step 14 — Verify Everything Works

```bash
SERVICE_URL=$(gcloud run services describe kisan-sethu \
  --region asia-south1 \
  --format "value(status.url)")

# Basic health
curl "$SERVICE_URL/v1/health"
# Expected: {"status":"ok"}

# Full readiness (DB + CIBRC)
curl "$SERVICE_URL/v1/health/ready"
# Expected: {"status":"ready","ready":true,"cibrc_records":...}

# Test mandi prices
curl "$SERVICE_URL/v1/db/live-today/crop-search?q=tomato"
```

---

## Complete Environment Variables Reference

| Variable | Set as | Value |
|---|---|---|
| `KS_ENV` | plain env var | `production` |
| `KS_GCP_PROJECT_ID` | plain env var | your project ID |
| `KS_GCP_LOCATION` | plain env var | `asia-south1` |
| `KS_CLOUD_SQL_CONNECTION_NAME` | plain env var | `PROJECT:asia-south1:kisan-sethu-db` |
| `POSTGRES_USER` | plain env var | `kisanapp` |
| `POSTGRES_DB` | plain env var | `kisan_sethu` |
| `KS_REDIS_URL` | plain env var | `redis://MEMORYSTORE_IP:6379` |
| `KS_ALLOWED_ORIGINS` | plain env var | your Cloud Run URL |
| `KS_GEMINI_API_KEY` | Secret Manager | from Step 3a |
| `KS_GOOGLE_MAPS_API_KEY` | Secret Manager | from Step 3b |
| `KS_ADMIN_API_KEY` | Secret Manager | from Step 3c |
| `POSTGRES_PASSWORD` | Secret Manager | from Step 4 |

---

## Cost Summary (100% Google Cloud)

| Service | Tier | Monthly Cost |
|---|---|---|
| Cloud Run | 0-10 instances | **Free** (2M req/month free) |
| Cloud SQL | db-f1-micro, 10GB | ~$7/month |
| Memorystore | 1GB Redis Basic | ~$35/month |
| Artifact Registry | < 0.5GB | **Free** |
| Secret Manager | < 6 versions | **Free** |
| Cloud Scheduler | 1 job | **Free** (3 free jobs) |
| **Total** | | **~$42/month** |

> **GCP $300 free credit** covers ~7 months of full operation.
> After credit runs out, Cloud SQL alone (~$7) is affordable. You can stop Memorystore and use the in-memory fallback cache (the app handles this automatically — no code changes needed).

---

## Troubleshooting

### Cloud Run can't connect to Cloud SQL
```bash
# Verify Cloud SQL instance is running
gcloud sql instances describe kisan-sethu-db --format="value(state)"
# Should print: RUNNABLE

# Check Cloud Run logs for connection errors
gcloud run services logs read kisan-sethu --region asia-south1 --limit 50
```

### Cloud Run can't reach Memorystore Redis
```bash
# Verify VPC connector is READY
gcloud compute networks vpc-access connectors describe kisan-sethu-connector \
  --region asia-south1 \
  --format="value(state)"
# Should print: READY

# Verify Memorystore IP
gcloud redis instances describe kisan-sethu-redis \
  --region asia-south1 \
  --format="value(host)"
```
Make sure `KS_REDIS_URL=redis://THAT_IP:6379` is set on Cloud Run.

If Memorystore is unreachable, the app automatically falls back to in-memory cache (no crash). You'll see this log line:
```
Redis server offline or unavailable. Falling back to resilient in-memory cache.
```

### Re-deploy after a code change
```bash
docker build --platform linux/amd64 \
  -t asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-sethu/app:latest .
docker push asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-sethu/app:latest
gcloud run deploy kisan-sethu \
  --image asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-sethu/app:latest \
  --region asia-south1
```

---

## Custom Domain (Optional)

1. Go to: https://console.cloud.google.com/run → your service → **Custom domains**
2. Add your domain and follow the DNS verification steps
3. Update `KS_ALLOWED_ORIGINS` with your custom domain
