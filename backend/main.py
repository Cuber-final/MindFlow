from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routers import sources, articles, config, digests, interests, behavior
from services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="AI News Aggregator",
    description="AI 新闻聚合平台 - 定时抓取 + AI 总结 + Newsletter简报",
    version="2.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sources.router)
app.include_router(articles.router)
app.include_router(config.router)
app.include_router(digests.router)
app.include_router(interests.router)
app.include_router(behavior.router)


@app.get("/")
async def root():
    return {"message": "AI News Aggregator API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
