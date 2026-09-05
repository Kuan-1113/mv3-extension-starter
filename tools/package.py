#!/usr/bin/env python3
"""
Build the upload zip from an explicit allowlist.

    python tools/package.py

Why an allowlist and not "zip the folder minus a few things":

A denylist fails open. Add `debug.html` while testing, forget it, and it ships
— along with whatever it reveals. An allowlist fails closed: a new file is not
in the zip until you deliberately add it here, and the build tells you when a
listed file has gone missing.

Store review rejects packages for things this also catches: stray source maps,
node_modules, .DS_Store, and test pages that expose internals.
"""

import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")

# Everything that ships. Add new files here on purpose.
FILES = [
    "manifest.json",
    "background.js",
    "content.js",
    "content.css",
    "offscreen.html",
    "offscreen.js",
    "options.html",
    "options.css",
    "options.js",
    "lib/guard.js",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png",
]

# Store limits worth failing the build on, because the error messages you get
# from the dashboard for these are actively misleading.
NAME_MAX = 45
DESC_MAX = 132
ZIP_MAX_MB = 10


def main() -> None:
    manifest_path = os.path.join(SRC, "manifest.json")
    if not os.path.exists(manifest_path):
        sys.exit("No manifest at " + manifest_path)

    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)          # also fails the build on invalid JSON

    problems = []
    if len(manifest["name"]) > NAME_MAX:
        problems.append("name is %d chars, limit %d" % (len(manifest["name"]), NAME_MAX))
    if len(manifest["description"]) > DESC_MAX:
        problems.append("description is %d chars, limit %d" % (len(manifest["description"]), DESC_MAX))

    missing = [f for f in FILES if not os.path.exists(os.path.join(SRC, f.replace("/", os.sep)))]
    if missing:
        problems.append("missing files: " + ", ".join(missing))

    # Anything in src/ that isn't in FILES. Not fatal — but you should look at
    # it, because this is exactly where a forgotten test page hides.
    on_disk = set()
    for base, _, names in os.walk(SRC):
        for n in names:
            rel = os.path.relpath(os.path.join(base, n), SRC).replace(os.sep, "/")
            on_disk.add(rel)
    extra = sorted(on_disk - set(FILES))

    if problems:
        print("BUILD FAILED")
        for p in problems:
            print("  ! " + p)
        sys.exit(1)

    out = os.path.join(ROOT, "%s-v%s.zip" % (
        manifest["name"].lower().replace(" ", "-"), manifest["version"]))
    if os.path.exists(out):
        os.remove(out)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in FILES:
            z.write(os.path.join(SRC, f.replace("/", os.sep)), f)

    size_mb = os.path.getsize(out) / 1048576
    print("%s  %.2f MB  %d files" % (os.path.basename(out), size_mb, len(FILES)))

    if extra:
        print("\nIn src/ but NOT shipped (check this list every time):")
        for e in extra:
            print("  - " + e)

    if size_mb > ZIP_MAX_MB:
        print("\nNote: %.1f MB. Large packages are slower to review." % size_mb)


if __name__ == "__main__":
    main()
