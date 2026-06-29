#!/usr/bin/env python3
"""get-secret — capture a secret in the browser, store it by reference.

Boots a localhost-only HTTP server, opens a one-field form in the browser,
blocks until the user submits, writes the secret straight to a destination
(macOS Keychain, a 0600 file, or an env file), and prints ONLY a reference
to stdout. The secret value never touches stdout and is never read back by
the caller — that is the whole point: the value reaches the destination
without passing through the agent's context.

Usage:
    get-secret <name> [--dest DEST] [--context TEXT] [--port N] [--timeout S]

DEST (default: keychain):
    keychain[:service]   macOS Keychain generic password (account = $USER)
    file:/path           write the raw secret to /path with 0600 perms
    env:/path            append/replace `NAME=value` line in an env file (0600)

stdout (exactly one JSON line on success):
    {"name","dest","stored":true,"retrieve":"<command or path>"}

The logic is split into testable seams: the `store_*` functions are pure I/O,
`make_handler` builds the request handler against a `CaptureSession`, and
`main` only wires argv → session → browser → exit code. Tests drive the
session in-process; see tests/.
"""
from __future__ import annotations

import argparse
import getpass
import html
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

ENV_NAME_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---- destinations -----------------------------------------------------------

def store_keychain(name: str, service: str, value: str) -> str:
    account = getpass.getuser()
    # -U updates if it already exists. NOTE: the value is passed on argv, so it
    # is briefly visible to `ps` on a multi-user machine. Acceptable on a
    # personal laptop; use file:/env: dests if that is a concern.
    subprocess.run(
        ["security", "add-generic-password", "-U", "-a", account, "-s", service, "-w", value],
        check=True,
        capture_output=True,
    )
    return f"security find-generic-password -s {service} -a {account} -w"


