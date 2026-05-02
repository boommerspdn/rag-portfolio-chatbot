import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime

from google import genai
from google.genai import types

from app.config import settings

client = genai.Client(
    vertexai=True,
    project=settings.google_cloud_project,
    location=settings.google_cloud_location,
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
- If the user writes in Thai (or clearly addresses you in Thai), reply in Thai and end polite sentences with "ครับ" (never "ค่ะ" or other feminine particles—speak as male).

Current year: {current_year}

Context:
{context}
"""


def history_role_to_genai_role(role: str) -> str:
    if role == "assistant":
        return "model"
    return "user"


def extract_stream_text(response: object) -> str | None:
    text = getattr(response, "text", None)
    if isinstance(text, str) and text:
        return text
    candidates = getattr(response, "candidates", None)
    if not isinstance(candidates, list) or not candidates:
        return None
    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", None)
    if not isinstance(parts, list) or not parts:
        return None
    part_text = getattr(parts[0], "text", None)
    if isinstance(part_text, str) and part_text:
        return part_text
    return None


async def stream_answer(
    question: str, chunks: list[dict], history: list[dict] | None = None
) -> AsyncGenerator[str, None]:
    """Stream the Gemini answer token-by-token using the retrieved context chunks."""
    context = "\n\n---\n\n".join(c["content"] for c in chunks)
    system_instruction = SYSTEM_PROMPT.format(
        context=context,
        current_year=datetime.now().year,
    )

    contents: list[types.Content] = []
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
            types.Content(
                role=history_role_to_genai_role(role_raw),
                parts=[types.Part.from_text(text=content)],
            )
        )

    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=question)]))

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def run_stream() -> None:
        try:
            for response in client.models.generate_content_stream(
                model=settings.chat_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=1024,
                    system_instruction=system_instruction,
                ),
            ):
                token = extract_stream_text(response)
                if token:
                    loop.call_soon_threadsafe(queue.put_nowait, token)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    asyncio.create_task(asyncio.to_thread(run_stream))

    while True:
        token = await queue.get()
        if token is None:
            break
        yield token
