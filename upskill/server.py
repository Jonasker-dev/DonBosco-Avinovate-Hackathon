#!/usr/bin/env python3
"""UpskillAI local server (standard library only, no installs).

Serves this folder AND keeps the imported roster in data/roster.json, so imported employees survive even
"Clear site data" in the browser. Without this server the app still works: it falls back to localStorage + IndexedDB.

    python3 server.py          (Windows: python server.py)   then open http://localhost:8000
    python3 server.py 9000     to use another port

API (used by js/roster.js):  GET / PUT / DELETE  /api/roster
"""
import http.server, json, os, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
FILE = os.path.join(DATA_DIR, "roster.json")
MAX_BYTES = 2_000_000  # a 200-employee roster is about 40 KB


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # The cookie tells the page that this server is running (js/roster.js then uses /api/roster).
        self.send_header("Set-Cookie", "upskill_srv=1; Path=/; SameSite=Strict")
        self.send_header("Cache-Control", "no-store")  # always serve fresh files while developing
        super().end_headers()

    def _is_api(self):
        return self.path.split("?")[0] == "/api/roster"

    def _reply(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if not self._is_api():
            return super().do_GET()
        if not os.path.isfile(FILE):
            return self._reply(204)  # nothing saved yet
        with open(FILE, "rb") as f:
            self._reply(200, f.read())

    def do_PUT(self):
        if not self._is_api():
            return self._reply(404)
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > MAX_BYTES:
                return self._reply(413)
            data = json.loads(self.rfile.read(n))
            if not (isinstance(data, dict) and isinstance(data.get("targets"), list) and isinstance(data.get("employees"), list)):
                return self._reply(400)
            os.makedirs(DATA_DIR, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=DATA_DIR, suffix=".tmp")  # write then rename: never a half-written file
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            os.replace(tmp, FILE)
            self._reply(204)
        except (ValueError, OSError):
            self._reply(400)

    def do_DELETE(self):
        if not self._is_api():
            return self._reply(404)
        try:
            os.remove(FILE)
        except FileNotFoundError:
            pass
        self._reply(204)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler) as srv:  # localhost only
        print(f"UpskillAI running at http://localhost:{port}  (imported data is saved in data/roster.json)  Ctrl+C to stop")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
