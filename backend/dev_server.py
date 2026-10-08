"""Fast local adapter: serves the exact same Lambda handlers over plain HTTP (no Docker needed).

Usage: python dev_server.py [port]      (default 3000, same port as `sam local start-api`)
"""
from __future__ import annotations
import re, sys, json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from api import handlers as h

ROUTES = [
    ("GET", r"^/health$", h.health, []),
    ("POST", r"^/bill/extract$", h.bill_extract, []),
    ("POST", r"^/size$", h.size, []),
    ("POST", r"^/cases$", h.create_case, []),
    ("GET", r"^/cases/([^/]+)$", h.get_case, ["id"]),
    ("POST", r"^/cases/([^/]+)/documents$", h.documents, ["id"]),
    ("GET", r"^/files/([^/]+)/([^/]+)$", h.file_download, ["id", "name"]),
    ("POST", r"^/chat$", h.chat, []),
]


class Handler(BaseHTTPRequestHandler):
    def _dispatch(self):
        path = urlparse(self.path).path
        method = self.command
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode() if length else None
        for m, pattern, fn, names in ROUTES:
            match = re.match(pattern, path)
            if match and (m == method or method == "OPTIONS"):
                event = {"httpMethod": method, "path": path, "body": body,
                         "pathParameters": dict(zip(names, match.groups())), "isBase64Encoded": False}
                res = fn(event, None)
                return self._send(res)
        self._send({"statusCode": 404, "headers": h.CORS, "body": json.dumps({"error": "not found"}), "isBase64Encoded": False})

    def _send(self, res):
        import base64
        raw = base64.b64decode(res["body"]) if res.get("isBase64Encoded") else res["body"].encode()
        self.send_response(res["statusCode"])
        for k, v in res["headers"].items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    do_GET = do_POST = do_OPTIONS = _dispatch

    def log_message(self, fmt, *args):
        sys.stderr.write("[api] " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    print(f"RoofRight API on http://localhost:{port} (store: {h.store.backend_name()})")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
