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

    async def event_stream():
        async for token in stream_answer(body.message, chunks):
            yield f"data: {json.dumps({'delta': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
