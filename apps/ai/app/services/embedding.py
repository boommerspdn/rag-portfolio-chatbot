import asyncio
from functools import partial

from vertexai.preview.language_models import TextEmbeddingInput, TextEmbeddingModel

from app.config import settings

_model = TextEmbeddingModel.from_pretrained(settings.embedding_model)

_EMBEDDING_DIM = 768


async def embed(text: str) -> list[float]:
    """Return the embedding vector for a single text string."""
    inputs = [TextEmbeddingInput(text, task_type="RETRIEVAL_QUERY")]
    fn = partial(_model.get_embeddings, inputs, output_dimensionality=_EMBEDDING_DIM)
    results = await asyncio.to_thread(fn)
    return results[0].values


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one batched call."""
    inputs = [TextEmbeddingInput(t, task_type="RETRIEVAL_DOCUMENT") for t in texts]
    fn = partial(_model.get_embeddings, inputs, output_dimensionality=_EMBEDDING_DIM)
    results = await asyncio.to_thread(fn)
    return [r.values for r in results]
