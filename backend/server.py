from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta, date, time as dtime
from typing import List, Optional, Any, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---- Setup ----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

app = FastAPI(title="Banquet Management System")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bms")

# ---- Utils ----
def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def strip_id(doc):
    if not doc: return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

async def audit(user, action: str, entity: str, entity_id: str = "", details: str = ""):
    await db.audit_logs.insert_one({
        "id": new_id(),
        "user_id": user.get("id") if user else "",
        "user_name": user.get("name") if user else "system",
        "user_role": user.get("role") if user else "system",
        "action": action, "entity": entity, "entity_id": entity_id,
        "details": details, "created_at": now_utc()
    })

# ---- Auth Dependency ----
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(401, "User not found")
        return strip_id(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_roles(*roles):
    async def _check(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user
    return _check

# ---- Models ----
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # super_admin | manager | booking_staff | accountant
    phone: Optional[str] = ""

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class CustomerIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    gst_number: Optional[str] = ""
    notes: Optional[str] = ""

class HallIn(BaseModel):
    name: str
    code: str
    capacity: int
    location: Optional[str] = ""
    description: Optional[str] = ""
    base_price: float
    hourly_price: float = 0
    status: str = "available"  # available | maintenance | inactive
    facilities: List[str] = []
    image: Optional[str] = ""

class PackageIn(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float  # per plate or fixed
    per_plate: bool = True
    services: List[str] = []
    tax_percent: float = 18.0
    discount_percent: float = 0
    status: str = "active"

class BookingIn(BaseModel):
    customer_id: str
    hall_id: str
    event_type: str
    event_name: Optional[str] = ""
    event_date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    guest_count: int
    package_id: Optional[str] = ""
    seating: Optional[str] = ""
    special_requirements: Optional[str] = ""
    hall_charges: float = 0
    package_charges: float = 0
    food_charges: float = 0
    decoration_charges: float = 0
    additional_charges: float = 0
    discount: float = 0
    tax_percent: float = 18.0
    status: str = "pending"
    notes: Optional[str] = ""

class BookingStatusUpdate(BaseModel):
    status: str

class PaymentIn(BaseModel):
    booking_id: str
    amount: float
    payment_date: str
    method: str  # cash|upi|card|bank|cheque|other
    transaction_id: Optional[str] = ""
    notes: Optional[str] = ""

class ExpenseIn(BaseModel):
    date: str
    category: str
    description: str
    amount: float
    method: str = "cash"
    vendor: Optional[str] = ""
    notes: Optional[str] = ""

class SettingsIn(BaseModel):
    business_name: str = "GrandImperia Banquets"
    address: str = ""
    phone: str = ""
    email: str = ""
    gstin: str = ""
    logo_url: str = ""
    default_tax: float = 18.0
    currency_symbol: str = "₹"

# ---- Booking helpers ----
def parse_dt(d: str, t: str) -> datetime:
    return datetime.fromisoformat(f"{d}T{t}:00")

async def check_conflict(hall_id: str, event_date: str, start_time: str, end_time: str, exclude_id: Optional[str] = None):
    new_start = parse_dt(event_date, start_time)
    new_end = parse_dt(event_date, end_time)
    if new_end <= new_start:
        raise HTTPException(400, "End time must be after start time")
    q = {"hall_id": hall_id, "event_date": event_date,
         "status": {"$in": ["hold", "pending", "confirmed", "checked_in"]}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    async for b in db.bookings.find(q):
        s = parse_dt(b["event_date"], b["start_time"])
        e = parse_dt(b["event_date"], b["end_time"])
        if new_start < e and s < new_end:
            return b
    return None

def compute_totals(payload: dict) -> dict:
    subtotal = (payload.get("hall_charges", 0) + payload.get("package_charges", 0)
                + payload.get("food_charges", 0) + payload.get("decoration_charges", 0)
                + payload.get("additional_charges", 0))
    discount = payload.get("discount", 0) or 0
    taxable = max(0, subtotal - discount)
    tax_percent = payload.get("tax_percent", 18.0) or 0
    tax = round(taxable * tax_percent / 100, 2)
    total = round(taxable + tax, 2)
    return {"subtotal": round(subtotal, 2), "tax": tax, "total_amount": total}

async def gen_booking_number() -> str:
    year = datetime.now().year
    count = await db.bookings.count_documents({})
    return f"BK-{year}-{count + 1001}"

async def gen_invoice_number() -> str:
    year = datetime.now().year
    count = await db.invoices.count_documents({})
    return f"INV-{year}-{count + 1001}"

# ==================== AUTH ====================
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    await audit(user, "login", "user", user["id"], f"{user['email']} logged in")
    return {"user": strip_id(user), "token": token}

@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.post("/auth/change-password")
async def change_password(body: PasswordChange, user=Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.old_password, full["password_hash"]):
        raise HTTPException(400, "Old password incorrect")
    await db.users.update_one({"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}

@api.post("/auth/forgot-password")
async def forgot_password(body: dict):
    email = body.get("email", "").lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False
        })
        logger.info(f"[reset] {email} token: {token}")
    return {"ok": True, "message": "If email exists, reset link sent."}

# ==================== USERS ====================
@api.get("/users")
async def list_users(user=Depends(require_roles("super_admin"))):
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(500)
    return users

@api.post("/users")
async def create_user(body: UserCreate, user=Depends(require_roles("super_admin"))):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already exists")
    doc = {"id": new_id(), "name": body.name, "email": body.email.lower(),
           "password_hash": hash_password(body.password), "role": body.role,
           "phone": body.phone, "created_at": now_utc()}
    await db.users.insert_one(doc)
    await audit(user, "create", "user", doc["id"], f"Created user {body.email}")
    return strip_id(doc)

@api.put("/users/{uid}")
async def update_user(uid: str, body: dict, user=Depends(require_roles("super_admin"))):
    upd = {k: v for k, v in body.items() if k in {"name", "role", "phone"}}
    if body.get("password"):
        upd["password_hash"] = hash_password(body["password"])
    await db.users.update_one({"id": uid}, {"$set": upd})
    await audit(user, "update", "user", uid)
    return {"ok": True}

@api.delete("/users/{uid}")
async def delete_user(uid: str, user=Depends(require_roles("super_admin"))):
    await db.users.delete_one({"id": uid})
    await audit(user, "delete", "user", uid)
    return {"ok": True}

# ==================== CUSTOMERS ====================
@api.get("/customers")
async def list_customers(user=Depends(get_current_user), q: Optional[str] = None):
    query = {}
    if q:
        query = {"$or": [{"name": {"$regex": q, "$options": "i"}},
                         {"phone": {"$regex": q, "$options": "i"}},
                         {"email": {"$regex": q, "$options": "i"}}]}
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # enrich with stats
    for c in customers:
        bookings = await db.bookings.find({"customer_id": c["id"]}, {"_id": 0}).to_list(500)
        c["total_bookings"] = len(bookings)
        c["total_revenue"] = round(sum(b.get("total_amount", 0) for b in bookings), 2)
        c["outstanding"] = round(sum((b.get("total_amount", 0) - b.get("paid_amount", 0)) for b in bookings), 2)
    return customers

@api.post("/customers")
async def create_customer(body: CustomerIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_utc(), "created_by": user["id"]})
    await db.customers.insert_one(doc)
    await audit(user, "create", "customer", doc["id"], f"Added customer {body.name}")
    doc.pop("_id", None)
    return doc

@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    c["bookings"] = await db.bookings.find({"customer_id": cid}, {"_id": 0}).sort("event_date", -1).to_list(500)
    return c

@api.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user=Depends(get_current_user)):
    await db.customers.update_one({"id": cid}, {"$set": body.model_dump()})
    await audit(user, "update", "customer", cid)
    return {"ok": True}

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(require_roles("super_admin", "manager"))):
    await db.customers.delete_one({"id": cid})
    await audit(user, "delete", "customer", cid)
    return {"ok": True}

# ==================== HALLS ====================
@api.get("/halls")
async def list_halls(user=Depends(get_current_user)):
    return await db.halls.find({}, {"_id": 0}).to_list(200)

@api.post("/halls")
async def create_hall(body: HallIn, user=Depends(require_roles("super_admin", "manager"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_utc()})
    await db.halls.insert_one(doc)
    await audit(user, "create", "hall", doc["id"], f"Added hall {body.name}")
    doc.pop("_id", None)
    return doc

@api.put("/halls/{hid}")
async def update_hall(hid: str, body: HallIn, user=Depends(require_roles("super_admin", "manager"))):
    await db.halls.update_one({"id": hid}, {"$set": body.model_dump()})
    await audit(user, "update", "hall", hid)
    return {"ok": True}

@api.delete("/halls/{hid}")
async def delete_hall(hid: str, user=Depends(require_roles("super_admin"))):
    await db.halls.delete_one({"id": hid})
    await audit(user, "delete", "hall", hid)
    return {"ok": True}

# ==================== PACKAGES ====================
@api.get("/packages")
async def list_packages(user=Depends(get_current_user)):
    return await db.packages.find({}, {"_id": 0}).to_list(200)

@api.post("/packages")
async def create_package(body: PackageIn, user=Depends(require_roles("super_admin", "manager"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_utc()})
    await db.packages.insert_one(doc)
    await audit(user, "create", "package", doc["id"])
    doc.pop("_id", None)
    return doc

@api.put("/packages/{pid}")
async def update_package(pid: str, body: PackageIn, user=Depends(require_roles("super_admin", "manager"))):
    await db.packages.update_one({"id": pid}, {"$set": body.model_dump()})
    await audit(user, "update", "package", pid)
    return {"ok": True}

@api.delete("/packages/{pid}")
async def delete_package(pid: str, user=Depends(require_roles("super_admin"))):
    await db.packages.delete_one({"id": pid})
    return {"ok": True}

# ==================== BOOKINGS ====================
@api.get("/bookings/availability")
async def check_availability(hall_id: str, event_date: str, start_time: str, end_time: str,
                              exclude_id: Optional[str] = None, user=Depends(get_current_user)):
    conflict = await check_conflict(hall_id, event_date, start_time, end_time, exclude_id)
    if conflict:
        conflict.pop("_id", None)
        return {"available": False, "conflict": conflict}
    return {"available": True}

@api.get("/bookings/calendar")
async def calendar(start: Optional[str] = None, end: Optional[str] = None,
                    hall_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if start and end:
        q["event_date"] = {"$gte": start, "$lte": end}
    if hall_id:
        q["hall_id"] = hall_id
    bookings = await db.bookings.find(q, {"_id": 0}).to_list(2000)
    # attach customer & hall names
    for b in bookings:
        c = await db.customers.find_one({"id": b.get("customer_id")}, {"name": 1, "_id": 0})
        h = await db.halls.find_one({"id": b.get("hall_id")}, {"name": 1, "_id": 0})
        b["customer_name"] = c["name"] if c else ""
        b["hall_name"] = h["name"] if h else ""
    return bookings

@api.get("/bookings")
async def list_bookings(status: Optional[str] = None, hall_id: Optional[str] = None,
                         q: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status: query["status"] = status
    if hall_id: query["hall_id"] = hall_id
    if q: query["booking_number"] = {"$regex": q, "$options": "i"}
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for b in bookings:
        c = await db.customers.find_one({"id": b.get("customer_id")}, {"name": 1, "phone": 1, "_id": 0})
        h = await db.halls.find_one({"id": b.get("hall_id")}, {"name": 1, "_id": 0})
        b["customer_name"] = c["name"] if c else ""
        b["customer_phone"] = c.get("phone", "") if c else ""
        b["hall_name"] = h["name"] if h else ""
    return bookings

@api.post("/bookings")
async def create_booking(body: BookingIn, user=Depends(get_current_user)):
    conflict = await check_conflict(body.hall_id, body.event_date, body.start_time, body.end_time)
    if conflict:
        raise HTTPException(409, f"Hall already booked from {conflict['start_time']} to {conflict['end_time']} on {conflict['event_date']}")
    data = body.model_dump()
    totals = compute_totals(data)
    doc = {**data, **totals, "id": new_id(),
           "booking_number": await gen_booking_number(),
           "paid_amount": 0, "due_amount": totals["total_amount"],
           "created_by": user["id"], "created_by_name": user["name"],
           "created_at": now_utc(), "updated_at": now_utc()}
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "create", "booking", doc["id"], f"Created {doc['booking_number']}")
    await db.notifications.insert_one({
        "id": new_id(), "type": "booking", "title": "New Booking",
        "message": f"{doc['booking_number']} created", "read": False,
        "created_at": now_utc()
    })
    return doc

@api.get("/bookings/{bid}")
async def get_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    c = await db.customers.find_one({"id": b["customer_id"]}, {"_id": 0})
    h = await db.halls.find_one({"id": b["hall_id"]}, {"_id": 0})
    p = await db.packages.find_one({"id": b.get("package_id", "")}, {"_id": 0}) if b.get("package_id") else None
    payments = await db.payments.find({"booking_id": bid}, {"_id": 0}).sort("payment_date", -1).to_list(200)
    b["customer"] = c; b["hall"] = h; b["package"] = p; b["payments"] = payments
    return b

@api.put("/bookings/{bid}")
async def update_booking(bid: str, body: BookingIn, user=Depends(get_current_user)):
    existing = await db.bookings.find_one({"id": bid})
    if not existing: raise HTTPException(404, "Not found")
    conflict = await check_conflict(body.hall_id, body.event_date, body.start_time, body.end_time, bid)
    if conflict:
        raise HTTPException(409, f"Hall conflict with {conflict['booking_number']}")
    data = body.model_dump()
    totals = compute_totals(data)
    paid = existing.get("paid_amount", 0)
    upd = {**data, **totals, "due_amount": max(0, totals["total_amount"] - paid),
           "updated_at": now_utc()}
    await db.bookings.update_one({"id": bid}, {"$set": upd})
    await audit(user, "update", "booking", bid, f"Updated {existing['booking_number']}")
    return {"ok": True}

@api.put("/bookings/{bid}/status")
async def update_status(bid: str, body: BookingStatusUpdate, user=Depends(get_current_user)):
    valid = {"inquiry", "hold", "pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"}
    if body.status not in valid:
        raise HTTPException(400, "Invalid status")
    b = await db.bookings.find_one({"id": bid})
    if not b: raise HTTPException(404, "Not found")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": body.status, "updated_at": now_utc()}})
    await audit(user, "status", "booking", bid, f"{b['booking_number']} → {body.status}")
    return {"ok": True}

@api.delete("/bookings/{bid}")
async def delete_booking(bid: str, user=Depends(require_roles("super_admin"))):
    b = await db.bookings.find_one({"id": bid})
    if not b: raise HTTPException(404, "Not found")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "cancelled", "updated_at": now_utc()}})
    await audit(user, "cancel", "booking", bid, f"Cancelled {b['booking_number']}")
    return {"ok": True}

# ==================== PAYMENTS ====================
@api.get("/payments")
async def list_payments(user=Depends(get_current_user)):
    payments = await db.payments.find({}, {"_id": 0}).sort("payment_date", -1).to_list(2000)
    for p in payments:
        b = await db.bookings.find_one({"id": p["booking_id"]}, {"booking_number": 1, "customer_id": 1, "_id": 0})
        if b:
            p["booking_number"] = b["booking_number"]
            c = await db.customers.find_one({"id": b["customer_id"]}, {"name": 1, "_id": 0})
            p["customer_name"] = c["name"] if c else ""
    return payments

@api.post("/payments")
async def create_payment(body: PaymentIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": body.booking_id})
    if not b: raise HTTPException(404, "Booking not found")
    if body.amount <= 0: raise HTTPException(400, "Amount must be positive")
    new_paid = b.get("paid_amount", 0) + body.amount
    if new_paid > b["total_amount"] + 0.01:
        raise HTTPException(400, f"Payment exceeds due amount (₹{b['total_amount'] - b.get('paid_amount', 0):.2f})")
    doc = body.model_dump()
    doc.update({"id": new_id(), "payment_number": f"PAY-{await db.payments.count_documents({}) + 1001}",
                "created_by": user["id"], "created_at": now_utc()})
    await db.payments.insert_one(doc)
    await db.bookings.update_one({"id": body.booking_id},
        {"$set": {"paid_amount": new_paid, "due_amount": max(0, b["total_amount"] - new_paid)}})
    await audit(user, "create", "payment", doc["id"], f"₹{body.amount} for {b['booking_number']}")
    doc.pop("_id", None)
    return doc

# ==================== INVOICES ====================
@api.get("/invoices")
async def list_invoices(user=Depends(get_current_user)):
    return await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.post("/invoices/{booking_id}")
async def create_invoice(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b: raise HTTPException(404, "Booking not found")
    existing = await db.invoices.find_one({"booking_id": booking_id})
    if existing:
        existing.pop("_id", None)
        return existing
    doc = {"id": new_id(), "invoice_number": await gen_invoice_number(),
           "booking_id": booking_id, "booking_number": b["booking_number"],
           "customer_id": b["customer_id"], "hall_id": b["hall_id"],
           "subtotal": b["subtotal"], "discount": b["discount"], "tax": b["tax"],
           "total_amount": b["total_amount"], "paid_amount": b.get("paid_amount", 0),
           "due_amount": b.get("due_amount", 0), "created_at": now_utc()}
    await db.invoices.insert_one(doc)
    await audit(user, "create", "invoice", doc["id"], doc["invoice_number"])
    return doc

@api.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv: raise HTTPException(404, "Not found")
    inv["booking"] = await db.bookings.find_one({"id": inv["booking_id"]}, {"_id": 0})
    inv["customer"] = await db.customers.find_one({"id": inv["customer_id"]}, {"_id": 0})
    inv["hall"] = await db.halls.find_one({"id": inv["hall_id"]}, {"_id": 0})
    inv["settings"] = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return inv

# ==================== EXPENSES ====================
@api.get("/expenses")
async def list_expenses(user=Depends(get_current_user)):
    return await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(2000)

@api.post("/expenses")
async def create_expense(body: ExpenseIn, user=Depends(require_roles("super_admin", "manager", "accountant"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "expense_number": f"EXP-{await db.expenses.count_documents({}) + 1001}",
                "created_by": user["id"], "created_by_name": user["name"], "created_at": now_utc()})
    await db.expenses.insert_one(doc)
    await audit(user, "create", "expense", doc["id"], f"₹{body.amount} - {body.category}")
    doc.pop("_id", None)
    return doc

@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(require_roles("super_admin", "manager"))):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}

# ==================== DASHBOARD ====================
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    today = date.today().isoformat()
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(5000)
    total_revenue = sum(b.get("total_amount", 0) for b in bookings if b["status"] != "cancelled")
    paid_revenue = sum(b.get("paid_amount", 0) for b in bookings)
    pending_revenue = sum(b.get("due_amount", 0) for b in bookings if b["status"] != "cancelled")
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    today_bookings = [b for b in bookings if b["event_date"] == today]
    upcoming = [b for b in bookings if b["event_date"] >= today and b["status"] in ("confirmed", "pending", "hold")]
    upcoming.sort(key=lambda x: (x["event_date"], x["start_time"]))
    status_counts: Dict[str, int] = {}
    for b in bookings:
        status_counts[b["status"]] = status_counts.get(b["status"], 0) + 1
    # month buckets last 6
    from collections import defaultdict
    months = defaultdict(lambda: {"revenue": 0, "bookings": 0, "expenses": 0})
    for b in bookings:
        m = b["event_date"][:7]
        months[m]["revenue"] += b.get("paid_amount", 0)
        months[m]["bookings"] += 1
    for e in expenses:
        m = e["date"][:7]
        months[m]["expenses"] += e.get("amount", 0)
    monthly = [{"month": k, **v} for k, v in sorted(months.items())][-6:]
    # hall performance
    halls = await db.halls.find({}, {"_id": 0}).to_list(200)
    hall_perf = []
    for h in halls:
        hb = [b for b in bookings if b["hall_id"] == h["id"] and b["status"] != "cancelled"]
        hall_perf.append({"hall": h["name"], "bookings": len(hb),
                          "revenue": sum(b.get("total_amount", 0) for b in hb)})
    return {
        "kpis": {
            "total_bookings": len(bookings),
            "today_bookings": len(today_bookings),
            "upcoming_events": len(upcoming),
            "confirmed": status_counts.get("confirmed", 0),
            "pending": status_counts.get("pending", 0),
            "cancelled": status_counts.get("cancelled", 0),
            "total_revenue": round(total_revenue, 2),
            "paid_revenue": round(paid_revenue, 2),
            "pending_revenue": round(pending_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(paid_revenue - total_expenses, 2),
        },
        "status_counts": status_counts,
        "monthly": monthly,
        "hall_performance": hall_perf,
        "upcoming": [{**b,
                      "customer_name": (await db.customers.find_one({"id": b["customer_id"]}, {"name": 1, "_id": 0}) or {}).get("name", ""),
                      "hall_name": (await db.halls.find_one({"id": b["hall_id"]}, {"name": 1, "_id": 0}) or {}).get("name", "")}
                     for b in upcoming[:8]]
    }

# ==================== REPORTS ====================
@api.get("/reports/summary")
async def report_summary(start: Optional[str] = None, end: Optional[str] = None,
                          user=Depends(get_current_user)):
    bq = {}
    if start and end: bq["event_date"] = {"$gte": start, "$lte": end}
    bookings = await db.bookings.find(bq, {"_id": 0}).to_list(5000)
    eq = {}
    if start and end: eq["date"] = {"$gte": start, "$lte": end}
    expenses = await db.expenses.find(eq, {"_id": 0}).to_list(5000)
    total_rev = sum(b.get("total_amount", 0) for b in bookings if b["status"] != "cancelled")
    paid = sum(b.get("paid_amount", 0) for b in bookings)
    pending = sum(b.get("due_amount", 0) for b in bookings if b["status"] != "cancelled")
    tax_collected = sum(b.get("tax", 0) for b in bookings if b["status"] != "cancelled")
    discounts = sum(b.get("discount", 0) for b in bookings if b["status"] != "cancelled")
    total_exp = sum(e.get("amount", 0) for e in expenses)
    # by category
    exp_by_cat = {}
    for e in expenses:
        exp_by_cat[e["category"]] = exp_by_cat.get(e["category"], 0) + e["amount"]
    # by event type
    event_types = {}
    for b in bookings:
        if b["status"] == "cancelled": continue
        event_types[b["event_type"]] = event_types.get(b["event_type"], 0) + 1
    # halls
    halls = await db.halls.find({}, {"_id": 0}).to_list(200)
    hall_rev = []
    for h in halls:
        hb = [b for b in bookings if b["hall_id"] == h["id"] and b["status"] != "cancelled"]
        hall_rev.append({"hall": h["name"], "bookings": len(hb),
                          "revenue": sum(b.get("total_amount", 0) for b in hb)})
    status = {}
    for b in bookings:
        status[b["status"]] = status.get(b["status"], 0) + 1
    return {
        "revenue": {"total": total_rev, "paid": paid, "pending": pending,
                    "tax": tax_collected, "discounts": discounts},
        "expenses": {"total": total_exp, "by_category": exp_by_cat},
        "profit": {"net": paid - total_exp},
        "bookings": {"total": len(bookings), "by_status": status},
        "event_types": event_types,
        "halls": hall_rev
    }

# ==================== AUDIT LOGS ====================
@api.get("/audit-logs")
async def list_audit(user=Depends(require_roles("super_admin", "manager"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

# ==================== NOTIFICATIONS ====================
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    return await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.put("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}

@api.put("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}

# ==================== SETTINGS ====================
@api.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return s or {"id": "main", **SettingsIn().model_dump()}

@api.put("/settings")
async def update_settings(body: SettingsIn, user=Depends(require_roles("super_admin"))):
    await db.settings.update_one({"id": "main"}, {"$set": body.model_dump()}, upsert=True)
    await audit(user, "update", "settings", "main")
    return {"ok": True}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== SEED ====================
DEMO_HALLS = [
    {"name": "Grand Imperial Ballroom", "code": "GIB", "capacity": 1200, "location": "Ground Floor",
     "description": "Signature ballroom for weddings & galas.", "base_price": 150000, "hourly_price": 15000,
     "status": "available",
     "facilities": ["AC", "Stage", "Sound System", "LED Wall", "Parking", "Catering"],
     "image": "https://images.unsplash.com/photo-1780593116478-c46838f86523?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"name": "Crystal Chandelier Hall", "code": "CCH", "capacity": 500, "location": "Level 1",
     "description": "Elegant mid-size hall with crystal chandeliers.", "base_price": 85000, "hourly_price": 9000,
     "status": "available",
     "facilities": ["AC", "Sound System", "Buffet Counter", "Parking"],
     "image": "https://images.unsplash.com/photo-1768851142332-75f3d1b47452?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"name": "Royal Pavilion Courtyard", "code": "RPC", "capacity": 800, "location": "Outdoor",
     "description": "Open-air pavilion with weather-proof marquee.", "base_price": 110000, "hourly_price": 12000,
     "status": "available",
     "facilities": ["Stage", "Sound System", "Parking", "Decoration", "Catering"],
     "image": "https://images.unsplash.com/photo-1780542900375-0cf459e38fbb?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"name": "Emerald Executive Suite", "code": "EES", "capacity": 200, "location": "Level 2",
     "description": "Corporate conference suite with 4K projector.", "base_price": 45000, "hourly_price": 5000,
     "status": "available",
     "facilities": ["AC", "Projector", "Wi-Fi", "Podium", "Coffee Setup"],
     "image": "https://images.unsplash.com/photo-1768508951405-10e83c4a2872?crop=entropy&cs=srgb&fm=jpg&q=85"},
]

DEMO_PACKAGES = [
    {"name": "Royal Punjabi Wedding Feast", "description": "Multi-course wedding menu with live counters.",
     "price": 1450, "per_plate": True, "services": ["Welcome Drinks", "Starters", "Main Course", "Desserts", "Stage Decor"],
     "tax_percent": 18, "discount_percent": 0, "status": "active"},
    {"name": "Platinum Corporate Gala", "description": "Premium corporate banquet package.",
     "price": 1850, "per_plate": True, "services": ["High Tea", "Buffet Lunch", "AV Setup", "Photography"],
     "tax_percent": 18, "discount_percent": 0, "status": "active"},
    {"name": "Pearl Social & Birthday", "description": "Fun social celebration package.",
     "price": 950, "per_plate": True, "services": ["Snacks", "Cake Cutting", "DJ", "Basic Decor"],
     "tax_percent": 18, "discount_percent": 0, "status": "active"},
    {"name": "Silver Cocktail Reception", "description": "Elegant cocktail evening.",
     "price": 1200, "per_plate": True, "services": ["Cocktails", "Live Music", "Canapés", "Ambient Lights"],
     "tax_percent": 18, "discount_percent": 0, "status": "active"},
]

async def seed():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.bookings.create_index("booking_number", unique=True)
    await db.bookings.create_index([("hall_id", 1), ("event_date", 1)])
    await db.customers.create_index("phone")

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    pw_hash = hash_password(admin_pw)

    seed_users = [
        {"name": "Ankur Sharma", "email": admin_email, "role": "super_admin", "phone": "+91-98765-00001"},
        {"name": "Priya Manager", "email": "manager@bms.com", "role": "manager", "phone": "+91-98765-00002"},
        {"name": "Rohan Staff", "email": "staff@bms.com", "role": "booking_staff", "phone": "+91-98765-00003"},
        {"name": "Anita Accountant", "email": "accountant@bms.com", "role": "accountant", "phone": "+91-98765-00004"},
    ]
    for u in seed_users:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one({"id": new_id(), **u,
                                        "password_hash": pw_hash, "created_at": now_utc()})
        else:
            await db.users.update_one({"email": u["email"]},
                {"$set": {"password_hash": pw_hash, "role": u["role"], "name": u["name"]}})

    # Halls
    if await db.halls.count_documents({}) == 0:
        for h in DEMO_HALLS:
            await db.halls.insert_one({"id": new_id(), **h, "created_at": now_utc()})

    # Packages
    if await db.packages.count_documents({}) == 0:
        for p in DEMO_PACKAGES:
            await db.packages.insert_one({"id": new_id(), **p, "created_at": now_utc()})

    # Customers + Bookings + Payments + Expenses
    if await db.bookings.count_documents({}) == 0:
        halls = await db.halls.find({}, {"_id": 0}).to_list(10)
        packages = await db.packages.find({}, {"_id": 0}).to_list(10)
        demo_customers = [
            {"name": "Aditya & Meera", "phone": "+91-99000-11111", "email": "aditya@example.com",
             "address": "1 Prestige Ave", "city": "Mumbai", "gst_number": "", "notes": "Prefers pure veg"},
            {"name": "Vikram Enterprises", "phone": "+91-99000-22222", "email": "vikram.corp@example.com",
             "address": "12 Corporate Park", "city": "Bengaluru", "gst_number": "29ABCDE1234F1Z5", "notes": ""},
            {"name": "Riya Kapoor", "phone": "+91-99000-33333", "email": "riya@example.com",
             "address": "7 Rose Villa", "city": "Delhi", "gst_number": "", "notes": "Birthday events"},
            {"name": "TechNova Ltd", "phone": "+91-99000-44444", "email": "events@technova.com",
             "address": "Tower B, IT Park", "city": "Pune", "gst_number": "27ABCDE9999F2Z8", "notes": ""},
            {"name": "Nikhil & Family", "phone": "+91-99000-55555", "email": "nikhil@example.com",
             "address": "88 Green Meadows", "city": "Hyderabad", "gst_number": "", "notes": ""},
        ]
        cust_ids = []
        for c in demo_customers:
            cid = new_id()
            cust_ids.append(cid)
            await db.customers.insert_one({"id": cid, **c, "created_at": now_utc(), "created_by": "seed"})

        today = date.today()
        sample = [
            (0, halls[0], packages[0], cust_ids[0], "Wedding", "Aditya × Meera Wedding", "10:00", "23:00", 700, "confirmed", 700000, 300000, 60000, 20000),
            (2, halls[1], packages[1], cust_ids[1], "Corporate Meeting", "Vikram AGM 2026", "09:00", "17:00", 350, "confirmed", 350000, 200000, 20000, 0),
            (5, halls[2], packages[2], cust_ids[2], "Birthday", "Riya's 25th Birthday", "18:00", "23:00", 200, "pending", 200000, 100000, 15000, 10000),
            (7, halls[3], packages[1], cust_ids[3], "Conference", "TechNova Product Launch", "10:00", "16:00", 150, "confirmed", 150000, 80000, 10000, 0),
            (10, halls[0], packages[0], cust_ids[4], "Reception", "Nikhil Reception Night", "19:00", "23:59", 900, "hold", 900000, 400000, 80000, 30000),
            (-5, halls[1], packages[3], cust_ids[0], "Anniversary", "Anniversary Cocktails", "19:00", "22:00", 120, "completed", 100000, 60000, 5000, 0),
            (-15, halls[2], packages[0], cust_ids[2], "Engagement", "Engagement Ceremony", "17:00", "22:00", 300, "completed", 300000, 150000, 25000, 5000),
            (15, halls[0], packages[0], cust_ids[4], "Wedding", "Sangeet Night", "18:00", "23:00", 500, "confirmed", 500000, 250000, 45000, 15000),
        ]
        for offset, hall, pkg, cid, etype, ename, st, et, guests, status, hall_c, pkg_c, dec_c, extra in sample:
            event_date = (today + timedelta(days=offset)).isoformat()
            data = {"customer_id": cid, "hall_id": hall["id"], "event_type": etype,
                    "event_name": ename, "event_date": event_date, "start_time": st,
                    "end_time": et, "guest_count": guests, "package_id": pkg["id"],
                    "seating": "Round Tables", "special_requirements": "",
                    "hall_charges": hall_c, "package_charges": pkg_c, "food_charges": 0,
                    "decoration_charges": dec_c, "additional_charges": extra,
                    "discount": 0, "tax_percent": 18, "status": status, "notes": ""}
            totals = compute_totals(data)
            paid = totals["total_amount"] * (0.5 if status in ("confirmed", "hold") else (1.0 if status == "completed" else 0.3))
            paid = round(paid, 2)
            bid = new_id()
            bnum = f"BK-{today.year}-{1001 + await db.bookings.count_documents({})}"
            await db.bookings.insert_one({**data, **totals, "id": bid, "booking_number": bnum,
                                           "paid_amount": paid, "due_amount": totals["total_amount"] - paid,
                                           "created_by": "seed", "created_by_name": "System",
                                           "created_at": now_utc(), "updated_at": now_utc()})
            if paid > 0:
                await db.payments.insert_one({"id": new_id(),
                    "payment_number": f"PAY-{1001 + await db.payments.count_documents({})}",
                    "booking_id": bid, "amount": paid, "payment_date": event_date,
                    "method": "upi", "transaction_id": f"TXN{secrets.token_hex(4)}",
                    "notes": "Advance", "created_by": "seed", "created_at": now_utc()})

        exp_categories = [
            ("Catering", "Bulk grocery purchase", 45000, "Sharma Traders"),
            ("Decoration", "Floral arrangements", 22000, "Bloom Studio"),
            ("Staff", "Event staff wages Feb", 68000, "Payroll"),
            ("Electricity", "Utility bill", 18500, "MSEB"),
            ("Marketing", "Instagram ads", 12000, "Meta"),
            ("Maintenance", "AC servicing", 8500, "CoolAir Services"),
        ]
        for cat, desc, amt, vendor in exp_categories:
            await db.expenses.insert_one({"id": new_id(),
                "expense_number": f"EXP-{1001 + await db.expenses.count_documents({})}",
                "date": (today - timedelta(days=secrets.randbelow(20))).isoformat(),
                "category": cat, "description": desc, "amount": amt, "method": "bank",
                "vendor": vendor, "notes": "", "created_by": "seed",
                "created_by_name": "System", "created_at": now_utc()})

    # settings default
    if not await db.settings.find_one({"id": "main"}):
        await db.settings.insert_one({"id": "main", **SettingsIn().model_dump()})

@app.on_event("startup")
async def _startup():
    await seed()
    logger.info("BMS ready")

@app.on_event("shutdown")
async def _shutdown():
    client.close()
