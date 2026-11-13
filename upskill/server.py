#!/usr/bin/env python3
"""UpskillAI server (standard library only, no installs).

Serves this folder AND keeps ALL app data in one SQLite database file: data/upskill.db
(employees, photos, skill scores, required levels, theme / mock-mode settings). Nothing is stored in the browser,
so the data survives refreshes, "Clear site data", other browsers, and copying this folder to another computer.

    python3 server.py              (Windows: python server.py)   then open http://localhost:8000
    python3 server.py 9000         use another port
    python3 server.py --lan        also listen on the local network (no login: only on a network you trust)

API (JSON): GET /api/roster  PUT /api/targets  POST /api/import  POST /api/reset  GET /api/photo/<id>
            GET|PUT /api/settings  GET /api/roster.csv  GET /api/demo.csv
"""
import base64, binascii, contextlib, csv, hashlib, http.server, io, json, os, re, sqlite3, sys, threading
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
DB_FILE = os.path.join(DATA_DIR, "upskill.db")
OLD_JSON = os.path.join(DATA_DIR, "roster.json")  # v8-v10 file store, imported once if found
SEED_FILE = os.path.join(ROOT, "seed", "demo_roster.json")  # the demo employees + default skill levels (single source of truth)
ASSETS = os.path.join(ROOT, "Assets")
HTML_PAGES = {"/": "index.html", "/index.html": "index.html", "/dashboard.html": "dashboard.html"}
HIDDEN = ("/data", "/server.py", "/.git")  # never served as static files (the database lives in /data)

MAX_BODY = 40_000_000   # one import request (photos travel as base64)
MAX_PHOTO = 2_000_000   # bytes per photo
MAX_ROWS = 200          # employees per import
MAX_TOTAL = 1000        # employees in the database
THEMES, LOCK = ("light", "dark"), threading.Lock()
IMG_MAGIC = ((b"\xff\xd8\xff", "image/jpeg"), (b"\x89PNG\r\n\x1a\n", "image/png"), (b"GIF8", "image/gif"), (b"BM", "image/bmp"))


