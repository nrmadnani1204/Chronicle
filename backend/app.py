from fastapi import FastAPI

from backend.routes import chronicle, gemini, health, internal


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(health.router)
    app.include_router(chronicle.router)
    app.include_router(gemini.router)
    app.include_router(internal.router)
    return app


app = create_app()
