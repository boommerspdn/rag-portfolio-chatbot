# Get-to-know-me — RAG Portfolio Chatbot

A recruiter-friendly portfolio app with an AI chat experience that answers questions **about me** from curated internal docs (not generic prompts). Answers are streamed to the UI via **Server‑Sent Events (SSE)**.

## What’s inside

- **`apps/web`**: Next.js (App Router) chat UI (dev server on **3001**)
- **`apps/api`**: NestJS API gateway (exposes chat endpoint, talks to `apps/ai`)
- **`apps/ai`**: FastAPI RAG service (embed → retrieve from pgvector → generate with Gemini/Vertex AI; streams SSE)
- **`docs/`**: the source-of-truth content (about/resume/projects) used for retrieval
- **`scripts/ingest`**: offline ingestion job that chunks `docs/`, embeds, and upserts into Postgres **pgvector**

## Architecture (high level)

1. You type a question in the web UI.
2. `apps/web` calls `apps/api` (SSE).
3. `apps/api` forwards the request to `apps/ai`.
4. `apps/ai`:
   - embeds the question
   - retrieves top matching chunks from Postgres (pgvector)
   - streams the grounded answer back as SSE tokens
5. The UI renders tokens live and shows the retrieved sources.

## Quickstart (Docker Compose)

### Prerequisites

- Node.js **20+**
- pnpm **9+**
- Docker + Docker Compose
- Google Cloud ADC for local Gemini/Vertex calls:
  - `gcloud auth application-default login`

### 1) Configure env

Copy the root env file and fill in values:

```bash
cp .env.example .env
```

Key variables in `.env`:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `GCLOUD_CONFIG_DIR` (points to your local gcloud config dir)

### 2) Start services

This starts:

- Postgres + pgvector on **5432**
- FastAPI AI service on **8000**
- NestJS API gateway on **3002** (container port 3000)

```bash
docker compose up --build
```

### 3) Run the web app locally

```bash
pnpm install
pnpm --filter web dev
```

Open `http://localhost:3000`.

> The web app reads `NEXT_PUBLIC_API_URL` from `apps/web/.env`.

## Local development (without Docker for Node apps)

You can still use Docker just for Postgres, then run each app in dev mode.

### 1) Start Postgres

```bash
docker compose up db
```

### 2) AI service (FastAPI)

```bash
cd apps/ai
cp .env.example .env
python -m pip install uv
uv pip install -e .
uvicorn app.main:app --reload --port 8000
```

### 3) API gateway (NestJS)

```bash
pnpm install
pnpm --filter api start:dev
```

The API listens on `http://localhost:3000` by default.

### 4) Web app (Next.js)

```bash
pnpm --filter web dev
```

Web runs on `http://localhost:3001`.

## Ingest docs into pgvector (required for good answers)

Run this whenever `docs/` changes.

```bash
cd scripts/ingest
cp .env.example .env
python -m pip install -r requirements.txt
python ingest.py
```

Notes:

- `DOCS_DIR` defaults to the repo `docs/` (the example uses `../../docs`).
- For local auth, use Google ADC (Application Default Credentials). If you’re running in a managed environment (e.g., Cloud Run), ADC is typically provided by the service account and you should omit `GOOGLE_APPLICATION_CREDENTIALS`.

## Ports & URLs

- **Web (Next.js)**: `http://localhost:3001`
- **API (NestJS)**: `http://localhost:3000` (local), `http://localhost:3002` (docker-compose mapped)
- **AI (FastAPI)**: `http://localhost:8000`
- **DB (Postgres/pgvector)**: `localhost:5432`

## Repo scripts (root)

```bash
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm format
```

