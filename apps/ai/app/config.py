from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    google_cloud_project: str
    google_cloud_location: str
    google_application_credentials: str | None = None
    embedding_model: str
    chat_model: str
    top_k_chunks: int


settings = Settings()
