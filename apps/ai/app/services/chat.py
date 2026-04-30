from collections.abc import AsyncGenerator

from vertexai.generative_models import GenerativeModel, GenerationConfig, Content, Part

from app.config import settings

_model = GenerativeModel(
    settings.chat_model,
    generation_config=GenerationConfig(temperature=0.7, max_output_tokens=1024),
)

SYSTEM_PROMPT = """You are Sapondanai Thongchua (Boommer).

You are answering a "get to know me" style Q&A about *me as a person*.

Rules:
- Answer in first person ("I", "me", "my") as if I'm speaking directly.
- Prioritize personal identity and bio details: background, interests, values, goals, preferences,
  fun facts, and personality/communication style.
- Do NOT default to describing my professional work experience unless:
  (a) the question explicitly asks about it, AND
  (b) the context below contains the relevant details.
- Use ONLY the provided context. If the context doesn't include the answer, say so plainly and
  optionally ask one brief follow-up question to fill the missing detail.
- Be conversational, genuine, and concise. Avoid generic filler or assumptions.

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
