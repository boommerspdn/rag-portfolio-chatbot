"""
Offline ingest script — run once or whenever docs change.

Usage:
    python ingest.py

Steps:
    1. Read all .md / .txt files from DOCS_DIR
    2. Chunk each file with a sliding window (tiktoken-aware)
    3. Embed each chunk with text-embedding-3-small
    4. Upsert into PostgreSQL pgvector `chunks` table
"""

import asyncio
import hashlib
import os
from pathlib import Path

import asyncpg
import tiktoken
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]
OPENAI_API_KEY: str = os.environ["OPENAI_API_KEY"]
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "64"))
DOCS_DIR: Path = Path(os.getenv("DOCS_DIR", "../../docs"))

openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
tokenizer = tiktoken.get_encoding("cl100k_base")

CREATE_TABLE_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    content     TEXT NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}',
    embedding   vector(1536)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
"""


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping token-bounded chunks."""
    tokens = tokenizer.encode(text)
    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunks.append(tokenizer.decode(tokens[start:end]))
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


async def embed_batch(texts: list[str]) -> list[list[float]]:
    response = await openai_client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def chunk_id(source: str, index: int, content: str) -> str:
    digest = hashlib.sha256(f"{source}:{index}:{content}".encode()).hexdigest()[:12]
    return f"{Path(source).stem}-{index}-{digest}"


async def ingest_file(conn: asyncpg.Connection, path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    chunks = chunk_text(text)
    embeddings = await embed_batch(chunks)

    records = [
        (
            chunk_id(str(path), i, chunk),
            str(path.relative_to(DOCS_DIR)),
            chunk,
            "{}",
            str(embedding),
        )
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    await conn.executemany(
        """
        INSERT INTO chunks (id, source, content, metadata, embedding)
        VALUES ($1, $2, $3, $4::jsonb, $5::vector)
        ON CONFLICT (id) DO UPDATE
            SET content   = EXCLUDED.content,
                metadata  = EXCLUDED.metadata,
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
        total = 0
        for path in doc_files:
            count = await ingest_file(conn, path)
            print(f"  ✓ {path.name} → {count} chunks")
            total += count
        print(f"\nIngested {total} chunks from {len(doc_files)} files.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
