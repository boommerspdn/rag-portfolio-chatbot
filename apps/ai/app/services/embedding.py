import asyncio

from google import genai
from google.genai import types

from app.config import settings

client = genai.Client(
    vertexai=True,
    project=settings.google_cloud_project,
    location=settings.google_cloud_location,
)

_EMBEDDING_DIM = 768


async def embed(text: str) -> list[float]:
    """Return the embedding vector for a single text string."""
    def run() -> list[float]:
        response = client.models.embed_content(
            model=settings.embedding_model,
            contents=[text],
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=_EMBEDDING_DIM,
            ),
        )
        return response.embeddings[0].values

    return await asyncio.to_thread(run)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one batched call."""
    def run() -> list[list[float]]:
        response = client.models.embed_content(
            model=settings.embedding_model,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=_EMBEDDING_DIM,
            ),
        )
        return [e.values for e in response.embeddings]

    return await asyncio.to_thread(run)
