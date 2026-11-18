#!/usr/bin/env python3
"""
3RAMIC — audio-first timeline builder (numpy only).

The dialogue recordings decide the length of every shot. This script

  1. reads production/screenplay.json (the written dialogue and the order of events),
  2. measures every recorded line in public/audio/voice/<id>.wav,
  3. lays the film out frame by frame (30 fps): each line starts after the previous one
     ends plus its written gap (`pre`), holds are fixed action beats, scenes end `tail`
     frames after their last event,
  4. builds the mouth track of every line:
       - from the exact phoneme timing the voice model reported for that take
         (production/voice/<id>.align.json, only if its checksum matches the WAV), or
       - for any other recording (e.g. a human actor), from the hand-checked phonemes in
         production/phonemes.json spread over the recording's own voiced time,
     and gates it with the recording's loudness so the mouth is shut in silence,
  5. writes src/data/timeline.json (read by the film) and the subtitle files
     public/subtitles/dialogue-fa.srt / .json.

    python scripts/audio/build_timeline.py            # normal
    python scripts/audio/build_timeline.py --estimate # no recordings yet: estimate lengths

Replace a WAV with a better recording, run this again, and every shot, subtitle and
mouth follows the new timing. Nothing in the film stores a frame number for dialogue.
"""
import hashlib
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
LEAD = 0.033  # the mouth moves about one frame before the sound it makes

# Mouth shape per phoneme symbol (eSpeak-NG Persian conventions, as in phonemes.json):
# (jaw opening 0..1, lip rounding 0..1). Two-letter affricates tʃ/dʒ are two symbols.
SHAPE = {
    "ɑ": (0.95, 0.30), "a": (0.80, 0.0), "e": (0.55, 0.0), "i": (0.30, 0.0), "o": (0.58, 0.80), "u": (0.30, 1.0),
    "m": (0.0, 0.0), "b": (0.0, 0.0), "p": (0.0, 0.0),
    "f": (0.14, 0.0), "v": (0.14, 0.0),
    "t": (0.24, 0.0), "d": (0.24, 0.0), "n": (0.24, 0.0), "l": (0.28, 0.0), "r": (0.26, 0.0), "s": (0.18, 0.0), "z": (0.18, 0.0),
    "ʃ": (0.22, 0.55), "ʒ": (0.22, 0.55),
    "k": (0.34, 0.0), "ɡ": (0.34, 0.0), "g": (0.34, 0.0), "q": (0.36, 0.0), "ɢ": (0.36, 0.0), "x": (0.36, 0.0), "ɣ": (0.36, 0.0),
    "h": (0.40, 0.0), "ʔ": (0.30, 0.0), "j": (0.26, 0.0), "w": (0.20, 0.9),
}
VOWELS = set("ɑaeiou")
WEIGHT = {"ɑ": 1.5, "i": 1.25, "u": 1.25, "a": 1.0, "e": 0.95, "o": 1.0}


def ipa_symbols(word):
    """Mouth-relevant symbols of one phoneme word (drops stress, length, the '1' of q1, punctuation)."""
    return [c for c in word if c in SHAPE]


