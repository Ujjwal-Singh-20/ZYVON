"""
Routers package — re-exports all router modules so main.py can do:
  from routers import auth, users, products, cart, orders, webhooks, admin, reviews, categories
"""

from routers import auth, users, products, cart, orders, webhooks, admin, reviews, categories

__all__ = ["auth", "users", "products", "cart", "orders", "webhooks", "admin", "reviews", "categories"]
