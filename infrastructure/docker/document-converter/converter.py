from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse, parse_qs
import subprocess
import uuid

MAX_BYTES = 40 * 1024 * 1024

class Handler(BaseHTTPRequestHandler):
    server_version = "BilTekMYOConverter/1.0"

    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"ready")

    def do_POST(self):
        query = parse_qs(urlparse(self.path).query)
        extension = query.get("format", [""])[0].lower()
        if urlparse(self.path).path != "/convert" or extension not in ("docx", "pptx"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400)
            return
        if length <= 0 or length > MAX_BYTES:
            self.send_error(413)
            return
        source_bytes = self.rfile.read(length)
        if len(source_bytes) != length or not source_bytes.startswith(b"PK\x03\x04"):
            self.send_error(415)
            return
        with TemporaryDirectory(prefix="biltek-convert-") as temporary:
            directory = Path(temporary)
            source = directory / f"{uuid.uuid4().hex}.{extension}"
            output = source.with_suffix(".pdf")
            source.write_bytes(source_bytes)
            profile = (directory / "profile").as_uri()
            try:
                result = subprocess.run(
                    ["soffice", "--headless", f"-env:UserInstallation={profile}", "--convert-to", "pdf", "--outdir", str(directory), str(source)],
                    capture_output=True, timeout=60, check=False,
                )
            except subprocess.TimeoutExpired:
                self.send_error(504, "Document conversion timed out")
                return
            if result.returncode != 0 or not output.is_file() or output.stat().st_size > 80 * 1024 * 1024:
                self.send_error(422, "Document could not be converted")
                return
            pdf = output.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(pdf)

    def log_message(self, format, *args):
        return

ThreadingHTTPServer(("0.0.0.0", 3030), Handler).serve_forever()