def phoneme_words(lid, phon):
    """The spoken words of a line as phoneme strings, and how many fall in each phrase."""
    words, counts = [], []
    for ph in phon[lid]["phrases"]:
        ws = [w for w in ph["ph"].split(" ") if ipa_symbols(w)]
        merged = []
        for w in ws:
            merged.extend([w.replace("+", "")] if "+" in w else [w])
        words.extend(merged)
        counts.append(len(merged))
    return words, counts


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


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def envelope_db(x, sr, hop_s=0.005, win_s=0.02):
    hop, win = int(sr * hop_s), int(sr * win_s)
    if len(x) < win:
        return np.array([-90.0]), hop_s
    n = 1 + (len(x) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    e = np.sqrt(np.mean(x[idx] ** 2, axis=1) + 1e-12)
    return 20 * np.log10(e + 1e-9), hop_s


def voiced_frames(db, hop_s):
    ref = np.percentile(db, 95)
    mask = db > ref - 36.0
    gap = int(0.09 / hop_s)  # plosive closures are not pauses
    idx = np.flatnonzero(mask)
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= gap:
            mask[a:b] = True
    return np.flatnonzero(mask)


def phones_from_energy(words, db, hop_s):
    """No valid alignment (e.g. a human recording): spread the phonemes over the voiced time."""
    voiced = voiced_frames(db, hop_s)
    sym = [(wi, s) for wi, w in enumerate(words) for s in ipa_symbols(w)]
    if len(voiced) == 0 or not sym:
        return [], [(0.0, len(db) * hop_s) for _ in words]
    wts = np.array([WEIGHT.get(s, 0.7) for _, s in sym])
    cum = np.concatenate([[0.0], np.cumsum(wts)]) / wts.sum()
    at = lambda u: voiced[min(len(voiced) - 1, int(u * (len(voiced) - 1)))] * hop_s
    phones = [{"p": s, "start": at(cum[k]), "end": max(at(cum[k + 1]), at(cum[k]) + 0.02)} for k, (_, s) in enumerate(sym)]
    wt = []
    for wi in range(len(words)):
        ks = [k for k, (w, _) in enumerate(sym) if w == wi]
        wt.append((phones[ks[0]]["start"], phones[ks[-1]]["end"]) if ks else (0.0, 0.0))
    return phones, wt


def lip_track(phones, db, hop_s, n_frames, fps):
    """Per video frame: jaw opening, lip rounding and speech energy."""
    segs = [(p["start"] - LEAD, p["end"] - LEAD, *SHAPE.get(p["p"], (0.25, 0.0))) for p in phones if p["p"] in SHAPE]
    ref = np.percentile(db, 95)
    open_, round_, energy = [], [], []
    o_prev, r_prev = 0.0, 0.0
    si = 0
    for k in range(n_frames):
        t = (k + 0.5) / fps
        while si < len(segs) - 1 and segs[si][1] <= t:
            si += 1
        tgt_o, tgt_r = 0.0, 0.0
        if segs and segs[si][0] <= t < segs[si][1]:
            tgt_o, tgt_r = segs[si][2], segs[si][3]
        j = min(len(db) - 1, int((t + LEAD) / hop_s))
        lo, hi = max(0, j - 3), min(len(db), j + 4)
        level = float(np.max(db[lo:hi])) - ref  # 0 dB = loud, negative = quieter
        gate = min(1.0, max(0.0, (level + 34.0) / 14.0))  # silence shuts the mouth
        loud = min(1.0, max(0.0, (level + 30.0) / 30.0))
        tgt_o *= gate * (0.7 + 0.3 * loud)  # louder syllables open wider
        k_o = 0.72 if tgt_o > o_prev else 0.5  # the jaw opens faster than it closes
        o_prev += (tgt_o - o_prev) * k_o
        r_prev += (tgt_r * gate - r_prev) * 0.6
        open_.append(round(o_prev, 3))
        round_.append(round(r_prev, 3))
        energy.append(round(loud, 3))
    return open_, round_, energy


def srt_time(frame, fps):
    ms = round(frame * 1000 / fps)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    sp = json.load(open(os.path.join(ROOT, "production", "screenplay.json"), encoding="utf-8"))
    phon = json.load(open(os.path.join(ROOT, "production", "phonemes.json"), encoding="utf-8"))["lines"]
    fps = sp["fps"]
    by_id = {l["id"]: l for l in sp["lines"]}
    warnings = []

    measured = {}
    for lid, l in by_id.items():
        words, counts = phoneme_words(lid, phon)
        path = os.path.join(VOICE_DIR, f"{lid}.wav")
        if os.path.exists(path) and not ESTIMATE:
            x, sr = read_wav(path)
            db, hop_s = envelope_db(x, sr)
            dur = len(x) / sr
            al_path = os.path.join(ALIGN_DIR, f"{lid}.align.json")
            al = json.load(open(al_path, encoding="utf-8")) if os.path.exists(al_path) else None
            if al and al.get("sha1") == sha1(path) and len(al.get("words", [])) == len(words):
                phones = al["phones"]
                times = [(w["start"], w["end"]) for w in al["words"]]
                source = f"phonemes:{al.get('source', 'alignment')}"
            else:
                if al:
                    warnings.append(f"{lid}: alignment does not belong to this WAV (replaced recording?) — timed from its speech energy")
                phones, times = phones_from_energy(words, db, hop_s)
                source = "energy"
            measured[lid] = dict(dur=dur, db=db, hop_s=hop_s, phones=phones, times=times, words=words, counts=counts, source=source, recorded=True)
        else:
            if not ESTIMATE:
                warnings.append(f"{lid}: no recording at public/audio/voice/{lid}.wav — length estimated")
            syl = sum(1 for w in words for s in ipa_symbols(w) if s in VOWELS)
            dur = syl / 5.6 + 0.2 + sum(p.get("pause", 0.0) for p in phon[lid]["phrases"])
            db = np.full(int(dur / 0.005), -20.0)
            phones, times = phones_from_energy(words, db, 0.005)
            measured[lid] = dict(dur=dur, db=db, hop_s=0.005, phones=phones, times=times, words=words, counts=counts, source="estimated", recorded=False)

    cursor = 0
    scenes, lines, holds = [], [], {}

    def place(lid, start):
        m = measured[lid]
        l = by_id[lid]
        n_frames = int(math.ceil(m["dur"] * fps))
        o, r, e = lip_track(m["phones"], m["db"], m["hop_s"], n_frames, fps)
        display_words = l["displayText"].split()
        labels = display_words if len(display_words) == len(m["words"]) else m["words"]
        if len(display_words) != len(m["words"]) and l.get("subtitle", True):
            warnings.append(f"{lid}: {len(display_words)} written words vs {len(m['words'])} spoken — subtitle words timed proportionally")
        counts = l.get("phraseWords") or ([len(m["words"])] if len(l["phrases"]) == 1 else m["counts"])
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
            "words": [{"w": lab, "ph": ph, "from": start + int(a * fps), "to": start + int(math.ceil(b * fps))} for lab, ph, (a, b) in zip(labels, m["words"], m["times"])],
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
                    end = place(ins["line"], h_from + ins["at"])
                    if end > h_from + ev["frames"]:
                        warnings.append(f"{ins['line']} runs {end - h_from - ev['frames']} frames past the end of hold '{ev['hold']}'")
                cursor += ev["frames"]
                holds[ev["hold"]] = {"from": h_from, "to": cursor}
        cursor += sc.get("tail", 0)
        scenes.append({"id": sc["id"], "titleFa": sc["titleFa"], "from": s_from, "to": cursor})

    lines.sort(key=lambda l: l["from"])
    for a, b in zip(lines[:-1], lines[1:]):
        if b["from"] < a["to"]:
            warnings.append(f"{a['id']} and {b['id']} overlap by {a['to'] - b['from']} frames")
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
    with open(os.path.join(SUB_DIR, "dialogue-fa.srt"), "w", encoding="utf-8", newline="\n") as f:
        for c in cues:
            # U+202B / U+202C keep the Persian line right-to-left in players that ignore language tags
            f.write(f"{c['id']}\n{srt_time(c['from'], fps)} --> {srt_time(c['to'], fps)}\n‫{c['text']}‬\n\n")
    with open(os.path.join(SUB_DIR, "dialogue-fa.json"), "w", encoding="utf-8") as f:
        json.dump({"fps": fps, "language": "fa", "direction": "rtl", "cues": cues}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"timeline: {cursor} frames = {cursor / fps:.2f} s @ {fps} fps  |  all lines recorded: {timeline['allRecorded']}")
    for s in scenes:
        print(f"  scene {s['id']:<9} {s['from']:>5} – {s['to']:<5} ({(s['to'] - s['from']) / fps:5.2f} s)")
    for l in lines:
        print(f"  {l['id']} {l['speaker']:<9} {l['from']:>5} – {l['to']:<5} {l['seconds']:5.2f} s  lip:{l['lipSource']:<20} {l['speech']}")
    for k, h in holds.items():
        print(f"  hold {k:<10} {h['from']:>5} – {h['to']:<5}")
    for w in warnings:
        print("  !", w)
    return 1 if any("overlap" in w or "past the end" in w for w in warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
