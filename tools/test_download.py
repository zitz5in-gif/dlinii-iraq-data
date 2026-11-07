import http.server
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest

DATA = bytes(range(256)) * 2048
SCRIPT = Path(__file__).with_name("download.py")


class Handler(http.server.BaseHTTPRequestHandler):
    interrupted = False
    starts = []
    wrong_range = False

    def log_message(self, *args):
        pass

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Length", str(len(DATA)))
        self.send_header("ETag", '"snapshot-one"')
        self.end_headers()

    def do_GET(self):
        start, end = map(int, self.headers["Range"][6:].split("-"))
        self.starts.append(start)
        if self.headers.get("If-Match") != '"snapshot-one"':
            self.send_error(412)
            return
        self.send_response(206)
        range_start = start + 1 if self.wrong_range else start
        self.send_header("Content-Range", f"bytes {range_start}-{end}/{len(DATA)}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        if not Handler.interrupted:
            Handler.interrupted = True
            self.wfile.write(DATA[start:start + 100000])
            self.wfile.flush()
            self.close_connection = True
        else:
            self.wfile.write(DATA[start:end + 1])


class DownloadTests(unittest.TestCase):
    def setUp(self):
        Handler.interrupted = False
        Handler.starts = []
        Handler.wrong_range = False
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.temp = tempfile.TemporaryDirectory()
        self.target = Path(self.temp.name) / "map.bin"
        self.url = f"http://127.0.0.1:{self.server.server_port}/map"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def run_download(self):
        return subprocess.run([sys.executable, str(SCRIPT), self.url, str(self.target)],
                              capture_output=True, text=True, timeout=20)

    def test_interrupted_connection_resumes_without_duplicate_bytes(self):
        result = self.run_download()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.target.read_bytes(), DATA)
        self.assertEqual(Handler.starts, [0, 100000])

    def test_invalid_range_never_activates_output(self):
        Handler.wrong_range = True
        Handler.interrupted = True
        result = self.run_download()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.target.exists())

    def test_changed_snapshot_preserves_existing_partial(self):
        partial = Path(str(self.target) + ".incoming")
        partial.write_bytes(b"previous snapshot")
        Path(str(partial) + ".source").write_text("old snapshot", encoding="utf-8")
        result = self.run_download()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(partial.read_bytes(), b"previous snapshot")
        self.assertEqual(Handler.starts, [])


if __name__ == "__main__":
    unittest.main()
