"""
Offline ingest script — run once or whenever docs change.

Usage:
    python ingest.py

Steps:
    1. Read all .md / .txt files from DOCS_DIR
    2. Chunk each file with a sliding window (tiktoken-aware)
    3. Embed each chunk with Vertex AI text-embedding-005 (768 dims)
    4. Upsert into PostgreSQL pgvector `chunks` table
"""

import asyncio
import hashlib
import os
import uuid
import re
from pathlib import Path

import asyncpg
import tiktoken
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]
GOOGLE_CLOUD_PROJECT: str = os.environ["GOOGLE_CLOUD_PROJECT"]
GOOGLE_CLOUD_LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "64"))
REPO_ROOT: Path = Path(__file__).resolve().parents[2]
_docs_dir_raw = os.getenv("DOCS_DIR")
if _docs_dir_raw in {"../../docs", "..\\..\\docs"}:
    _docs_dir_raw = None
DOCS_DIR: Path = Path(_docs_dir_raw) if _docs_dir_raw else (REPO_ROOT / "docs")

client = genai.Client(
    vertexai=True,
    project=GOOGLE_CLOUD_PROJECT,
    location=GOOGLE_CLOUD_LOCATION,
)
tokenizer = tiktoken.get_encoding("cl100k_base")

INGEST_RUN_ID = uuid.uuid4()

CREATE_TABLE_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ingest_runs (
    id          UUID PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS chunks (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    content     TEXT NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}',
    ingest_run_id UUID,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    embedding   vector(768)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE chunks
    ADD COLUMN IF NOT EXISTS ingest_run_id UUID;

ALTER TABLE chunks
    ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS chunks_ingest_run_id_idx
    ON chunks (ingest_run_id);
"""


def chunk_text_markdown(text: str) -> list[str]:
    # Split on ## or ### headers, or --- separators
    sections = re.split(r'\n(?=#{1,3} |\-{3})', text)
    
    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        # Skip header-only/tiny chunks — must have meaningful content
        tokens = tokenizer.encode(section)
        if len(tokens) < 20:  # less than ~15 words is often just a header
            continue
        if len(tokens) <= CHUNK_SIZE:
            chunks.append(section)
        else:
            # fall back to sliding window for oversized sections
            start = 0
            while start < len(tokens):
                end = min(start + CHUNK_SIZE, len(tokens))
                chunks.append(tokenizer.decode(tokens[start:end]))
                start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


_EMBEDDING_DIM = 768


def embed_batch(texts: list[str]) -> list[list[float]]:
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=_EMBEDDING_DIM,
        ),
    )
    return [e.values for e in response.embeddings]


def chunk_id(source: str, index: int, content: str) -> str:
    digest = hashlib.sha256(f"{source}:{index}:{content}".encode()).hexdigest()[:12]
    return f"{Path(source).stem}-{index}-{digest}"


async def ingest_file(conn: asyncpg.Connection, path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    chunks = chunk_text_markdown(text)
    embeddings = embed_batch(chunks)

    records = [
        (
            chunk_id(str(path), i, chunk),
            str(path.relative_to(DOCS_DIR)),
            chunk,
            "{}",
            str(INGEST_RUN_ID),
            str(embedding),
        )
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    await conn.executemany(
        """
        INSERT INTO chunks (id, source, content, metadata, ingest_run_id, embedding)
        VALUES ($1, $2, $3, $4::jsonb, $5::uuid, $6::vector)
        ON CONFLICT (id) DO UPDATE
            SET content   = EXCLUDED.content,
                metadata  = EXCLUDED.metadata,
                ingest_run_id = EXCLUDED.ingest_run_id,
                ingested_at = now(),
                embedding = EXCLUDED.embedding
        """,
        records,
    )
    return len(records)


async def main() -> None:
    doc_files = list(DOCS_DIR.rglob("*.md")) + list(DOCS_DIR.rglob("*.txt"))
    if not doc_files:
        print(f"No .md or .txt files found in {DOCS_DIR.resolve()}")
        return

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(CREATE_TABLE_SQL)

        await conn.execute("UPDATE ingest_runs SET is_active = FALSE WHERE is_active = TRUE;")
        await conn.execute(
            "INSERT INTO ingest_runs (id, is_active) VALUES ($1::uuid, TRUE);",
            str(INGEST_RUN_ID),
        )

        total = 0
        for path in doc_files:
            count = await ingest_file(conn, path)
            print(f"  OK {path.name} -> {count} chunks")
            total += count
        print(f"\nIngested {total} chunks from {len(doc_files)} files.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
