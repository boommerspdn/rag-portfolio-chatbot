from pydantic import BaseModel, ConfigDict, field_validator


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str
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
