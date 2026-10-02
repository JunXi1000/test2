#!/usr/bin/env python3
# 42-expired-jwt2.py — 修正密钥推导:jjwt generalKey 用 (JWT_SECRET 字符串的 base64 再 UTF-8 字节)
import sys, json, hmac, hashlib, base64, time, os
sys.path.insert(0, "/tmp")
from qa import B, L, tok, req

SECRET = os.environ["JWT_SECRET"]
KEY = base64.b64encode(SECRET.encode()).decode().encode()   # = SECRET.encode() 的 base64 = 原文
print("key bytes len =", len(KEY))


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def make(exp_delta_min, typ="USER"):
    now = int(time.time())
    cu = {"balance": 1000.00, "email": "user@test.com", "id": 1, "nickname": "user",
          "tel": "13800000001", "type": typ, "username": "user1"}
    pl = {"currentUser": json.dumps(cu, ensure_ascii=False, separators=(",", ":")),
          "exp": now + exp_delta_min * 60, "iat": now - 3600,
          "jti": "00000000-0000-0000-0000-000000000000"}
    h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64u(json.dumps(pl, ensure_ascii=False, separators=(",", ":")).encode())
    sig = b64u(hmac.new(KEY, f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"


# 自检:重签一个真实 token 的 payload 应得到相同签名
real = tok("user1")
rparts = real.split(".")
mine = make(10).split(".")
h = rparts[0]; p = rparts[1]
sig = b64u(hmac.new(KEY, f"{h}.{p}".encode(), hashlib.sha256).digest())
print("自检签名匹配:", sig == rparts[2])

for label, delta in [("valid+10min", 10), ("expired-1min", -1), ("expired-1day", -1440)]:
    t = make(delta)
    st, bd, _ = req("GET", "/common/currentUser", token=t, cid=f"SEC-05-{label}")
    print(f"  [{label}] /common/currentUser -> HTTP {st} {bd.strip()[:130]}")
# 无 type 的 token(签名有效但缺字段)
now = int(time.time())
cu2 = {"balance": 1000.00, "email": "user@test.com", "id": 1, "nickname": "user", "username": "user1"}
pl = {"currentUser": json.dumps(cu2, ensure_ascii=False, separators=(",", ":")), "exp": now + 600,
      "iat": now - 3600, "jti": "00000000-0000-0000-0000-000000000001"}
h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
p = b64u(json.dumps(pl, ensure_ascii=False, separators=(",", ":")).encode())
t = f"{h}.{p}." + b64u(hmac.new(KEY, f"{h}.{p}".encode(), hashlib.sha256).digest())
st, bd, _ = req("GET", "/common/currentUser", token=t, cid="SEC-06b")
print(f"  [no-type 有效签名] -> HTTP {st} {bd.strip()[:130]}")
st, bd, _ = req("GET", "/admin/dashboard/stats", token=t, cid="SEC-06c")
print(f"  [no-type 打 /admin] -> HTTP {st} {bd.strip()[:130]}")
# 提权:type=ADMIN 且签名有效
t = make(10, typ="ADMIN")
st, bd, _ = req("GET", "/admin/dashboard/stats", token=t, cid="SEC-04d")
print(f"  [伪造 ADMIN 签名有效] -> HTTP {st} {bd.strip()[:200]}")
