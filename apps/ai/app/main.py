from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, health

app = FastAPI(title="RAG Portfolio Chatbot AI service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router, prefix="/api")
