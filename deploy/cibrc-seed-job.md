# Cloud Run Job: CIBRC Pesticide Registry Database Seeder

This document details the exact Google Cloud Run Job specifications and `gcloud` CLI commands required to seed the official CIBRC pesticide registry into Cloud SQL / PostgreSQL in `asia-south1`.

---

## 1. Prerequisites
- **GCP Project**: `kisan-sethu`
- **Region**: `asia-south1` (Mumbai)
- **Container Registry / Artifact Registry**: `asia-south1-docker.pkg.dev/kisan-sethu/kisan-sethu-repo/kisan-sethu-app:latest`
- **Secret Manager Secret**: `ks-database-url` (contains production PostgreSQL connection URI)
- **Cloud SQL Instance Connection**: e.g., `kisan-sethu:asia-south1:kisan-sethu-pg`

---

## 2. One-Time Setup: Create Cloud Run Job

Run the following command to declare the job:

```bash
gcloud run jobs create cibrc-seed-job \
    --project=kisan-sethu \
    --region=asia-south1 \
    --image=asia-south1-docker.pkg.dev/kisan-sethu/kisan-sethu-repo/kisan-sethu-app:latest \
    --command="python" \
    --args="backend/scripts/seed_cibrc_pesticide_registry.py" \
    --set-secrets="KS_DATABASE_URL=ks-database-url:latest" \
    --set-env-vars="KS_ENV=prod,POSTGRES_SSL=true" \
    --set-cloudsql-instances="kisan-sethu:asia-south1:kisan-sethu-pg" \
    --cpu=1 \
    --memory=1Gi \
    --max-retries=3 \
    --task-timeout=300s
```

---

## 3. Execute the Seeding Job

Trigger an execution against the production PostgreSQL instance:

```bash
gcloud run jobs execute cibrc-seed-job \
    --project=kisan-sethu \
    --region=asia-south1 \
    --wait
```

---

## 4. Verify Execution Logs

Inspect the execution logs to confirm all CIBRC records were inserted or updated (idempotent upsert):

```bash
# View recent execution executions
gcloud run jobs executions list \
    --job=cibrc-seed-job \
    --region=asia-south1 \
    --project=kisan-sethu

# Tail logs of the latest execution
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=cibrc-seed-job" \
    --limit=50 \
    --project=kisan-sethu \
    --format="value(textPayload)"
```

Expected log output:
```text
[*] Initializing CIBRC Pesticide Registry Table in PostgreSQL...
[*] Inserting/Upserting CIBRC statutory approved pesticide entries (Idempotent)...
[+] Successfully seeded/upserted 85 official CIBRC pesticide records into PostgreSQL!
```

---

## 5. Idempotent Redeployments
Because `seed_cibrc_pesticide_registry.py` utilizes:
```sql
ON CONFLICT (pesticide_name, crop_key, target_pest_or_disease) DO UPDATE SET ...
```
this job can be executed safely after any new deployment, release, or CI/CD migration without risk of primary key conflicts or duplicate records.
