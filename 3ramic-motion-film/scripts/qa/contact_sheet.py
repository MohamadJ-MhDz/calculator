#!/usr/bin/env python3
"""
3RAMIC — contact sheet of the QA stills (needs Pillow: pip install pillow).

    python scripts/qa/contact_sheet.py [--frames out/qa/frames] [--out out/qa/contact-sheet.jpg] [--cols 11] [--thumb 200]

Labels each thumbnail with its film frame, time and scene (from production/cues.json and
src/data/timeline.json), in the order the stills were rendered by `npm run stills`.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", default=os.path.join(ROOT, "out", "qa", "frames"))
    ap.add_argument("--out", default=os.path.join(ROOT, "out", "qa", "contact-sheet.jpg"))
    ap.add_argument("--cols", type=int, default=11)
    ap.add_argument("--thumb", type=int, default=200)
    a = ap.parse_args()
    files = sorted(f for f in os.listdir(a.frames) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    cues = json.load(open(os.path.join(ROOT, "production", "cues.json"), encoding="utf-8"))
    tl = json.load(open(os.path.join(ROOT, "src", "data", "timeline.json"), encoding="utf-8"))
    frames = cues.get("QA_FRAMES", list(range(len(files))))
    fps = tl["fps"]
    w = a.thumb
    h = int(w * 16 / 9)
    pad, lab = 8, 22
    rows = (len(files) + a.cols - 1) // a.cols
    sheet = Image.new("RGB", (a.cols * (w + pad) + pad, rows * (h + lab + pad) + pad), (245, 242, 236))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    for k, name in enumerate(files):
        im = Image.open(os.path.join(a.frames, name)).convert("RGB").resize((w, h), Image.LANCZOS)
        x = pad + (k % a.cols) * (w + pad)
        y = pad + (k // a.cols) * (h + lab + pad)
        sheet.paste(im, (x, y))
        f = frames[k] if k < len(frames) else k
        sc = next((s["id"] for s in tl["scenes"] if s["from"] <= f < s["to"]), "")
        d.text((x + 2, y + h + 4), f"f{f:04d}  {f / fps:5.2f}s  {sc}", fill=(21, 24, 28), font=font)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    sheet.save(a.out, quality=88)
    print("wrote", os.path.relpath(a.out, ROOT), f"({len(files)} stills)")


if __name__ == "__main__":
    main()
