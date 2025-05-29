from fastapi import FastAPI, HTTPException, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from Crypto.Cipher import AES
import json, os, binascii
import datetime

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
templates = Jinja2Templates(directory="static/html")

CREATE_LOG = "create_log.json"
PURCHASE_LOG = "purchase_log.json"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.mount(
    "/.well-known",
    StaticFiles(directory=os.path.join(STATIC_DIR, ".well-known")),
    name="well_known"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

KEY = open("encryption_key.txt","rb").read()
DATA_FILE = "insides.json"

class CreateRequest(BaseModel):
    recipient: str
    price: int
    content: str

def load_db():
    if not os.path.exists(DATA_FILE) or os.path.getsize(DATA_FILE) == 0:
        return {}
    try:
        return json.load(open(DATA_FILE, "r"))
    except json.JSONDecodeError:
        return {}

def save_db(db):
    json.dump(db, open(DATA_FILE,"w"), indent=2)

def log_event(filename, event):
    if not os.path.exists(filename) or os.path.getsize(filename) == 0:
        data = []
    else:
        with open(filename, "r") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = []
    data.append(event)
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)

def aes_encrypt(key: bytes, plaintext: bytes):
    nonce = os.urandom(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ct, tag = cipher.encrypt_and_digest(plaintext)
    return nonce, ct, tag

def aes_decrypt(key: bytes, nonce: bytes, ct: bytes, tag: bytes):
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ct, tag)

@app.get("/")
def route_root():
    return FileResponse(os.path.join(STATIC_DIR, "html", "create.html"))

@app.get("/welcome")
def route_welcome():
    return FileResponse(os.path.join(STATIC_DIR, "html", "welcome.html"))

@app.get("/success")
def route_success():
    return FileResponse(os.path.join(STATIC_DIR, "html", "success.html"))

@app.get("/rules")
def route_rules():
    return FileResponse(os.path.join(STATIC_DIR, "html", "rules.html"))

@app.get("/manifest.json")
def serve_manifest():
    return FileResponse(os.path.join(STATIC_DIR, "manifest.json"))

@app.get("/{slug}")
def serve_inside(request: Request, slug: str):
    # 1) разбираем slug
    try:
        id, token = slug.split("-", 1)
    except ValueError:
        raise HTTPException(404, "Not found")

    # 2) загружаем запись
    db = load_db()
    rec = db.get(id)
    if not rec or rec["token"] != token:
        raise HTTPException(404, "Not found")

    # 3) special case price=0 → сразу флаг paid
    if rec["price"] == 0 and not rec["paid"]:
        rec["paid"] = True
        save_db(db)

    # 4) отдаём шаблон
    return templates.TemplateResponse("inside.html", {
        "request":   request,
        "embed_url": request.url._url,
        "price":     rec["price"],
    })

@app.post("/api/create")
def create_inside(req: CreateRequest):
    db = load_db()
    id    = binascii.b2a_hex(os.urandom(8)).decode()
    token = binascii.b2a_hex(os.urandom(16)).decode()
    slug = f"{id}-{token}"
    nonce, ct, tag = aes_encrypt(KEY, req.content.encode())
    db[id] = {
        "recipient": req.recipient,
        "price": req.price,
        "nonce": binascii.b2a_hex(nonce).decode(),
        "ct": binascii.b2a_hex(ct).decode(),
        "tag": binascii.b2a_hex(tag).decode(),
        "paid": False,
        "token": token,
        "slug": slug,
        "allowed_user": None
    }
    save_db(db)
    log_event(CREATE_LOG, {
        "datetime": datetime.datetime.utcnow().isoformat(),
        "price": req.price
    })
    return {"slug": slug}

@app.get("/api/meta/{id}")
def meta(id: str):
    db = load_db()
    rec = db.get(id)
    if not rec:
        raise HTTPException(404, "No such inside")
    return {"recipient": rec["recipient"], "price": rec["price"]}

@app.post("/api/markpaid/{id}")
def mark_paid(
    id: str,
    token: str = Query(...),
    warpcast_id: str = Header(..., alias="Farcaster-User"),
):
    db = load_db()
    rec = db.get(id)
    if not rec or rec["token"] != token:
        raise HTTPException(404, "Invalid link")

    # отмечаем оплату
    rec["paid"] = True
    # привязываем пользователя, чтобы потом проверять
    rec["allowed_user"] = warpcast_id
    save_db(db)

    log_event(PURCHASE_LOG, {
        "datetime": datetime.datetime.utcnow().isoformat(),
        "price":    rec["price"]
    })
    return {"ok": True}

@app.get("/api/inside/{id}")
def get_inside(
    id: str,
    token: str = Query(...),
    warpcast_id: str = Header(..., alias="Farcaster-User"),
):
    db = load_db()
    rec = db.get(id)
    # проверяем token и что уже было помечено paid
    if not rec or rec["token"] != token or not rec["paid"]:
        raise HTTPException(403, "Not paid or invalid token")

    # привязка — первый покупатель становится владельцем,
    # все остальные получат 403
    if rec["allowed_user"] is None:
        rec["allowed_user"] = warpcast_id
        save_db(db)
    elif rec["allowed_user"] != warpcast_id:
        raise HTTPException(403, "Access denied for this user")

    # расшифровываем контент
    nonce = binascii.unhexlify(rec["nonce"])
    ct    = binascii.unhexlify(rec["ct"])
    tag   = binascii.unhexlify(rec["tag"])
    try:
        pt = aes_decrypt(KEY, nonce, ct, tag).decode()
    except ValueError:
        raise HTTPException(500, "Decryption failed")

    return {"content": pt}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
