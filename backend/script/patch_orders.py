import os
from firebase_client import init_firebase, get_db

def patch_orders():
    init_firebase()
    db = get_db()
    
    # Load all products into a dictionary to easily fetch name and imageUrl by productId
    print("Loading products...")
    products = {}
    for doc in db.collection("products").stream():
        data = doc.to_dict()
        products[doc.id] = {
            "name": data.get("name", "Product"),
            "imageUrl": data.get("images", [""])[0] if data.get("images") else ""
        }
    print(f"Loaded {len(products)} products.")

    collections_to_check = [
        db.collection("orders").document("active").collection("online"),
        db.collection("orders").document("active").collection("cod"),
        db.collection("orders").document("completed").collection("items"),
        db.collection("orders").document("canceled").collection("items"),
    ]

    updated_count = 0

    for col in collections_to_check:
        print(f"Checking {col.parent.id}/{col.id}...")
        for doc in col.stream():
            data = doc.to_dict()
            order_products = data.get("products", [])
            needs_update = False
            
            for p in order_products:
                pid = p.get("productId")
                if pid and ("name" not in p or "imageUrl" not in p or not p.get("name") or not p.get("imageUrl")):
                    if pid in products:
                        p["name"] = products[pid]["name"]
                        p["imageUrl"] = products[pid]["imageUrl"]
                        needs_update = True
            
            if needs_update:
                doc.reference.update({"products": order_products})
                updated_count += 1
                print(f"Updated order {doc.id}")

    print(f"Done! Updated {updated_count} orders.")

if __name__ == "__main__":
    patch_orders()
