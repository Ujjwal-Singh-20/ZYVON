from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Firebase
    firebase_project_id: str = Field(..., validation_alias="FIREBASE_PROJECT_ID")
    firebase_private_key: str = Field(..., validation_alias="FIREBASE_PRIVATE_KEY")
    firebase_client_email: str = Field(..., validation_alias="FIREBASE_CLIENT_EMAIL")
    firebase_storage_bucket: str = Field(..., validation_alias="FIREBASE_STORAGE_BUCKET")

    # Cloudinary
    cloudinary_cloud_name: str = Field(..., validation_alias="CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key: str = Field(..., validation_alias="CLOUDINARY_API_KEY")
    cloudinary_api_secret: str = Field(..., validation_alias="CLOUDINARY_API_SECRET")

    # Razorpay
    razorpay_key_id: str = Field(..., validation_alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str = Field(..., validation_alias="RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: str = Field(..., validation_alias="RAZORPAY_WEBHOOK_SECRET")

    # Email
    smtp_email: str = Field(default="", validation_alias="SMTP_EMAIL")
    smtp_app_password: str = Field(default="", validation_alias="SMTP_APP_PASSWORD")

    # Google OAuth
    google_client_id: str = Field(..., validation_alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(..., validation_alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(..., validation_alias="GOOGLE_REDIRECT_URI")

    # Platform charges
    platform_charge_online: int = Field(default=10, validation_alias="PLATFORM_CHARGE_ONLINE")
    platform_charge_cod: int = Field(default=15, validation_alias="PLATFORM_CHARGE_COD")

    # Admin emails (comma-separated string → list)
    admin_emails_raw: str = Field(default="", validation_alias="ADMIN_EMAILS")

    # App
    app_secret_key: str = Field(..., validation_alias="APP_SECRET_KEY")
    frontend_url: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_URL")
    backend_url: str = Field(default="http://localhost:8000", validation_alias="BACKEND_URL")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    cors_origins_raw: str = Field(
        default="http://localhost:5173", validation_alias="CORS_ORIGINS"
    )

    @property
    def admin_emails(self) -> List[str]:
        return [e.strip() for e in self.admin_emails_raw.split(",") if e.strip()]

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