# ---------------------------------------------------------------- database
@contextlib.contextmanager
def connect():
    """One short-lived connection per request: commit on success, roll back on any error, always close (so the .db file is never left locked)."""
    db = sqlite3.connect(DB_FILE, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            yield db
    finally:
        db.close()

SCHEMA = """
CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL, target INTEGER NOT NULL CHECK (target BETWEEN 1 AND 5));
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY, position INTEGER NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, target_role TEXT,
  description TEXT, yoe INTEGER, stack TEXT, notes TEXT, photo_url TEXT);
CREATE TABLE IF NOT EXISTS scores (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE, skill_id TEXT NOT NULL REFERENCES skills(id),
  score REAL NOT NULL CHECK (score BETWEEN 0 AND 5), PRIMARY KEY (employee_id, skill_id));
CREATE TABLE IF NOT EXISTS photos (
  employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE, mime TEXT NOT NULL, data BLOB NOT NULL, sha TEXT NOT NULL, file_name TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""

def load_seed():
    with open(SEED_FILE, encoding="utf-8") as f:
        return json.load(f)

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with LOCK, connect() as db:
        db.executescript(SCHEMA)
        if db.execute("SELECT COUNT(*) FROM skills").fetchone()[0]:
            return
        seed = load_seed()
        db.executemany("INSERT INTO skills VALUES (?,?,?,?)", [(s["id"], s["name"], i, s["target"]) for i, s in enumerate(seed["skills"])])
        old = read_old_json()
        if old:  # first run on a v8-v10 folder: keep the roster that was saved in data/roster.json
            replace_roster(db, old["targets"], old["employees"], keep_ids=True, custom=True)
            os.replace(OLD_JSON, OLD_JSON + ".migrated")
            print("Imported your earlier data/roster.json into the database.")
        else:
            replace_roster(db, [s["target"] for s in seed["skills"]], seed["employees"], keep_ids=True, custom=False)

def read_old_json():
    try:
        with open(OLD_JSON, encoding="utf-8") as f:
            d = json.load(f)
        ok = isinstance(d.get("targets"), list) and len(d["targets"]) == 8 and isinstance(d.get("employees"), list) and d["employees"]
        return d if ok else None
    except (OSError, ValueError, AttributeError):
        return None


# ---------------------------------------------------------------- validation + photos
def text(v, n):
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f\x7f]+", " ", str(v if v is not None else ""))).strip()[:n]

def sniff(data):
    for magic, mime in IMG_MAGIC:
        if data.startswith(magic):
            return mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None

def resolve_photo(value):
    """-> ('blob', bytes, mime, file_name) | ('url', https-url) | None.
    Accepts an uploaded data URL, a file inside the Assets folder (by name or Assets/name), or an http(s) link."""
    v = str(value or "").strip()
    if not v:
        return None
    if v.startswith("data:"):
        try:
            head, b64 = v.split(",", 1)
            data = base64.b64decode(b64, validate=False)
        except (ValueError, binascii.Error):
            return None
        mime = sniff(data)
        return ("blob", data, mime, None) if mime and len(data) <= MAX_PHOTO else None
    if re.match(r"https?://", v, re.I):
        return ("url", v[:500])
    rel = unquote(v).replace("\\", "/")
    rel = re.sub(r"^(\./)?assets/", "", rel, flags=re.I)
    path = os.path.realpath(os.path.join(ASSETS, rel))
    if path.startswith(os.path.realpath(ASSETS) + os.sep) and os.path.isfile(path) and os.path.getsize(path) <= MAX_PHOTO:
        with open(path, "rb") as f:
            data = f.read()
        mime = sniff(data)
        return ("blob", data, mime, os.path.basename(path)) if mime else None
    return None

def clean_employee(e):
    """Server-side validation: never trust the browser. Returns a normalised dict or None."""
    if not isinstance(e, dict):
        return None
    name = text(e.get("name"), 60)
    s = e.get("s")
    if not name or not isinstance(s, list) or len(s) != 8:
        return None
    try:
        scores = [min(5.0, max(0.0, round(float(v), 1))) for v in s]
    except (TypeError, ValueError):
        return None
    yoe = e.get("yoe")
    yoe = int(yoe) if isinstance(yoe, (int, float)) and not isinstance(yoe, bool) and 0 <= yoe <= 80 else None
    return {"id": e.get("id"), "name": name, "role": text(e.get("role"), 60) or "Team member", "s": scores,
            "target": text(e.get("target"), 60) or None, "desc": text(e.get("desc"), 300) or None, "yoe": yoe,
            "stack": text(e.get("stack"), 120) or None, "notes": text(e.get("notes"), 600) or None, "photo": e.get("photo")}

def insert_employees(db, emps, keep_ids=False):
    skill_ids = [r["id"] for r in db.execute("SELECT id FROM skills ORDER BY position")]
    used = {r[0] for r in db.execute("SELECT id FROM employees")}
    next_id = max([99] + list(used))
    pos = db.execute("SELECT COALESCE(MAX(position), -1) FROM employees").fetchone()[0]
    for e in emps:
        pos += 1
        eid = e["id"] if keep_ids and isinstance(e["id"], int) and not isinstance(e["id"], bool) and e["id"] > 0 and e["id"] not in used else None
        if eid is None:
            next_id += 1; eid = next_id
        used.add(eid)
        photo = resolve_photo(e["photo"])
        db.execute("INSERT INTO employees (id, position, name, role, target_role, description, yoe, stack, notes, photo_url) VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (eid, pos, e["name"], e["role"], e["target"], e["desc"], e["yoe"], e["stack"], e["notes"], photo[1] if photo and photo[0] == "url" else None))
        db.executemany("INSERT INTO scores VALUES (?,?,?)", [(eid, sid, v) for sid, v in zip(skill_ids, e["s"])])
        if photo and photo[0] == "blob":
            db.execute("INSERT INTO photos VALUES (?,?,?,?,?)", (eid, photo[2], photo[1], hashlib.sha1(photo[1]).hexdigest()[:10], photo[3]))

def replace_roster(db, targets, employees, keep_ids, custom):
    db.execute("DELETE FROM employees")  # scores + photos go with them (ON DELETE CASCADE)
    for sid, t in zip([r["id"] for r in db.execute("SELECT id FROM skills ORDER BY position")], targets):
        db.execute("UPDATE skills SET target = ? WHERE id = ?", (min(5, max(1, int(round(float(t))))), sid))
    insert_employees(db, [x for x in (clean_employee(e) for e in employees) if x], keep_ids)
    set_setting(db, "custom", "1" if custom else "0")

def set_setting(db, key, value):
    db.execute("INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))

def settings(db):
    s = dict(db.execute("SELECT key, value FROM settings").fetchall())
    return {"theme": s.get("theme") if s.get("theme") in THEMES else "light", "mock": s.get("mock") != "0"}  # light + mock ON by default


# ---------------------------------------------------------------- read side
def num(v):
    return int(v) if float(v).is_integer() else v  # 3.0 -> 3, 2.5 stays 2.5

def roster(db):
    skills = db.execute("SELECT id, target FROM skills ORDER BY position").fetchall()
    scores = {}
    for r in db.execute("SELECT employee_id, skill_id, score FROM scores"):
        scores.setdefault(r["employee_id"], {})[r["skill_id"]] = r["score"]
    shas = {r["employee_id"]: r["sha"] for r in db.execute("SELECT employee_id, sha FROM photos")}
    out = []
    for r in db.execute("SELECT * FROM employees ORDER BY position, id"):
        sc = scores.get(r["id"], {})
        e = {"id": r["id"], "name": r["name"], "role": r["role"], "s": [num(sc.get(s["id"], 0)) for s in skills]}
        for key, col in (("target", "target_role"), ("desc", "description"), ("yoe", "yoe"), ("stack", "stack"), ("notes", "notes")):
            if r[col] is not None:
                e[key] = r[col]
        if r["id"] in shas:
            e["photo"] = f"/api/photo/{r['id']}?v={shas[r['id']]}"  # served from the database
        elif r["photo_url"]:
            e["photo"] = r["photo_url"]
        out.append(e)
    custom = (db.execute("SELECT value FROM settings WHERE key = 'custom'").fetchone() or ["0"])[0] == "1"
    return {"targets": [s["target"] for s in skills], "employees": out, "custom": custom}

def csv_text(db_or_seed):
    """Employee CSV (also the import template). Same columns the importer reads."""
    if isinstance(db_or_seed, dict):  # the demo seed
        skills, rows = db_or_seed["skills"], db_or_seed["employees"]
        get = lambda e: (e.get("photo") or "")
    else:
        skills = [dict(r) for r in db_or_seed.execute("SELECT id, name FROM skills ORDER BY position")]
        data = roster(db_or_seed)["employees"]
        names = {r["employee_id"]: r["file_name"] for r in db_or_seed.execute("SELECT employee_id, file_name FROM photos")}
        urls = {r["id"]: r["photo_url"] for r in db_or_seed.execute("SELECT id, photo_url FROM employees")}
        rows = data
        get = lambda e: urls.get(e["id"]) or names.get(e["id"]) or ""
    def safe(v):  # stop spreadsheet formula injection
        v = "" if v is None else str(v)
        return "'" + v if v[:1] in ("=", "+", "-", "@") else v
    buf = io.StringIO(newline="")
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["name", "role"] + [s["name"] for s in skills] + ["target_role", "description", "yoe", "stack", "notes", "photo"])
    for e in rows:
        w.writerow([safe(e["name"]), safe(e["role"])] + list(e["s"]) + [safe(e.get("target")), safe(e.get("desc")), e.get("yoe", ""), safe(e.get("stack")), safe(e.get("notes")), safe(get(e))])
    return buf.getvalue()


# ---------------------------------------------------------------- HTTP
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # always serve fresh files
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet; errors still show
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)

    def _send(self, code, body=b"", ctype="application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def _err(self, code, msg):
        self._json({"error": msg}, code)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            raise ValueError("Request too large or empty.")
        return json.loads(self.rfile.read(n))

    def _path(self):
        return urlsplit(self.path).path

    # ----- GET
    def do_GET(self):
        p = self._path()
        try:
            if p in HTML_PAGES:
                return self._page(HTML_PAGES[p])
            if p.startswith("/api/"):
                return self._api_get(p)
        except Exception as e:  # never leak a traceback page to the browser
            return self._err(500, f"Server error: {e}")
        if any(p == h or p.startswith(h + "/") for h in HIDDEN):
            return self._err(404, "Not found")
        return super().do_GET()

    do_HEAD = do_GET

    def _page(self, name):
        """Serve an HTML page with the saved theme / mock setting injected, so there is no flash and no browser storage."""
        with open(os.path.join(ROOT, name), encoding="utf-8") as f:
            html = f.read()
        with connect() as db:
            s = settings(db)
        boot = json.dumps({"settings": s}).replace("<", "\\u003c")
        script = f"<script>window.UPSKILL_BOOT={boot};document.body.classList.toggle('dark',{str(s['theme'] == 'dark').lower()});document.body.classList.toggle('mock',{str(s['mock']).lower()});</script>"
        self._send(200, html.replace("<!--BOOT-->", script).encode("utf-8"), "text/html; charset=utf-8")

    def _api_get(self, p):
        with connect() as db:
            if p == "/api/roster":
                return self._json(roster(db))
            if p == "/api/settings":
                return self._json(settings(db))
            if p == "/api/roster.csv":
                return self._send(200, csv_text(db).encode("utf-8"), "text/csv; charset=utf-8", {"Content-Disposition": 'attachment; filename="upskill-roster.csv"'})
            if p == "/api/demo.csv":
                return self._send(200, csv_text(load_seed()).encode("utf-8"), "text/csv; charset=utf-8", {"Content-Disposition": 'attachment; filename="upskill-demo-employees.csv"'})
            m = re.fullmatch(r"/api/photo/(\d+)", p)
            if m:
                r = db.execute("SELECT mime, data, sha FROM photos WHERE employee_id = ?", (int(m.group(1)),)).fetchone()
                if not r:
                    return self._err(404, "No photo")
                return self._send(200, bytes(r["data"]), r["mime"], {"ETag": '"' + r["sha"] + '"'})
        self._err(404, "Not found")

    # ----- writes
    def do_PUT(self):
        self._write()

    def do_POST(self):
        self._write()

    def _write(self):
        p = self._path()
        try:
            body = self._body()
            with LOCK, connect() as db:  # one writer at a time; the answer is sent only AFTER the commit below
                code, obj = self._handle_write(db, p, body)
            self._json(obj, code)
        except (ValueError, KeyError, TypeError) as e:
            self._err(400, f"Bad request: {e}")
        except sqlite3.Error as e:
            self._err(500, f"Database error: {e}")

    def _handle_write(self, db, p, body):
        """-> (http code, json). Raising rolls the whole change back."""
        if p == "/api/targets" and self.command == "PUT":
            val = body.get("value")
            if not isinstance(val, (int, float)) or isinstance(val, bool):
                return 400, {"error": "Required level must be a number from 1 to 5."}
            cur = db.execute("UPDATE skills SET target = ? WHERE id = ?", (min(5, max(1, int(round(val)))), body.get("id")))
            if not cur.rowcount:
                return 404, {"error": "Unknown skill."}
            set_setting(db, "custom", "1")
            return 200, roster(db)
        if p == "/api/import" and self.command == "POST":
            rows = body.get("employees")
            if not isinstance(rows, list) or not rows or len(rows) > MAX_ROWS:
                return 400, {"error": f"Send between 1 and {MAX_ROWS} employees."}
            emps = [x for x in (clean_employee(e) for e in rows) if x]
            if not emps:
                return 400, {"error": "No valid employee rows."}
            if body.get("mode") == "replace":
                db.execute("DELETE FROM employees")
            elif db.execute("SELECT COUNT(*) FROM employees").fetchone()[0] + len(emps) > MAX_TOTAL:
                return 400, {"error": f"The database is limited to {MAX_TOTAL} employees."}
            insert_employees(db, emps)
            set_setting(db, "custom", "1")
            return 200, roster(db)
        if p == "/api/reset" and self.command == "POST":
            seed = load_seed()
            replace_roster(db, [s["target"] for s in seed["skills"]], seed["employees"], keep_ids=True, custom=False)
            return 200, roster(db)
        if p == "/api/settings" and self.command == "PUT":
            if body.get("theme") in THEMES:
                set_setting(db, "theme", body["theme"])
            if isinstance(body.get("mock"), bool):
                set_setting(db, "mock", "1" if body["mock"] else "0")
            return 200, settings(db)
        return 404, {"error": "Not found"}


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lan = "--lan" in sys.argv
    port = int(args[0]) if args else 8000
    init_db()
    with http.server.ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", port), Handler) as srv:
        print(f"UpskillAI running at http://localhost:{port}" + ("  (also reachable on your network)" if lan else ""))
        print(f"Database: {DB_FILE}  (copy the whole folder to move your data)  Ctrl+C to stop")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
