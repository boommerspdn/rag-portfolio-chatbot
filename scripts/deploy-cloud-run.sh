#!/usr/bin/env bash
# Manual first-time or ad-hoc deploy of ai + api to Cloud Run (Neon for Postgres).
# Prerequisites: gcloud auth, Docker, GCP APIs enabled, Artifact Registry repo created.
# Usage: export the required variables (see docs/DEPLOYMENT.md), then:
#   bash scripts/deploy-cloud-run.sh

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${ARTIFACT_REGISTRY_REPO:?Set ARTIFACT_REGISTRY_REPO (Docker repo id)}"
: "${NEON_DATABASE_URL_AI:?Set NEON_DATABASE_URL_AI (postgresql+asyncpg://...)}"
: "${NEON_DATABASE_URL_API:?Set NEON_DATABASE_URL_API (postgresql://...)}"
: "${WEB_ORIGIN:?Set WEB_ORIGIN (https://your-vercel-app.vercel.app)}"
: "${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT}"
: "${GOOGLE_CLOUD_LOCATION:=us-central1}"

REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}"
TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"
AI_IMAGE="${REGISTRY}/ai:${TAG}"
API_IMAGE="${REGISTRY}/api:${TAG}"

export EMBEDDING_MODEL="${EMBEDDING_MODEL:-text-embedding-005}"
export CHAT_MODEL="${CHAT_MODEL:-gemini-2.5-flash}"
export TOP_K_CHUNKS="${TOP_K_CHUNKS:-5}"

echo "Configuring Docker auth for Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

echo "Building and pushing ai..."
docker build -t "${AI_IMAGE}" -f apps/ai/Dockerfile apps/ai
docker push "${AI_IMAGE}"

python3 -c "
import os

def q(s):
    return '\"' + str(s).replace('\\\\', '\\\\\\\\').replace('\"', '\\\\\"') + '\"'

m = {
    'DATABASE_URL': os.environ['NEON_DATABASE_URL_AI'],
    'GOOGLE_CLOUD_PROJECT': os.environ['GOOGLE_CLOUD_PROJECT'],
    'GOOGLE_CLOUD_LOCATION': os.environ['GOOGLE_CLOUD_LOCATION'],
    'EMBEDDING_MODEL': os.environ['EMBEDDING_MODEL'],
    'CHAT_MODEL': os.environ['CHAT_MODEL'],
    'TOP_K_CHUNKS': os.environ['TOP_K_CHUNKS'],
}
with open('/tmp/ai-env.yaml', 'w') as f:
    for k, v in m.items():
        f.write(f'{k}: {q(v)}\n')
"

echo "Deploying ai..."
DEPLOY_ARGS=(
  gcloud run deploy ai
  --project="${GCP_PROJECT_ID}"
  --region="${GCP_REGION}"
  --platform=managed
  --image="${AI_IMAGE}"
  --port=8000
  --allow-unauthenticated
  --env-vars-file=/tmp/ai-env.yaml
)
if [[ -n "${GCP_CLOUDRUN_SA_AI:-}" ]]; then
  DEPLOY_ARGS+=(--service-account="${GCP_CLOUDRUN_SA_AI}")
fi
"${DEPLOY_ARGS[@]}"

AI_URL="$(gcloud run services describe ai --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --format='value(status.url)')"
echo "AI_URL=${AI_URL}"
export AI_URL

echo "Building and pushing api..."
docker build -t "${API_IMAGE}" -f apps/api/Dockerfile .
docker push "${API_IMAGE}"

python3 -c "
import os

def q(s):
    return '\"' + str(s).replace('\\\\', '\\\\\\\\').replace('\"', '\\\\\"') + '\"'

m = {
    'DATABASE_URL': os.environ['NEON_DATABASE_URL_API'],
    'AI_BASE_URL': os.environ['AI_URL'],
    'WEB_ORIGIN': os.environ['WEB_ORIGIN'],
}
with open('/tmp/api-env.yaml', 'w') as f:
    for k, v in m.items():
        f.write(f'{k}: {q(v)}\n')
"

echo "Applying Prisma migrations (api image, one-off container)..."
docker run --rm \
  --entrypoint ./node_modules/.bin/prisma \
  -e "DATABASE_URL=${NEON_DATABASE_URL_API}" \
  "${API_IMAGE}" \
  migrate deploy

echo "Deploying api..."
gcloud run deploy api \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --platform=managed \
  --image="${API_IMAGE}" \
  --port=3000 \
  --allow-unauthenticated \
  --env-vars-file=/tmp/api-env.yaml

API_URL="$(gcloud run services describe api --project="${GCP_PROJECT_ID}" --region="${GCP_REGION}" --format='value(status.url)')"
echo "Done. Set Vercel NEXT_PUBLIC_API_URL to: ${API_URL}"
