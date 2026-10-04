#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run.py - the local server for Pruta.

Why it exists: when index.html is opened by double-click, the browser cannot write
files into the folder. This server lets the app keep its data as an ordinary file
inside data/, next to the code.

What it does not do: it listens on 127.0.0.1 only (this computer), never contacts
the internet and never sends anything anywhere. It has no dependencies - only the
Python 3 standard library.

The layers of protection (the data is a bank statement, so nothing here is "roughly"):
  1. Listens on 127.0.0.1 only - another computer on the network cannot connect.
  2. Checks the Host header - a malicious site that points a domain name at
     127.0.0.1 (DNS rebinding) is refused.
  3. Checks Origin / Sec-Fetch-Site - another site open in the browser cannot read
     or overwrite the data.
  4. The data/ folder is not served as files; the only way to it is /api/state.
  5. Atomic writes and rotating backups, always including a backup before a save
     that removes transactions.
  6. A revision number (rev) on every save: an old tab that was left open cannot
     overwrite newer data.
  7. A data file that cannot be read is never overwritten: damaged - it is moved
     aside; locked - saving stops.

Run it:  python3 run.py     (or start-windows.bat / start-linux.sh / start-mac.command)

Everything in this file - comments and console messages - is plain English on
purpose: not every console or editor can show other scripts.
"""

import sys

if sys.version_info < (3, 7):
    sys.stderr.write("Pruta needs Python 3.7 or newer (this is Python %s).\n" % sys.version.split()[0])
    sys.exit(1)

import hashlib
import http.client
import http.server
import json
import os
import posixpath
import shutil
import socket
import socketserver
import threading
import time
import urllib.parse
import webbrowser
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
STATE_FILE = os.path.join(DATA_DIR, "pruta-data.json")
LEGACY_STATE_FILE = os.path.join(DATA_DIR, "pepper-data.json")   # the file name used by earlier versions
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
MAX_BACKUPS = 20
BACKUP_EVERY = 10 * 60               # seconds between one routine backup and the next
MAX_BODY = 64 * 1024 * 1024          # 64MB - far more than years of transactions need
DEFAULT_PORT = 8777
PORT_TRIES = 40
# Identifies this folder: a second launch can tell that Pruta is already running from here, and just opens it
FOLDER_ID = hashlib.sha256(os.path.realpath(ROOT).encode("utf-8", "surrogatepass")).hexdigest()[:16]

# The same policy as the meta tag in index.html, plus what can only be set in a header
CSP = ("default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
       "base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'")

# Content types are fixed here, not taken from the machine. On Windows, Python reads them from
# the registry, where .js is often registered as text/plain - and then the browser (rightly,
# because of nosniff) refuses to run the scripts.
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".csv": "text/csv; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

_write_lock = threading.Lock()
_notice = None                       # a one-time message for the page (e.g. the data file was damaged and moved aside)


class Unreadable(Exception):
    """The data file exists but cannot be read right now (locked, no permission). It is not written over."""


class Stale(Exception):
    """The page sending this save has not seen the latest version of the data."""


def say(text=""):
    try:
        print(text, flush=True)
    except Exception:                 # noqa: BLE001 - no console window, or an encoding that lacks a character
        pass


def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)


def tx_count(state):
    tx = state.get("tx") if isinstance(state, dict) else None
    return len(tx) if isinstance(tx, list) else 0


def rev_of(state):
    rev = state.get("rev") if isinstance(state, dict) else None
    return rev if isinstance(rev, int) and not isinstance(rev, bool) and rev >= 0 else 0


def quarantine(path):
    """A data file that cannot be parsed is neither deleted nor overwritten: it is moved aside, and we start from an empty file."""
    global _notice
    name = "damaged-%s.json.bak" % datetime.now().strftime("%Y%m%d-%H%M%S")
    try:
        ensure_dirs()
        os.replace(path, os.path.join(BACKUP_DIR, name))
    except OSError as exc:
        raise Unreadable(str(exc))    # it cannot be moved - so it will not be written over either
    _notice = {"kind": "damaged", "file": "data/backups/" + name}
    say("  ! The data file could not be read. It was kept aside as data/backups/%s" % name)


def read_state():
    path = STATE_FILE
    if not os.path.exists(path):
        if not os.path.exists(LEGACY_STATE_FILE):
            return {}
        path = LEGACY_STATE_FILE          # data from an earlier version: read as it is, saved under the new name from now on
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError as exc:
        raise Unreadable(str(exc))
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw.decode("utf-8-sig"))      # utf-8-sig: also when Notepad saved it with a BOM
    except ValueError:
        data = None
    if not isinstance(data, dict):
        quarantine(path)
        return {}
    return data


def take_notice():
    global _notice
    notice, _notice = _notice, None
    return notice


def backup_files():
    try:
        return sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith("pruta-data-") and f.endswith(".json"))
    except OSError:
        return []


def rotate_backup(old_count, new_count):
    """
    A copy of the previous state before writing - but not on every write: otherwise twenty
    quick edits in a row would push out every backup within a minute. A backup is kept when:
      * at least BACKUP_EVERY seconds have passed since the last one, or
      * the new save holds fewer transactions than the current file (a wipe, a restore
        from an old backup).
    """
    if not os.path.exists(STATE_FILE):
        return
    files = backup_files()
    if files and new_count >= old_count:
        try:
            if time.time() - os.path.getmtime(os.path.join(BACKUP_DIR, files[-1])) < BACKUP_EVERY:
                return
        except OSError:
            pass
    name = "pruta-data-%s.json" % datetime.now().strftime("%Y%m%d-%H%M%S")
    if name in files:                                    # two backups in the same second: the first is not overwritten
        name = "pruta-data-%s-%d.json" % (name[11:-5], len(files))
    try:
        shutil.copy2(STATE_FILE, os.path.join(BACKUP_DIR, name))
        os.utime(os.path.join(BACKUP_DIR, name), None)   # the time of the backup, not of the original file
    except OSError:
        return
    for old in backup_files()[:-MAX_BACKUPS]:
        try:
            os.remove(os.path.join(BACKUP_DIR, old))
        except OSError:
            pass


def save_state(payload):
    """
    Save. Checks that the page has seen the latest version, backs up when needed, and writes
    atomically: first to a temporary file, then a replace - so the file is never left half
    written. Returns the new revision number.
    """
    with _write_lock:
        ensure_dirs()
        current = read_state()                           # Unreadable: never write over a file we could not read
        if rev_of(payload) != rev_of(current):
            raise Stale(rev_of(current))
        payload["rev"] = rev_of(current) + 1
        rotate_backup(tx_count(current), tx_count(payload))
        tmp = "%s.%d.tmp" % (STATE_FILE, os.getpid())
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=1)
            fh.flush()
            os.fsync(fh.fileno())
        for attempt in range(6):                         # on Windows an antivirus or a cloud-sync tool may lock the file for a moment
            try:
                os.replace(tmp, STATE_FILE)
                break
            except PermissionError:
                if attempt == 5:
                    raise
                time.sleep(0.05 * (attempt + 1))
        return payload["rev"]


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "Pruta/1.0"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # --- helpers ---
    def guess_type(self, path):
        return TYPES.get(posixpath.splitext(path)[1].lower(), "application/octet-stream")

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._no_store = True
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            raise ValueError("Content-Type must be application/json")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            raise ValueError("bad body size")
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("the body must be a JSON object")
        return payload

    def _api(self):
        path = self.path.split("?")[0].split("#")[0].rstrip("/")
        return path[5:] if path in ("/api/state", "/api/ping") else None

    def _local_host(self):
        """The request came from this computer, and to our own local address (not to some other domain name that points at 127.0.0.1)."""
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            return False
        host = (self.headers.get("Host") or "").strip().lower()
        return host in self.server.allowed_hosts

    def _trusted(self, writing=False):
        """Whether a request for the data came from Pruta's own page, on this computer."""
        if not self._local_host():
            return False
        # A browser attaches Origin to every request that changes data, and to every cross-site request.
        origin = self.headers.get("Origin")
        if origin is not None and origin.strip().lower() not in self.server.allowed_origins:
            return False
        site = (self.headers.get("Sec-Fetch-Site") or "").strip().lower()
        if site and site not in ("same-origin", "none"):
            return False
        if writing and site == "none":      # a write only ever comes from the page itself, not from a typed address
            return False
        return True

    def _blocked_path(self):
        """The data folder and hidden files are not served as ordinary files."""
        path = urllib.parse.unquote(self.path.split("?")[0].split("#")[0])
        parts = [p for p in posixpath.normpath(path.replace("\\", "/")).split("/") if p]
        if not parts:
            return False
        # On Windows "data." and "data::$DATA" lead to the same folder, so the name is compared after cleaning
        first = parts[0].split(":")[0].rstrip(". ").lower()
        return first == "data" or any(p.startswith(".") for p in parts)

    # --- routes ---
    def do_GET(self):
        api = self._api()
        if api:
            if not self._trusted():
                return self._json({"error": "local only"}, 403)
            if api == "ping":
                return self._json({"app": "pruta", "folder": FOLDER_ID})
            try:
                state = read_state()
            except Unreadable as exc:
                return self._json({"error": "unreadable", "detail": str(exc)}, 503)
            notice = take_notice()
            if notice:
                state = dict(state, notice=notice)
            return self._json(state)
        if not self._local_host() or self._blocked_path():
            return self.send_error(404)
        return super().do_GET()

    def do_HEAD(self):
        if self._api() or not self._local_host() or self._blocked_path():
            return self.send_error(404)
        return super().do_HEAD()

    def do_PUT(self):
        return self._save()

    def do_POST(self):
        return self._save()

    def _save(self):
        if self._api() != "state":
            return self._json({"error": "not found"}, 404)
        if not self._trusted(writing=True):
            return self._json({"error": "local only"}, 403)
        try:
            payload = self._read_body()
        except Exception as exc:                      # noqa: BLE001
            return self._json({"error": str(exc)}, 400)
        try:
            rev = save_state(payload)
        except Stale as exc:
            return self._json({"error": "stale", "rev": exc.args[0]}, 409)
        except Unreadable as exc:
            return self._json({"error": "unreadable", "detail": str(exc)}, 503)
        except OSError as exc:
            return self._json({"error": "write failed", "detail": str(exc)}, 500)
        return self._json({"ok": True, "rev": rev, "savedAt": datetime.now().isoformat(timespec="seconds")})

    def list_directory(self, path):
        self.send_error(404)             # no directory listings
        return None

    def end_headers(self):
        if not getattr(self, "_no_store", False):
            self.send_header("Cache-Control", "no-cache")        # everything is local; no stubborn cache
        self._no_store = False
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    def log_message(self, fmt, *args):
        return  # keep the console quiet


