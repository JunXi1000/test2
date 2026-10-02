#!/usr/bin/env python3
import subprocess, json, re
B="http://localhost:1000"
p=subprocess.run(["curl","-sS","-i","-X","POST",B+"/common/login",
                  "-H","Content-Type: application/json",
                  "--data-binary",'{"username":"user1","password":"123456","type":"USER"}'],
                 capture_output=True,text=True)
print("rc=",p.returncode)
print("stderr=",repr(p.stderr[:300]))
print("stdout repr head=",repr(p.stdout[:200]))
print("stdout repr tail=",repr(p.stdout[-200:]))
parts=p.stdout.split("\r\n\r\n",1)
print("parts=",len(parts))
print("headers=",repr(parts[0][:120]))
if len(parts)>1:
    print("body=",repr(parts[1][:200]))
    try:
        d=json.loads(parts[1]); print("parsed code=",d.get("code"),"toklen=",len(d.get("data") or ""))
    except Exception as e:
        print("parse fail:",e)
print("---- 用文件方式 ----")
open("/tmp/r.json","w").write('{"username":"user1","password":"123456","type":"USER"}')
p2=subprocess.run(["curl","-sS","-i","-X","POST",B+"/common/login",
                   "-H","Content-Type: application/json","--data-binary","@/tmp/r.json"],
                  capture_output=True,text=True)
pp=p2.stdout.split("\r\n\r\n",1)
print("file-mode parts=",len(pp),"bodylen=",len(pp[1]) if len(pp)>1 else 0)
if len(pp)>1:
    d=json.loads(pp[1]); print("file-mode code=",d.get("code"),"toklen=",len(d.get("data") or ""))
