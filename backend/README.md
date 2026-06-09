# ZYVON Backend

FastAPI backend for the ZYVON stealth-design technical apparel store.

## Features
- **FastAPI**: High performance asynchronous API framework.
- **Firebase**: Firestore for database and Authentication (via custom tokens and Google OAuth).
- **Cloudinary**: Cloud storage for product images.
- **Stripe**: Payment processing for online orders and webhook handling for status updates.

## Setup

1. Create a virtual environment and install dependencies:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

2. Configure environment variables:
Copy `.env.example` to `.env` and fill in the required values. You will need credentials from Firebase, Cloudinary, and Stripe, as well as a Google OAuth Client ID and Secret.

3. Run the development server:
```bash
uvicorn main:app --reload
```

The API will be available at http://localhost:8000
Interactive API documentation will be available at http://localhost:8000/docs
