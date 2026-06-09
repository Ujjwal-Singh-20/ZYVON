"""
FastAPI dependency injection helpers.
- get_current_user  → any authenticated user
- get_admin_user    → admin-only guard
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from firebase_client import get_db, get_auth
from config import get_settings
import logging

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=True)


def _verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims."""
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Dependency: validates Firebase ID token sent as Bearer.
    Returns decoded token dict with uid, email, etc.
    """
    token = credentials.credentials
    decoded = _verify_firebase_token(token)

    # Ensure user document exists in Firestore
    uid = decoded["uid"]
    email = decoded.get("email", "")
    db = get_db()
    settings = get_settings()

    # Check if the user's email is registered in the 'admins' collection or in config settings
    is_admin = False
    if email:
        is_admin = db.collection("admins").document(email).get().exists or (email in settings.admin_emails)
    
    role = "admin" if is_admin else "customer"

    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        # Auto-create user record on first login
        from google.cloud.firestore_v1 import SERVER_TIMESTAMP
        user_ref.set(
            {
                "email": email,
                "role": role,
                "createdAt": SERVER_TIMESTAMP,
                "orders": [],
            }
        )
        decoded["role"] = role
    else:
        user_data = user_doc.to_dict() or {}
        # Dynamic check/sync if the user was recently added or removed from the admin list
        current_db_role = user_data.get("role", "customer")
        if current_db_role != role:
            user_ref.update({"role": role})
            decoded["role"] = role
        else:
            decoded["role"] = current_db_role

    return decoded


def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: same as get_current_user but rejects non-admins."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user
