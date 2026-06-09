"""
Authentication router — Google OAuth flow.

Flow:
  1. Frontend redirects user to /auth/google/login
  2. Google redirects back to /auth/google/callback with ?code=...
  3. We exchange the code for tokens, get the user profile, mint a Firebase
     custom token, return it to the frontend.
  4. Frontend uses the custom token with signInWithCustomToken() to get a
     Firebase ID token for all subsequent API calls.
"""

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials

from firebase_admin import auth as firebase_auth
from firebase_client import get_db
from config import get_settings
from models import TokenOut, UserRole
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import logging
import sys
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ---------------------------------------------------------------------------
# Step 1 — redirect user to Google
# ---------------------------------------------------------------------------
@router.get("/google/login", summary="Redirect to Google OAuth consent screen")
def google_login():
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{query}")


# ---------------------------------------------------------------------------
# Step 2 — Google callback → exchange code → Firebase custom token
# ---------------------------------------------------------------------------
@router.get("/google/callback", summary="Google OAuth callback", response_model=TokenOut)
async def google_callback(code: str, request: Request):
    settings = get_settings()

    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        logger.error(f"Google token exchange failed: {token_resp.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange authorization code with Google.",
        )

    token_data = token_resp.json()
    google_access_token = token_data["access_token"]

    # Fetch user profile from Google
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )

    if userinfo_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch user info from Google.",
        )

    userinfo = userinfo_resp.json()
    email: str = userinfo["email"]
    google_uid: str = userinfo["sub"]  # Google's stable user ID

    # Determine role
    db = get_db()
    is_admin = db.collection("admins").document(email).get().exists or (email in settings.admin_emails)
    role = UserRole.admin if is_admin else UserRole.customer

    # Upsert user in Firebase Auth
    try:
        firebase_user = firebase_auth.get_user_by_email(email)
        uid = firebase_user.uid
    except firebase_auth.UserNotFoundError:
        firebase_user = firebase_auth.create_user(
            uid=google_uid,
            email=email,
            display_name=userinfo.get("name", ""),
            photo_url=userinfo.get("picture"),
            email_verified=userinfo.get("email_verified", False),
        )
        uid = firebase_user.uid

    # Upsert user doc in Firestore
    db = get_db()
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists:
        user_ref.set(
            {
                "email": email,
                "role": role.value,
                "createdAt": SERVER_TIMESTAMP,
                "orders": [],
            }
        )
    else:
        # Always sync the role in case admin list changed
        user_ref.update({"role": role.value})

    # Mint a Firebase custom token — frontend uses this with signInWithCustomToken()
    custom_token: bytes = firebase_auth.create_custom_token(uid, {"role": role.value})

    return TokenOut(
        access_token=custom_token.decode(),
        token_type="custom",  # Signal to frontend to exchange via Firebase SDK
        uid=uid,
        email=email,
        role=role,
    )


# ---------------------------------------------------------------------------
# Verify endpoint — useful for frontend to check token validity
# ---------------------------------------------------------------------------
@router.get("/me", summary="Get current user from Firebase ID token")
async def get_me(request: Request):
    """
    Frontend sends: Authorization: Bearer <Firebase ID Token>
    Returns basic user info stored in Firestore.
    """
    from dependencies import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials

    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth_header.split(" ", 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = get_db()
    uid = decoded["uid"]
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = doc.to_dict()
    return {
        "uid": uid,
        "email": data.get("email"),
        "role": data.get("role", "customer"),
    }
