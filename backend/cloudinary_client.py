import cloudinary
import cloudinary.uploader
from config import get_settings
import logging

logger = logging.getLogger(__name__)


def init_cloudinary() -> None:
    """Configure Cloudinary SDK from settings. Called once at startup."""
    settings = get_settings()
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    logger.info("Cloudinary SDK configured ✓")


def upload_product_image(file_bytes: bytes, public_id: str | None = None) -> dict:
    """
    Upload a product image to Cloudinary.

    Returns a dict with:
      - secure_url: HTTPS CDN URL
      - public_id: Cloudinary asset ID (useful for future deletion/transforms)
      - width, height: image dimensions
    """
    upload_kwargs: dict = {
        "folder": "zyvon/products",
        "resource_type": "image",
        "overwrite": True,
        "quality": "auto",
        "fetch_format": "auto",
    }
    if public_id:
        upload_kwargs["public_id"] = public_id

    result = cloudinary.uploader.upload(file_bytes, **upload_kwargs)
    return {
        "secure_url": result["secure_url"],
        "public_id": result["public_id"],
        "width": result.get("width"),
        "height": result.get("height"),
    }


def delete_product_image(public_id: str) -> None:
    """Delete a Cloudinary asset by public_id."""
    cloudinary.uploader.destroy(public_id, resource_type="image")
    logger.info(f"Deleted Cloudinary asset: {public_id}")