class Server(socketserver.ThreadingTCPServer):
    # On Windows this option would let two processes listen on the same port at once - exactly what we do not want
    allow_reuse_address = os.name != "nt"
    daemon_threads = True

    def __init__(self, address, handler):
        super().__init__(address, handler)
        port = self.server_address[1]
        self.allowed_hosts = {"127.0.0.1:%d" % port, "localhost:%d" % port}
        self.allowed_origins = {"http://127.0.0.1:%d" % port, "http://localhost:%d" % port}
        if port == 80:                                   # on port 80 the browser leaves the number out
            self.allowed_hosts |= {"127.0.0.1", "localhost"}
            self.allowed_origins |= {"http://127.0.0.1", "http://localhost"}

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return                                       # the browser closed the connection midway - not an error
        super().handle_error(request, client_address)


def same_folder_instance(port):
    """Is Pruta already running on this port - from this very folder?"""
    try:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1.5)
        conn.request("GET", "/api/ping")
        res = conn.getresponse()
        body = res.read(400)
        conn.close()
        return res.status == 200 and json.loads(body.decode("utf-8")).get("folder") == FOLDER_ID
    except Exception:                 # noqa: BLE001 - any other service sitting on the port
        return False


def open_browser(url):
    if os.environ.get("PRUTA_NO_BROWSER") == "1":
        return
    try:
        webbrowser.open(url)
    except Exception:                 # noqa: BLE001
        pass


