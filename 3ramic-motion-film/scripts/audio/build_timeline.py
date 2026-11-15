#!/usr/bin/env python3
"""
3RAMIC — audio-first timeline builder (numpy only).

The dialogue recordings decide the length of every shot. This script

  1. reads production/screenplay.json (the written dialogue and the order of events),
  2. measures every recorded line in public/audio/voice/<id>.wav,
  3. lays the film out frame by frame (30 fps): each line starts after the previous one
     ends plus its written gap, holds are fixed action beats,
  4. builds the mouth-shape track of every line from the hand-checked phonemes in
     production/pronunciation.json, timed by the word alignment in
     production/voice/<id>.align.json when present, otherwise by speech energy,
  5. writes src/data/timeline.json (read by the film) and the subtitle files.

    python scripts/audio/build_timeline.py            # normal
    python scripts/audio/build_timeline.py --estimate # no recordings yet: estimate lengths

Replace a WAV with a better recording, run this again, and every shot, subtitle and
mouth follows the new timing. Nothing in the film stores a frame number for dialogue.
"""
import json
import math
import os
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
VOICE_DIR = os.path.join(ROOT, "public", "audio", "voice")
ALIGN_DIR = os.path.join(ROOT, "production", "voice")
OUT_JSON = os.path.join(ROOT, "src", "data", "timeline.json")
SUB_DIR = os.path.join(ROOT, "public", "subtitles")

ESTIMATE = "--estimate" in sys.argv

VOWELS = {"a", "â", "e", "i", "o", "u"}
# (jaw opening 0..1, lip rounding 0..1) per phoneme
SHAPE = {
    "â": (0.95, 0.35), "a": (0.80, 0.0), "e": (0.55, 0.0), "i": (0.30, 0.0), "o": (0.55, 0.8), "u": (0.30, 1.0),
    "m": (0.0, 0.0), "b": (0.0, 0.0), "p": (0.0, 0.0),
    "f": (0.14, 0.0), "v": (0.14, 0.0),
    "t": (0.24, 0.0), "d": (0.24, 0.0), "n": (0.24, 0.0), "l": (0.28, 0.0), "r": (0.26, 0.0), "s": (0.18, 0.0), "z": (0.18, 0.0),
    "sh": (0.22, 0.55), "zh": (0.22, 0.55), "ch": (0.22, 0.5), "j": (0.22, 0.5),
    "k": (0.34, 0.0), "g": (0.34, 0.0), "q": (0.36, 0.0), "x": (0.36, 0.0), "h": (0.40, 0.0), "'": (0.30, 0.0),
    "y": (0.26, 0.0), "w": (0.2, 0.9),
}
# relative duration of each phoneme inside its word
WEIGHT = {"â": 1.5, "i": 1.25, "u": 1.25, "a": 1.0, "e": 0.95, "o": 1.0}


def phonemes(word):
    out = []
    i = 0
    while i < len(word):
        two = word[i:i + 2]
        if two in ("sh", "ch", "zh"):
            out.append(two)
            i += 2
        else:
            out.append(word[i])
            i += 1
    return [p for p in out if p in SHAPE]


