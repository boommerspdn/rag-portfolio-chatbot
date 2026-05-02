-- pgvector (required for `vector(768)` columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "ingest_runs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ingest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ingest_run_id" UUID,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(768),

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chunks_ingest_run_id_idx" ON "chunks"("ingest_run_id");

-- Cosine ANN index (HNSW works on an empty table; IVFFlat often fails until enough rows exist)
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_ingest_run_id_fkey" FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
