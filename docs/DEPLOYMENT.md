# Production deployment (Neon + Cloud Run + Vercel + GitHub Actions)

This guide matches the production stack: **Neon** (Postgres + pgvector), **Cloud Run** (`ai` + `api`), **Vercel** (`apps/web`), **GitHub Actions** (CI + CD).

## 1. Neon

1. Create a project and database at [neon.tech](https://neon.tech).
2. Enable **pgvector** on the database (Neon SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;` if not already enabled).
3. Create **two connection strings** (same logical DB, different URL schemes for each app):
   - **Nest / Prisma (`api`):** `postgresql://` or `postgres://` (no `+asyncpg`). Example: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - **FastAPI / SQLAlchemy (`ai`):** `postgresql+asyncpg://...` with the same host, user, password, and database. See [apps/ai/.env.example](../apps/ai/.env.example).
4. Choose **direct** vs **pooler** (`-pooler` host) per [Neon docs](https://neon.com/docs/connect/connection-pooling) and use the same mode for migrations (`api` entrypoint runs `prisma migrate deploy` on startup).

Store these URLs in **GitHub Actions secrets** (`NEON_DATABASE_URL_API`, `NEON_DATABASE_URL_AI`) and/or **GCP Secret Manager** (recommended for rotation).

## 2. Google Cloud (one-time)

In your existing GCP project:

1. **Enable APIs:** Artifact Registry, Cloud Run (`run.googleapis.com`), IAM Credentials (Workload Identity Federation), Secret Manager (optional), Cloud Resource Manager. Example: `gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com --project=YOUR_PROJECT_ID`.
2. **Artifact Registry:** Create a Docker repository, e.g. `rag-portfolio-chatbot` in region `us-central1`. Image paths will look like:  
   `us-central1-docker.pkg.dev/PROJECT_ID/rag-portfolio-chatbot/ai:TAG`
3. **Workload Identity Federation:** Configure GitHub as an identity provider and a **deployer** service account with at least:
   - `roles/artifactregistry.writer`
   - `roles/run.admin`
   - `roles/iam.serviceAccountUser` on the **Cloud Run runtime** service account(s) that will execute your services  
   Store `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` (deployer email) in GitHub secrets.
4. **Cloud Run runtime / Vertex AI:** The **`ai`** service needs a service account with **`roles/aiplatform.user`** (Vertex AI User). Either:
   - Grant that role to the **default compute** service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) used by Cloud Run, or  
   - Create a dedicated SA, grant the role, and pass it with `--service-account=...` on deploy (see [scripts/deploy-cloud-run.sh](../scripts/deploy-cloud-run.sh) and workflow `flags`).

**First deploy (manual smoke test):** run [scripts/deploy-cloud-run.sh](../scripts/deploy-cloud-run.sh) from a machine with `gcloud` and Docker, after exporting the variables documented in that script. Deploy **`ai` first**, then **`api`** with `AI_BASE_URL` set to the `ai` service HTTPS URL.

## 3. GitHub repository configuration

### Secrets (repository)

| Secret | Purpose |
|--------|---------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full **provider** resource name (STS audience), exactly: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/providers/<PROVIDER_ID>`. Use the **numeric** project number after `projects/`, not the project id string. No `https://`, no `principalSet://`, no trailing newline. Copy from GCP: **IAM & Admin → Workload Identity Federation** → your pool → **provider** → resource name. |
| `GCP_SERVICE_ACCOUNT` | Deployer SA email (used by `auth`), e.g. `name@project.iam.gserviceaccount.com` |
| `NEON_DATABASE_URL_API` | Prisma `DATABASE_URL` for `api` |
| `NEON_DATABASE_URL_AI` | Asyncpg `DATABASE_URL` for `ai` |
| `WEB_ORIGIN` | Browser origin for CORS, e.g. `https://your-app.vercel.app` |

### Variables (repository, optional but useful)

| Variable | Example | Purpose |
|----------|---------|---------|
| `GCP_PROJECT_ID` | `my-gcp-project` | GCP project |
| `GCP_REGION` | `us-central1` | Artifact Registry + Cloud Run region |
| `GCP_ARTIFACT_REGISTRY` | `rag-portfolio-chatbot` | Artifact Registry repository id |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | Vertex region for `ai` (defaults to `us-central1` if unset) |
| `AI_EMBEDDING_MODEL` | `text-embedding-005` | Optional override for `ai` |
| `AI_CHAT_MODEL` | `gemini-2.5-flash` | Optional override for `ai` |
| `AI_TOP_K_CHUNKS` | `5` | Optional override for `ai` |

For **Vertex on `ai`**, grant `roles/aiplatform.user` to the Cloud Run **runtime** service account (often the project default compute SA) or attach a dedicated SA via `gcloud run services update ai --service-account=...` after first deploy. Optional: [scripts/deploy-cloud-run.sh](../scripts/deploy-cloud-run.sh) supports `GCP_CLOUDRUN_SA_AI` for the first `gcloud run deploy ai`.

Workflow: [.github/workflows/backend.yml](../.github/workflows/backend.yml).

### GitHub Actions: `Invalid value for "audience"`

If `google-github-actions/auth` fails with an STS error about **audience**, the value in `GCP_WORKLOAD_IDENTITY_PROVIDER` is not a valid identity **provider** resource name. Typical mistakes: using the **project id** (`my-project-id`) instead of **project number** in the path; pasting only the pool path (missing `/providers/...`); including a URL or `principalSet://…` binding string; or an accidental newline when saving the secret.

## 4. Vercel (Next.js)

1. Import the GitHub repo into Vercel.
2. **Root Directory (choose one):**
   - **Repository root (`.`)** — Vercel picks up root [vercel.json](../vercel.json) (`installCommand` / `buildCommand`). Framework detection may still need **Next.js** selected in the project if the dashboard does not auto-detect.
   - **`apps/web`** — root `vercel.json` is **ignored**. Set in project settings:
     - **Install command:** `cd ../.. && pnpm install --frozen-lockfile`
     - **Build command:** `cd ../.. && pnpm exec turbo run build --filter=web`
3. **Environment variables (Production):**
   - `NEXT_PUBLIC_API_URL` — HTTPS URL of the **`api`** Cloud Run service (no trailing slash unless your client expects it).
   - `NEXT_PUBLIC_MODEL_LABEL` — optional display string.

Set **Preview** env vars if preview deployments should call a staging API; otherwise they can share the same `NEXT_PUBLIC_API_URL`.

## 5. Smoke checks

- `GET` the `ai` health route (if exposed) or `api` health through the gateway.
- From the browser: open the Vercel site and send a chat message; confirm no CORS errors (`WEB_ORIGIN` must match the Vercel URL).

## 6. Local development

[docker-compose.yml](../docker-compose.yml) is unchanged for local **`db` + `ai` + `api`**. Production Neon URLs are **not** required for Compose unless you choose to point local apps at Neon.