def main():
    try:
        wanted = int(os.environ.get("PORT", DEFAULT_PORT))
    except ValueError:
        wanted = DEFAULT_PORT

    httpd = None
    for port in range(wanted, wanted + PORT_TRIES):
        try:
            httpd = Server(("127.0.0.1", port), Handler)
            break
        except OSError:
            if same_folder_instance(port):               # a second launch from the same folder: no second server is started
                url = "http://127.0.0.1:%d/" % port
                say("")
                say("  Pruta is already running from this folder.")
                say("  Opening it in your browser:  %s" % url)
                say("")
                open_browser(url)
                return 0
    if httpd is None:
        say("  Could not find a free port between %d and %d." % (wanted, wanted + PORT_TRIES - 1))
        return 1

    ensure_dirs()
    url = "http://127.0.0.1:%d/" % httpd.server_address[1]
    try:
        saved = "%d transactions saved" % tx_count(read_state())
    except Unreadable:
        saved = "cannot be read right now - nothing will be overwritten"

    say("")
    say("  Pruta - every expense, itemised   (by Elay Dadon)")
    say("  " + "-" * 60)
    say("  Open in your browser:  %s" % url)
    say("  Your data file:        %s   (%s)" % (os.path.relpath(STATE_FILE, ROOT), saved))
    say("  Backups:               %s" % os.path.relpath(BACKUP_DIR, ROOT))
    say("")
    say("  Everything runs on this computer only. Nothing is sent anywhere.")
    say("  Keep this window open while you use Pruta.  To stop: Ctrl+C, or close the window.")
    say("")

    threading.Thread(target=lambda: (time.sleep(0.6), open_browser(url)), daemon=True).start()
    with httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            say("\n  Stopped. Your data is in %s\n" % os.path.relpath(STATE_FILE, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
