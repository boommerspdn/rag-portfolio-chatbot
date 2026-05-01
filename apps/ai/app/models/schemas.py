from pydantic import BaseModel, ConfigDict, field_validator
from typing import Literal


class ChatHistoryMessage(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("content must not be empty")
        return v


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str
    history: list[ChatHistoryMessage] = []
    session_id: str | None = None

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("message must not be empty")
        return v


class ChatChunk(BaseModel):
    delta: str
    done: bool = False


class HealthResponse(BaseModel):
    status: str = "ok"