def _open_0600(path: str) -> int:
    """Open for writing without following symlinks, forcing 0600 even if the
    file already existed (O_CREAT's mode does not apply to existing files)."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    os.fchmod(fd, 0o600)
    return fd


def store_file(path: str, value: str) -> str:
    path = os.path.expanduser(path)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with os.fdopen(_open_0600(path), "w") as f:
        f.write(value)
    return path


def store_env(name: str, path: str, value: str) -> str:
    if not ENV_NAME_RE.fullmatch(name):
        raise ValueError(f"env: invalid variable name {name!r}")
    if "\n" in value or "\r" in value:
        raise ValueError("env: cannot store a value containing newlines")
    path = os.path.expanduser(path)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    existing = []
    if os.path.exists(path):
        with open(path) as f:  # exact-key dedup, not prefix match
            existing = [ln for ln in f.readlines() if ln.split("=", 1)[0] != name]
    with os.fdopen(_open_0600(path), "w") as f:
        f.writelines(existing)
        f.write(f"{name}={value}\n")
    return f"set -a; source {path}; set +a   # then ${{{name}}}"


def dispatch_store(name: str, dest: str, value: str) -> tuple[str, str]:
    """Route to a destination. Returns (normalized_dest_label, retrieve_hint)."""
    if dest == "keychain" or dest.startswith("keychain:"):
        service = dest.split(":", 1)[1] if ":" in dest else name
        return f"keychain:{service}", store_keychain(name, service, value)
    if dest.startswith("file:"):
        return dest, store_file(dest[len("file:"):], value)
    if dest.startswith("env:"):
        return dest, store_env(name, dest[len("env:"):], value)
    raise ValueError(f"unknown --dest: {dest!r}")


# ---- form -------------------------------------------------------------------

PAGE = """<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>get-secret · {name}</title>
<style>
 :root{{--bg:#0b0d12;--card:#151a23;--line:#262d3a;--ink:#e8eaee;--mut:#8b93a3;
   --accent:#5b8cff;--ok:#4ade80;--err:#f87171}}
 *{{box-sizing:border-box}}
 body{{background:radial-gradient(120% 120% at 50% 0%,#11151d 0%,var(--bg) 60%);
   color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
   display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;padding:24px}}
 .card{{background:var(--card);border:1px solid var(--line);padding:26px 28px 22px;
   border-radius:16px;width:440px;box-shadow:0 12px 50px rgba(0,0,0,.55)}}
 .head{{display:flex;align-items:center;gap:11px;margin-bottom:6px}}
 .key{{width:34px;height:34px;flex:none;border-radius:9px;display:grid;place-items:center;
   background:linear-gradient(160deg,#2a3550,#1b2233);border:1px solid var(--line);font-size:17px}}
 h1{{font-size:15px;font-weight:600;margin:0;letter-spacing:.2px}}
 .pill{{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent);
   background:rgba(91,140,255,.1);border:1px solid rgba(91,140,255,.25);
   padding:1px 7px;border-radius:6px;display:inline-block;margin-top:2px}}
 .ctx{{color:var(--mut);font-size:13px;margin:14px 0 16px}}
 label{{display:block;font-size:12px;color:var(--mut);margin:0 0 7px}}
 .field{{position:relative}}
 input{{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--ink);
   padding:12px 44px 12px 13px;border-radius:10px;font:14px ui-monospace,Menlo,monospace;outline:none}}
 input:focus{{border-color:var(--accent);box-shadow:0 0 0 3px rgba(91,140,255,.18)}}
 .eye{{position:absolute;right:6px;top:6px;bottom:6px;width:34px;border:0;background:transparent;
   color:var(--mut);cursor:pointer;font-size:15px;border-radius:7px}}
 .eye:hover{{color:var(--ink);background:rgba(255,255,255,.05)}}
 button.go{{margin-top:14px;width:100%;background:var(--accent);border:0;color:#fff;
   padding:12px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;transition:.15s}}
 button.go:hover{{filter:brightness(1.08)}} button.go:disabled{{opacity:.55;cursor:default}}
 .foot{{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;
   font-size:12px;color:var(--mut)}}
 .lock{{display:inline-flex;align-items:center;gap:5px;flex:none;white-space:nowrap}}
 .dest{{min-width:0;overflow:hidden}}
 .dest code{{font:11px ui-monospace,Menlo,monospace;color:var(--mut);display:block;
   white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
 .msg{{font-size:13px;min-height:18px;margin-top:12px}}
 .msg.ok{{color:var(--ok)}} .msg.err{{color:var(--err)}}
 .done .form{{display:none}} .done .check{{display:flex}}
 .check{{display:none;flex-direction:column;align-items:center;gap:10px;padding:14px 0 6px}}
 .check .ring{{width:46px;height:46px;border-radius:50%;background:rgba(74,222,128,.12);
   border:1px solid rgba(74,222,128,.4);display:grid;place-items:center;color:var(--ok);font-size:22px}}
</style></head><body>
<div class=card id=card>
 <div class=head>
  <div class=key>🔑</div>
  <div><h1>Provide a secret</h1><span class=pill>{name}</span></div>
 </div>
 <div class=form id=form>
  <p class=ctx>{context}</p>
  <label for=s>Secret value</label>
  <div class=field>
   <input id=s type=password autofocus autocomplete=off autocapitalize=off
     autocorrect=off spellcheck=false placeholder="paste or type…">
   <button class=eye id=t type=button title="show / hide" aria-label="toggle visibility">👁</button>
  </div>
  <button class=go id=go>Store secret</button>
  <div class=msg id=m></div>
  <div class=foot>
   <span class=lock>🔒 stays on this machine</span>
   <span class=dest><code title="{dest}">{dest}</code></span>
  </div>
 </div>
 <div class=check>
  <div class=ring>✓</div>
  <div>Stored. You can close this tab.</div>
 </div>
</div>
<script>
 const s=document.getElementById('s'),t=document.getElementById('t'),
       go=document.getElementById('go'),m=document.getElementById('m'),
       card=document.getElementById('card');
 t.onclick=()=>{{const p=s.type==='password';s.type=p?'text':'password';
   t.textContent=p?'🙈':'👁';s.focus();}};
 async function send(){{
   if(!s.value){{m.className='msg err';m.textContent='Enter a value first.';s.focus();return;}}
   go.disabled=true;m.className='msg';m.textContent='Storing…';
   try{{
     const r=await fetch('{token}/submit',{{method:'POST',
       headers:{{'content-type':'application/x-www-form-urlencoded'}},
       body:'secret='+encodeURIComponent(s.value)}});
     if(r.ok){{s.value='';card.classList.add('done');}}
     else{{m.className='msg err';m.textContent='Store failed: '+await r.text();go.disabled=false;}}
   }}catch(e){{m.className='msg err';m.textContent='Error: '+e;go.disabled=false;}}
 }}
 go.onclick=send;
 s.addEventListener('keydown',e=>{{if(e.key==='Enter'){{e.preventDefault();send();}}}});
</script></body></html>"""


def build_page(name: str, context: str, dest: str, token: str) -> str:
    return PAGE.format(
        name=html.escape(name),
        context=html.escape(context or "Paste or type the secret, then Store."),
        dest=html.escape(dest),
        token=token,
    )


# ---- server -----------------------------------------------------------------

class CaptureSession:
    """One localhost capture: owns the token, the HTTP server, and the result.

    Bind happens in __init__ (raises OSError on a busy port). Call
    `serve_background()` to start serving, `wait(timeout)` to block until a
    store happens or the timeout elapses, then read `.result`.
    """

    def __init__(self, name: str, dest: str, context: str = "", port: int = 0):
        self.name = name
        self.dest = dest
        self.token = "/" + secrets.token_urlsafe(16)
        self.page = build_page(name, context, dest, self.token)
        self.result: dict = {}
        self.done = threading.Event()
        self.lock = threading.Lock()
        self._server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(self))

    @property
    def port(self) -> int:
        return self._server.server_address[1]

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}{self.token}"

    def serve_background(self) -> None:
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    def wait(self, timeout: float) -> dict:
        self.done.wait(timeout=timeout)
        self._server.shutdown()
        return self.result

    def close(self) -> None:
        self._server.shutdown()


def make_handler(session: "CaptureSession"):
    """Build a BaseHTTPRequestHandler bound to one CaptureSession."""

    def loopback(scheme: str = "") -> tuple:
        prefix = f"{scheme}127.0.0.1:{session.port}", f"{scheme}localhost:{session.port}"
        return prefix

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):  # never log requests (bodies carry secrets)
            pass

        def _reply(self, code: int, body: bytes = b"") -> None:
            self.send_response(code)
            self.end_headers()
            if body:
                self.wfile.write(body)

        def do_GET(self):
            if self.path != session.token:  # exact match, not a prefix
                return self._reply(404)
            body = session.page.encode()
            self.send_response(200)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path != session.token + "/submit":
                return self._reply(404)
            # Host must be loopback on our port: makes the Origin check
            # meaningful and defeats DNS-rebinding (an attacker domain pointed
            # at 127.0.0.1 won't match these literal hosts).
            if self.headers.get("Host", "") not in loopback():
                return self._reply(403)
            origin = self.headers.get("Origin")
            if origin and origin not in loopback("http://"):
                return self._reply(403)
            cl = self.headers.get("content-length")
            if cl is None:
                return self._reply(411, b"length required")
            raw = self.rfile.read(int(cl)).decode("utf-8", "replace")
            value = parse_qs(raw).get("secret", [""])[0]
            if not value:
                return self._reply(400, b"empty value")
            with session.lock:
                if session.done.is_set():  # single-use: a store already happened
                    return self._reply(409, b"already stored")
                try:
                    label, retrieve = dispatch_store(session.name, session.dest, value)
                    session.result.update(name=session.name, dest=label,
                                           stored=True, retrieve=retrieve)
                    self._reply(200, b"ok")
                    session.done.set()
                except ValueError as e:  # our validation — message is value-free
                    self._reply(400, str(e).encode())  # let the user fix and retry
                except Exception as e:  # noqa: BLE001 — genuine failure: fail fast
                    session.result["error"] = str(e)  # stderr only, never reflected
                    self._reply(500, b"store error")
                    session.done.set()

    return Handler


# ---- cli --------------------------------------------------------------------

def parse_args(argv=None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(prog="get-secret")
    ap.add_argument("name", help="logical name / keychain service for the secret")
    ap.add_argument("--dest", default="keychain",
                    help="keychain[:service] | file:/path | env:/path (default: keychain)")
    ap.add_argument("--context", default="", help="hint shown in the browser form")
    ap.add_argument("--port", type=int, default=0, help="0 = random free port")
    ap.add_argument("--timeout", type=int, default=300, help="seconds to wait (default 300)")
    return ap.parse_args(argv)


def exit_code(result: dict) -> int:
    """0 = stored, 3 = store failure, 2 = timed out (nothing stored)."""
    if result.get("stored"):
        return 0
    if result.get("error"):
        return 3
    return 2


def main(argv=None) -> int:
    args = parse_args(argv)
    try:
        session = CaptureSession(args.name, args.dest, args.context, args.port)
    except OSError as e:
        log(f"get-secret: cannot bind 127.0.0.1:{args.port or '<random>'}: {e}")
        return 3
    session.serve_background()

    log(f"get-secret: open {session.url}")
    log(f"  name={args.name}  dest={args.dest}  (waiting up to {args.timeout}s)")
    try:
        webbrowser.open(session.url)
    except Exception:  # noqa: BLE001
        pass

    result = session.wait(args.timeout)
    code = exit_code(result)
    if code == 0:
        print(json.dumps(result))  # only the reference — never the value
    elif code == 3:
        log(f"get-secret: store failed: {result.get('error')}")
    else:
        log("get-secret: timed out, nothing stored")
    return code


if __name__ == "__main__":
    sys.exit(main())
