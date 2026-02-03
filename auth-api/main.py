"""Auth API 入口：FastAPI + CORS，挂载 /auth、/me、/admin"""
import uuid
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_tables
from routers import admin, auth, me, subscription


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        return await call_next(request)


app = FastAPI(title="Auth API", lifespan=lifespan)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if "," in settings.CORS_ORIGINS else [settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(admin.router)
app.include_router(subscription.router)


@app.get("/health")
def health():
    return {"status": "ok"}
