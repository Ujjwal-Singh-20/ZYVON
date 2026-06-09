"""
ZYVON FastAPI Backend — main application entry point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from firebase_client import init_firebase
from cloudinary_client import init_cloudinary
from razorpay_client import init_razorpay

from routers import auth, users, products, cart, orders, webhooks, admin, reviews, categories  # noqa: F401


# ---------------------------------------------------------------------------
# Startup / shutdown lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all third-party SDKs before the server starts accepting traffic."""
    init_firebase()
    init_cloudinary()
    init_razorpay()
    yield
    # Nothing to tear down for now


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="ZYVON API",
        description=(
            "Backend API for ZYVON — a stealth-design technical apparel store. "
            "Handles authentication, product management, cart, orders (Stripe + COD), "
            "and admin operations."
        ),
        version="1.0.0",
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url="/redoc" if settings.environment == "development" else None,
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    # NOTE: /webhooks/stripe must NOT have an auth dependency, so it's
    # registered before any global auth middleware.
    app.include_router(webhooks.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(products.router)
    app.include_router(cart.router)
    app.include_router(orders.router)
    app.include_router(admin.router)
    app.include_router(reviews.router)
    app.include_router(categories.router)

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------
    @app.get("/health", tags=["health"], summary="Health check")
    def health():
        return {"status": "ok", "service": "zyvon-api"}

    return app


app = create_app()


# ---------------------------------------------------------------------------
# Run directly with: python main.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
