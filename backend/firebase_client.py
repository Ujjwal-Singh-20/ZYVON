import os
import firebase_admin
from firebase_admin import credentials, firestore, auth
from config import get_settings
import logging

logger = logging.getLogger(__name__)

_db = None
_app = None


def init_firebase() -> None:
    """Initialize Firebase Admin SDK. Called once at startup."""
    global _app, _db
    if _app is not None:
        return  # already initialised

    settings = get_settings()

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "zyvon-39def-firebase-adminsdk-fbsvc-0b498ef86f.json")
    
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.firebase_project_id,
                "private_key": settings.firebase_private_key.strip('"').strip("'").replace("\\n", "\n").replace("\\r", ""),
                "client_email": settings.firebase_client_email,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )

    _app = firebase_admin.initialize_app(
        cred,
        {"storageBucket": settings.firebase_storage_bucket},
    )
    _db = firestore.client()
    logger.info("Firebase Admin SDK initialised ✓")


def get_db() -> firestore.Client:
    """Return the Firestore client. Raises if not initialised."""
    if _db is None:
        raise RuntimeError("Firebase has not been initialised. Call init_firebase() first.")
    return _db


def get_auth() -> auth:
    """Return the firebase_admin.auth module (no state needed)."""
    return auth