def syllables(words):
    return sum(1 for w in words for p in phonemes(w) if p in VOWELS)


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr, ch, n, sw = w.getframerate(), w.getnchannels(), w.getnframes(), w.getsampwidth()
        raw = w.readframes(n)
    if sw != 2:
        raise SystemExit(f"{path}: expected 16-bit PCM, got {sw * 8}-bit")
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def envelope_db(x, sr, hop_s=0.005, win_s=0.02):
    hop, win = int(sr * hop_s), int(sr * win_s)
    n = max(1, 1 + (len(x) - win) // hop) if len(x) >= win else 1
    e = np.zeros(n)
    for k in range(n):
        seg = x[k * hop:k * hop + win]
        e[k] = np.sqrt(np.mean(seg * seg) + 1e-12)
    return 20 * np.log10(e + 1e-9), hop_s


def speech_mask(db, floor_rel=-36.0):
    """True where there is speech: within floor_rel dB of the loudest 5%."""
    ref = np.percentile(db, 95)
    return db > (ref + floor_rel), ref


def word_times_from_energy(words, db, hop_s):
    """No alignment file: give each word a share of the *voiced* time, in order."""
    mask, _ = speech_mask(db)
    # bridge gaps shorter than 90 ms so plosive closures do not count as pauses
    gap = int(0.09 / hop_s)
    idx = np.flatnonzero(mask)
    if len(idx) == 0:
        return [(0.0, len(db) * hop_s) for _ in words]
    filled = mask.copy()
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= gap:
            filled[a:b] = True
    voiced = np.flatnonzero(filled)
    weights = [sum(WEIGHT.get(p, 0.7) for p in phonemes(w)) or 1.0 for w in words]
    total = float(sum(weights))
    cum = np.cumsum([0.0] + weights) / total
    out = []
    for i in range(len(words)):
        a = voiced[min(len(voiced) - 1, int(cum[i] * (len(voiced) - 1)))]
        b = voiced[min(len(voiced) - 1, int(cum[i + 1] * (len(voiced) - 1)))]
        out.append((a * hop_s, max(b * hop_s, a * hop_s + 0.03)))
    return out


def lip_track(words, times, db, hop_s, n_frames, fps):
    """Per video frame: jaw opening and lip rounding."""
    segs = []  # (t0, t1, open, round)
    for w, (t0, t1) in zip(words, times):
        ph = phonemes(w)
        if not ph:
            continue
        ws = [WEIGHT.get(p, 0.7) for p in ph]
        tot = sum(ws)
        t = t0
        for p, wt in zip(ph, ws):
            d = (t1 - t0) * wt / tot
            segs.append((t, t + d, SHAPE[p][0], SHAPE[p][1]))
            t += d
    mask_ref = np.percentile(db, 95)
    open_, round_, energy = [], [], []
    o_prev, r_prev = 0.0, 0.0
    for k in range(n_frames):
        t = (k + 0.5) / fps
        tgt_o, tgt_r = 0.0, 0.0
        for (a, b, o, r) in segs:
            if a <= t < b:
                tgt_o, tgt_r = o, r
                break
        j = min(len(db) - 1, int(t / hop_s))
        lo, hi = max(0, j - 3), min(len(db), j + 4)
        level = float(np.max(db[lo:hi])) - mask_ref  # 0 dB = loud, negative = quieter
        gate = min(1.0, max(0.0, (level + 34.0) / 14.0))  # silence closes the mouth
        tgt_o *= gate
        # the jaw is quicker to open than to close
        k_o = 0.72 if tgt_o > o_prev else 0.5
        o_prev += (tgt_o - o_prev) * k_o
        r_prev += (tgt_r * gate - r_prev) * 0.6
        open_.append(round(o_prev, 3))
        round_.append(round(r_prev, 3))
        energy.append(round(min(1.0, max(0.0, (level + 30.0) / 30.0)), 3))
    return open_, round_, energy


def srt_time(frame, fps):
    ms = round(frame * 1000 / fps)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    sp = json.load(open(os.path.join(ROOT, "production", "screenplay.json"), encoding="utf-8"))
    pron = json.load(open(os.path.join(ROOT, "production", "pronunciation.json"), encoding="utf-8"))["lines"]
    fps = sp["fps"]
    by_id = {l["id"]: l for l in sp["lines"]}

    measured = {}
    for lid, l in by_id.items():
        words = pron[lid]
        path = os.path.join(VOICE_DIR, f"{lid}.wav")
        if os.path.exists(path) and not ESTIMATE:
            x, sr = read_wav(path)
            db, hop_s = envelope_db(x, sr)
            dur = len(x) / sr
            align_path = os.path.join(ALIGN_DIR, f"{lid}.align.json")
            times, source = None, "energy"
            if os.path.exists(align_path):
                al = json.load(open(align_path, encoding="utf-8"))
                if len(al.get("words", [])) == len(words):
                    times = [(w["start"], w["end"]) for w in al["words"]]
                    source = "words:" + al.get("source", "alignment")
            if times is None:
                times = word_times_from_energy(words, db, hop_s)
            measured[lid] = dict(dur=dur, db=db, hop_s=hop_s, times=times, source=source, recorded=True)
        else:
            if not ESTIMATE:
                print(f"  ! {lid}: no recording at public/audio/voice/{lid}.wav — length estimated")
            dur = syllables(words) / 5.6 + 0.2 + 0.25 * l["speechText"].count("…")
            n = int(dur / 0.005)
            db = np.full(n, -20.0)
            times = word_times_from_energy(words, db, 0.005)
            measured[lid] = dict(dur=dur, db=db, hop_s=0.005, times=times, source="estimated", recorded=False)

    cursor = 0
    scenes, lines, holds = [], [], {}

    def place(lid, start):
        m = measured[lid]
        l = by_id[lid]
        n_frames = int(math.ceil(m["dur"] * fps))
        o, r, e = lip_track(pron[lid], m["times"], m["db"], m["hop_s"], n_frames, fps)
        counts = l.get("phraseWords") or [len(pron[lid])]
        phrases, wi = [], 0
        for text, cnt in zip(l["phrases"], counts):
            t0 = m["times"][wi][0]
            t1 = m["times"][min(len(m["times"]) - 1, wi + cnt - 1)][1]
            phrases.append({"text": text, "from": start + max(0, int(t0 * fps) - 2), "to": start + int(math.ceil(t1 * fps)) + 8})
            wi += cnt
        for a, b in zip(phrases[:-1], phrases[1:]):
            a["to"] = min(a["to"], b["from"])
        lines.append({
            "id": lid, "speaker": l["speaker"], "from": start, "to": start + n_frames,
            "seconds": round(m["dur"], 3), "file": f"audio/voice/{lid}.wav",
            "text": l["displayText"], "speech": l["speechText"], "subtitle": l.get("subtitle", True),
            "brand": bool(l.get("brand")), "recorded": m["recorded"], "lipSource": m["source"],
            "phrases": phrases, "open": o, "round": r, "energy": e,
            "words": [{"w": w, "from": start + int(a * fps), "to": start + int(math.ceil(b * fps))} for w, (a, b) in zip(pron[lid], m["times"])],
        })
        return start + n_frames

    for sc in sp["scenes"]:
        s_from = cursor
        cursor += sc.get("lead", 0)
        for ev in sc["events"]:
            if "line" in ev:
                cursor = place(ev["line"], cursor + ev.get("pre", 0))
            else:
                h_from = cursor
                for ins in ev.get("inside", []):
                    place(ins["line"], h_from + ins["at"])
                cursor += ev["frames"]
                holds[ev["hold"]] = {"from": h_from, "to": cursor}
        cursor += sc.get("tail", 0)
        scenes.append({"id": sc["id"], "titleFa": sc["titleFa"], "from": s_from, "to": cursor})

    lines.sort(key=lambda l: l["from"])
    for a, b in zip(lines[:-1], lines[1:]):
        if a["phrases"] and b["phrases"]:
            a["phrases"][-1]["to"] = min(a["phrases"][-1]["to"], b["phrases"][0]["from"])

    timeline = {
        "generatedBy": "scripts/audio/build_timeline.py",
        "fps": fps,
        "durationInFrames": cursor,
        "seconds": round(cursor / fps, 3),
        "allRecorded": all(l["recorded"] for l in lines),
        "scenes": scenes,
        "holds": holds,
        "lines": lines,
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    os.makedirs(SUB_DIR, exist_ok=True)
    cues, n = [], 0
    for l in lines:
        if not l["subtitle"]:
            continue
        for p in l["phrases"]:
            n += 1
            cues.append({"id": n, "line": l["id"], "speaker": l["speaker"], "from": p["from"], "to": p["to"], "text": p["text"]})
    with open(os.path.join(SUB_DIR, "dialogue-fa.srt"), "w", encoding="utf-8") as f:
        for c in cues:
            f.write(f"{c['id']}\n{srt_time(c['from'], fps)} --> {srt_time(c['to'], fps)}\n‫{c['text']}‬\n\n")
    with open(os.path.join(SUB_DIR, "dialogue-fa.json"), "w", encoding="utf-8") as f:
        json.dump({"fps": fps, "language": "fa", "direction": "rtl", "cues": cues}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"timeline: {cursor} frames = {cursor / fps:.2f} s @ {fps} fps  |  all lines recorded: {timeline['allRecorded']}")
    for s in scenes:
        print(f"  scene {s['id']:<9} {s['from']:>5} – {s['to']:<5} ({(s['to'] - s['from']) / fps:5.2f} s)")
    for l in lines:
        print(f"  {l['id']} {l['speaker']:<9} {l['from']:>5} – {l['to']:<5} {l['seconds']:5.2f} s  lip:{l['lipSource']:<22} {l['speech']}")
    for k, h in holds.items():
        print(f"  hold {k:<10} {h['from']:>5} – {h['to']:<5}")


if __name__ == "__main__":
    main()
