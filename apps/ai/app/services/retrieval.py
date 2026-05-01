from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.embedding import embed


async def retrieve_chunks(query: str, db: AsyncSession) -> list[dict]:
    """Embed query, then fetch top-k chunks by cosine similarity from pgvector."""
    query_vector = await embed(query)

    rows = await db.execute(
        text("""
            SELECT id, source, content, metadata,
                   1 - (embedding <=> CAST(:vec AS vector)) AS score
            FROM chunks
            WHERE ingest_run_id = (
                SELECT id
                FROM ingest_runs
                WHERE is_active = TRUE
                ORDER BY created_at DESC
                LIMIT 1
            )
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :k
        """),
        {"vec": str(query_vector), "k": settings.top_k_chunks},
    )
    return [dict(r._mapping) for r in rows]
