#!/usr/bin/env python3
"""
3RAMIC — builds out/3ramic-RELEASE-MASTER.zip from the project's tracked files.

    python scripts/package_release.py

Includes the whole Remotion project (source, scenes, brand config, fonts + licences, dialogue,
voice definitions, alignment, music, effects, mix, subtitles, lockfile, scripts, docs and QA
evidence in docs/qa/). Excludes node_modules, renders and caches (out/), voice takes and models.
"""
import os
import subprocess
import sys
import zipfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(ROOT, "out", "3ramic-RELEASE-MASTER.zip")
PREFIX = "3ramic-RELEASE-MASTER/"
EXCLUDE_DIRS = ("node_modules/", "out/", "production/takes/", "production/audio/stems/", "voice-models/", ".agents/", ".claude/", "skills-lock.json")


def tracked():
    r = subprocess.run(["git", "ls-files", "-z", "--", "."], cwd=ROOT, capture_output=True, check=True)
    files = [f for f in r.stdout.decode("utf-8").split("\0") if f]
    # git reports paths relative to cwd when run inside a sub-directory of the repo
    return sorted(f for f in files if not f.startswith(EXCLUDE_DIRS) and os.path.isfile(os.path.join(ROOT, f)))


def main():
    files = tracked()
    if not files:
        sys.exit("no tracked files found (run inside the git checkout)")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    total = 0
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            p = os.path.join(ROOT, f)
            # already-compressed media gain nothing from deflate
            ctype = zipfile.ZIP_STORED if f.lower().endswith((".mp4", ".jpg", ".jpeg", ".png", ".woff2")) else zipfile.ZIP_DEFLATED
            z.write(p, PREFIX + f, compress_type=ctype)
            total += os.path.getsize(p)
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(files)} files, {total / 1e6:.1f} MB uncompressed, {os.path.getsize(OUT) / 1e6:.1f} MB zipped")


if __name__ == "__main__":
    main()
