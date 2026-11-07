"""Download a fixed source snapshot with bounded range requests and retries."""
import os
import sys
import time
import urllib.request

url, destination = sys.argv[1:]
with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as response:
    size = int(response.headers["Content-Length"])
    etag = response.headers.get("ETag")
if size <= 0 or not etag:
    raise RuntimeError("Source must provide a size and ETag")
staging = destination + ".incoming"
identity = staging + ".source"
snapshot = f"{url}\n{size}\n{etag}"
os.makedirs(os.path.dirname(destination) or ".", exist_ok=True)
if os.path.exists(staging):
    with open(identity, encoding="utf-8") as handle:
        if handle.read() != snapshot:
            raise RuntimeError("Source changed; refusing to mix snapshots")
else:
    with open(identity, "w", encoding="utf-8") as handle:
        handle.write(snapshot)
    open(staging, "wb").close()
offset = os.path.getsize(staging)
if offset > size:
    raise RuntimeError("Partial file exceeds source size")
failures = 0
while offset < size:
    end = min(size - 1, offset + 4 * 1024 * 1024 - 1)
    request = urllib.request.Request(url, headers={
        "Range": f"bytes={offset}-{end}", "If-Match": etag,
        "Accept-Encoding": "identity",
    })
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status != 206 or response.headers.get("Content-Range") != f"bytes {offset}-{end}/{size}":
                raise RuntimeError("Source did not return the requested snapshot range")
            expected = end - offset + 1
            received = 0
            with open(staging, "ab") as handle:
                while received < expected:
                    chunk = response.read(min(65536, expected - received))
                    if not chunk:
                        raise OSError("Source closed the connection early")
                    handle.write(chunk)
                    received += len(chunk)
        offset = os.path.getsize(staging)
        failures = 0
        print(f"{destination}: {offset}/{size} bytes", flush=True)
    except (OSError, TimeoutError) as error:
        offset = os.path.getsize(staging)
        failures += 1
        if failures >= 8:
            raise
        print(f"Retry {failures} from byte {offset}: {error}", flush=True)
        time.sleep(min(30, failures * 3))
os.replace(staging, destination)
print(f"Complete: {destination} ({size} bytes)", flush=True)
