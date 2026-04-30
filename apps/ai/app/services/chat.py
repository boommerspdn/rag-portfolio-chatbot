from collections.abc import AsyncGenerator

from vertexai.generative_models import GenerativeModel, GenerationConfig, Content, Part

from app.config import settings

_model = GenerativeModel(
    settings.chat_model,
    generation_config=GenerationConfig(temperature=0.7, max_output_tokens=1024),
)

SYSTEM_PROMPT = """You are Boom. Answer every question in first person, as if you are
personally responding. Be conversational, genuine, and concise. Base your answers only on
the context provided. If the context doesn't cover the question, say so honestly rather
than making things up.

Context:
{context}
"""


async def stream_answer(question: str, chunks: list[dict]) -> AsyncGenerator[str, None]:
    """Stream the Gemini answer token-by-token using the retrieved context chunks."""
    context = "\n\n---\n\n".join(c["content"] for c in chunks)
    system_instruction = SYSTEM_PROMPT.format(context=context)

    model_with_system = GenerativeModel(
        settings.chat_model,
        system_instruction=system_instruction,
        generation_config=GenerationConfig(temperature=0.7, max_output_tokens=1024),
    )

    contents = [Content(role="user", parts=[Part.from_text(question)])]

    async for response in await model_with_system.generate_content_async(
        contents, stream=True
    ):
        if response.text:
            yield response.text
