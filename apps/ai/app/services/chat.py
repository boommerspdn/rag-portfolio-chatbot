from collections.abc import AsyncGenerator

from vertexai.generative_models import GenerativeModel, GenerationConfig, Content, Part
from datetime import datetime

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
- Use the Retrieved Context for factual claims about my bio/details.
- You may use Conversation History for continuity (e.g., referencing what we already discussed),
  and to answer meta questions like "do you remember what I said?".
- You may do simple, explicit inferences from the Retrieved Context (e.g., calculate age from a
  birth year) as long as you show the reasoning briefly and do not invent missing facts.
- If neither Retrieved Context nor Conversation History supports the answer, say you don't know
  and ask one brief follow-up question.
- Be conversational, genuine, and concise. Avoid generic filler or assumptions.

Current year: {current_year}

Context:
{context}
"""


def history_role_to_vertex_role(role: str) -> str:
    if role == "assistant":
        return "model"
    return "user"


async def stream_answer(
    question: str, chunks: list[dict], history: list[dict] | None = None
) -> AsyncGenerator[str, None]:
    """Stream the Gemini answer token-by-token using the retrieved context chunks."""
    context = "\n\n---\n\n".join(c["content"] for c in chunks)
    system_instruction = SYSTEM_PROMPT.format(
        context=context,
        current_year=datetime.now().year,
    )

    model_with_system = GenerativeModel(
        settings.chat_model,
        system_instruction=system_instruction,
        generation_config=GenerationConfig(temperature=0.7, max_output_tokens=1024),
    )

    contents: list[Content] = []
    for m in history or []:
        if not isinstance(m, dict):
            continue
        role_raw = m.get("role")
        content_raw = m.get("content")
        if not isinstance(role_raw, str) or not isinstance(content_raw, str):
            continue
        content = content_raw.strip()
        if not content:
            continue
        contents.append(
            Content(
                role=history_role_to_vertex_role(role_raw),
                parts=[Part.from_text(content)],
            )
        )

    contents.append(Content(role="user", parts=[Part.from_text(question)]))

    async for response in await model_with_system.generate_content_async(
        contents, stream=True
    ):
        if response.text:
            yield response.text
