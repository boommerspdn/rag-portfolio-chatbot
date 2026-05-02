import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.schemas import ChatRequest
from app.services.chat import stream_answer
from app.services.retrieval import retrieve_chunks

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("")
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Embed → retrieve → generate: streams SSE tokens back to the NestJS gateway."""
    chunks = await retrieve_chunks(body.message, db)
    min_score = 0.5
    chunks_above_threshold: list[dict] = []
    for c in chunks:
        score_raw = c.get("score")
        try:
            score = float(score_raw) if score_raw is not None else 0.0
        except (TypeError, ValueError):
            score = 0.0
        if score >= min_score:
            chunks_above_threshold.append(c)

    async def event_stream():
        sources_payload = []
        for c in chunks_above_threshold:
            meta = c.get("metadata") or {}
            if not isinstance(meta, dict):
                meta = {}
            filename = (
                meta.get("filename")
                or meta.get("source")
                or c.get("source")
                or "unknown"
            )
            score_raw = c.get("score")
            try:
                score = float(score_raw) if score_raw is not None else 0.0
            except (TypeError, ValueError):
                score = 0.0
            content = c.get("content") or ""
            sources_payload.append(
                {"filename": str(filename), "score": score, "content": str(content)}
            )
        yield f"data: {json.dumps({'sources': sources_payload})}\n\n"

        async for token in stream_answer(
            body.message,
            chunks_above_threshold,
            [m.model_dump() for m in body.history],
        ):
            yield f"data: {json.dumps({'delta': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
