from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    openai_api_key: str
    anthropic_api_key: str = ""
    llm_provider: str = "openai"
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    top_k_chunks: int = 5


settings = Settings()
