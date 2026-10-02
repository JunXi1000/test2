#!/usr/bin/env python3
# qa.py — QA-B 共享工具:HTTP + DB + 证据落盘
import json, re, subprocess, os

B = "http://localhost:1000"
L = "/tmp/qa-b"
os.makedirs(f"{L}/resp", exist_ok=True)
os.makedirs(f"{L}/sql", exist_ok=True)
os.makedirs(f"{L}/out", exist_ok=True)


def sql(q):
    p = subprocess.run(["mysql", "-uroot", "-p123456", "template_v3", "-N", "-B"],
                       input=q, capture_output=True, text=True)
    return p.stdout.strip()


def tok(name):
    return open(f"{L}/tokens/{name}.txt").read().strip()


def req(method, path, token=None, body=None, cid=None, extra=None):
    """返回 (status, body_str, headers_str);落原始证据到 $L/resp/<cid>.http|.req"""
    cmd = ["curl", "-sS", "-i", "-X", method, B + path, "-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if extra:
        cmd += extra.split()
    f = None
    if body is not None:
        # 并发安全:每个请求独立临时文件名(此前共用 _body.tmp 造成并发测试偶发 400)
        import tempfile
        fd, f = tempfile.mkstemp(prefix="qabody_", dir=f"{L}/resp", suffix=".json")
        with os.fdopen(fd, "w") as fh:
            fh.write(body)
        cmd += ["--data-binary", f"@{f}"]
    p = subprocess.run(cmd, capture_output=True, text=True)
    raw = p.stdout.replace("\r\n", "\n")
    m = re.match(r"HTTP/\d\.\d (\d+)", raw)
    status = int(m.group(1)) if m else -1
    head, _, bod = raw.partition("\n\n")
    if cid:
        open(f"{L}/resp/{cid}.http", "w").write(raw)
        open(f"{L}/resp/{cid}.req", "w").write(
            f"{method} {path}\nAuthorization: {'Bearer <token>' if token else '(none)'}\n"
            f"Content-Type: application/json\n\n{body if body is not None else '(no body)'}\n")
    return status, bod, head


def J(bod):
    try:
        return json.loads(bod)
    except Exception:
        return None


def show(cid, status, bod, note="", req_body=None, limit=700):
    d = J(bod)
    print(f"  [{cid}] HTTP {status} | {note}")
    if req_body is not None:
        print(f"        REQ: {req_body[:300]}")
    print(f"        BODY: {json.dumps(d, ensure_ascii=False)[:limit] if d is not None else repr(bod[:300])}")
    return d
