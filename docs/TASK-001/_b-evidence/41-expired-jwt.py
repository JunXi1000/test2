#!/usr/bin/env python3
# 41-expired-jwt.py — SEC-05 过期 token(用容器内 JWT_SECRET 现造)
import sys, json, hmac, hashlib, base64, time, os, subprocess
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J, show
from datetime import datetime, timedelta

SECRET = os.environ.get("JWT_SECRET", "")
print("JWT_SECRET from env len=", len(SECRET))
if not SECRET:
    print("无 JWT_SECRET,跳过"); sys.exit(0)
KEY = base64.b64decode(SECRET)
print("decoded key len=", len(KEY))


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def make(exp_delta_min):
    now = int(time.time())
    cu = {"balance": 1000.00, "email": "user@test.com", "id": 1, "nickname": "user",
          "tel": "13800000001", "type": "USER", "username": "user1"}
    pl = {"currentUser": json.dumps(cu, ensure_ascii=False, separators=(",", ":")),
          "exp": now + exp_delta_min * 60, "iat": now - 3600,
          "jti": "00000000-0000-0000-0000-000000000000"}
    h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64u(json.dumps(pl, ensure_ascii=False, separators=(",", ":")).encode())
    sig = b64u(hmac.new(KEY, f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"


for label, delta in [("expired-1min", -1), ("expired-1day", -1440), ("valid+10min", +10),
                     ("expired+0min", 0)]:
    t = make(delta)
    st, bd, _ = req("GET", "/common/currentUser", token=t, cid=f"SEC-05-{label}")
    print(f"  [{label}] /common/currentUser -> HTTP {st} {bd.strip()[:120]}")
