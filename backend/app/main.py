import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .routers import graph, personalize, assess, session, exercise, chat

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

app = FastAPI(title="Triolingo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router)
app.include_router(personalize.router)
app.include_router(assess.router)
app.include_router(session.router)
app.include_router(exercise.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
