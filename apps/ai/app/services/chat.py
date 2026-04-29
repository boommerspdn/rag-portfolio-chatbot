from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings

_client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are {name}. Answer every question in first person, as if you are
personally responding. Be conversational, genuine, and concise. Base your answers only on
the context provided. If the context doesn't cover the question, say so honestly rather
than making things up.

Context:
{context}
"""


async def stream_answer(question: str, chunks: list[dict]) -> AsyncGenerator[str, None]:
    """Stream the LLM answer token-by-token using the retrieved context chunks."""
    context = "\n\n---\n\n".join(c["content"] for c in chunks)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(name="Boom", context=context)},
        {"role": "user", "content": question},
    ]

    stream = await _client.chat.completions.create(
        model=settings.chat_model,
        messages=messages,
        stream=True,
    )

    async for event in stream:
        delta = event.choices[0].delta.content
        if delta:
            yield delta
