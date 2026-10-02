#!/usr/bin/env python3
# 40-authz.py — 授权矩阵 + token 安全 + 注入/畸形输入
import sys, json, hmac, hashlib, base64, time, subprocess
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J, show

AD, SH, U1, U2, NU = tok("admin"), tok("shop1"), tok("user1"), tok("user2"), tok("newuser")
TOKENS = {"anon": None, "USER": U1, "SHOP": SH, "ADMIN": AD}

print("=" * 78)
print("授权矩阵 (期望来自 AuthzRules + SpringMvcConfig 白名单)")
print("=" * 78)
CASES = [
    ("POST", "/common/login", (200, 200, 200, 200), "白名单"),
    ("GET", "/products", (200, 200, 200, 200), "白名单"),
    ("POST", "/search", (200, 200, 200, 200), "白名单"),
    ("GET", "/merchants/1/profile", (200, 200, 200, 200), "白名单"),
    ("GET", "/common/currentUser", (401, 200, 200, 200), "AuthzRules ALL"),
    ("POST", "/common/resetPassword", (401, 403, 403, 200), "AuthzRules ADMIN"),
    ("POST", "/payments/create", (401, 200, 403, 403), "AuthzRules USER"),
    ("GET", "/orders", (401, 200, 403, 403), "AuthzRules USER"),
    ("GET", "/shoppingCart/page?pageNum=1&pageSize=10", (401, 200, 403, 403), "AuthzRules USER"),
    ("GET", "/shoppingCart/list", (401, 403, 403, 403), "刻意未登记"),
    ("GET", "/shoppingCart/selectById/1", (401, 403, 403, 403), "刻意未登记"),
    ("GET", "/merchant/dashboard/stats", (401, 403, 200, 403), "AuthzRules SHOP"),
    ("GET", "/admin/dashboard/stats", (401, 403, 403, 200), "AuthzRules ADMIN"),
    ("GET", "/chat/conversations", (401, 200, 200, 403), "AuthzRules USER/SHOP"),
    ("GET", "/notifications", (401, 200, 200, 200), "ALL_ROLES"),
    ("GET", "/file/x.jpg", (200, 200, 200, 200), "图片 GET 放行"),
    ("GET", "/file/x.pdf", (401, 200, 200, 200), "非图片需登录"),
    ("GET", "/product/list", (401, 403, 403, 403), "已删前缀默认拒绝"),
    ("GET", "/admin-accounts/list", (401, 403, 403, 403), "默认拒绝(不误命中 /admin)"),
    ("GET", "/productOrderEvaluate/list", (401, 403, 403, 403), "默认拒绝(不误命中 /productOrder)"),
    ("GET", "/nosuchpath-xyz", (401, 403, 403, 403), "未知路径不暴露存在性"),
]
rowf = []
for m, p, exp, src in CASES:
    got = []
    for who in ("anon", "USER", "SHOP", "ADMIN"):
        st, bd, _ = req(m, p, token=TOKENS[who], cid=f"AUTHZ-{m}-{p.replace('/','_')[:40]}-{who}")
        got.append(st)
    ok = "PASS" if tuple(got) == exp else "DIFF"
    print(f"  {ok:4} {m:5} {p:52} exp={exp} got={tuple(got)}  [{src}]")
    rowf.append((m, p, exp, tuple(got), ok, src))

print("\n不合预期项:")
for m, p, exp, got, ok, src in rowf:
    if ok == "DIFF":
        print(f"  !! {m} {p}: exp={exp} got={got} ({src})")

print("\n" + "=" * 78)
print("token 安全")
print("=" * 78)
# SEC-02 格式错误
st, bd, _ = req("GET", "/common/currentUser", token="abc", cid="SEC-02")
show("SEC-02", st, bd, "Bearer abc")
# SEC-03 篡改签名
parts = U1.split(".")
tampered = parts[0] + "." + parts[1] + "." + ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
st, bd, _ = req("GET", "/common/currentUser", token=tampered, cid="SEC-03")
show("SEC-03", st, bd, "签名被篡改")
# SEC-04 篡改 payload 提权
def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
pl = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
print("  payload 原:", json.dumps(pl, ensure_ascii=False)[:200])
pl2 = dict(pl)
if "currentUser" in pl2 and isinstance(pl2["currentUser"], str):
    cu = json.loads(pl2["currentUser"]); cu["type"] = "ADMIN"; pl2["currentUser"] = json.dumps(cu)
priv = parts[0] + "." + b64u(json.dumps(pl2, ensure_ascii=False).encode()) + "." + parts[2]
st, bd, _ = req("GET", "/admin/users", token=priv, cid="SEC-04")
show("SEC-04", st, bd, "提权 payload + 原签名")
st, bd, _ = req("GET", "/official/none", token=priv, cid="SEC-04b")
# 用提权 token 打 admin 端点
st, bd, _ = req("GET", "/admin/dashboard/stats", token=priv, cid="SEC-04c")
show("SEC-04c", st, bd, "提权 token 打 /admin/dashboard/stats")
# 无 type 的 token
pl3 = dict(pl); pl3.pop("type", None)
notype = parts[0] + "." + b64u(json.dumps(pl3, ensure_ascii=False).encode()) + "." + parts[2]
st, bd, _ = req("GET", "/common/currentUser", token=notype, cid="SEC-06")
show("SEC-06", st, bd, "payload 去掉 type(签名失效)")
# SEC-07 query token
p = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
                    f"{B}/common/currentUser?token={U1}"], capture_output=True, text=True)
print(f"  SEC-07 query 传 token -> {p.stdout} (期望 401,后端只读 header)")

# SEC-05 过期 token — 需要 JWT_SECRET
print("\n  SEC-05 过期 token:")
sec = subprocess.run(["bash", "-c", "env | grep -i -E 'jwt|secret' || echo NO_ENV"], capture_output=True, text=True).stdout.strip()
print("   容器 env:", sec if sec else "(空)")
sec2 = subprocess.run(["bash", "-c", "ps aux | grep -i '[P]rojectManagement' | head -c 400"], capture_output=True, text=True).stdout
print("   进程:", sec2.strip()[:300])
print("   写一个过期 JWT(用 yml 默认密钥尝试):")
