#!/usr/bin/env python3
"""
3RAMIC — objective checks on candidate voice takes.

For every production/takes/<line>/<take>.wav this measures what can be measured without
ears, and writes the result next to the take (<take>.analysis.json):

  * transcript     Whisper large-v3-turbo (MIT), Persian. Compared with the intended
                   words: `match` is the similarity of the two normalised strings.
  * word timing    Whisper word timestamps (used later for subtitles and mouth shapes).
  * voice          median pitch (Hz), pitch spread (semitones), brightness (spectral
                   centroid) and a 20-band average spectrum used to compare voices.
  * sanity         duration, peak, share of silence, speaking rate.

It does NOT judge acting. A good `match` means the words are intelligible to a speech
recogniser; whether the delivery is funny or warm still needs a human listener.

    python scripts/audio/voice_analyze.py [--lines L01,L04] [--whisper /path/to/whisper-large-v3-turbo]
"""
import argparse
import difflib
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
TAKES = os.path.join(ROOT, "production", "takes")


def normalise(text):
    """Fold spelling variants so «دیگه‌س» and «دیگه ست» compare fairly."""
    t = text.replace("سه‌رامیک", "سرامیک").replace("سه رامیک", "سرامیک")  # the brand is spoken se-râ-mik either way
    t = re.sub(r"[ً-ْٰـ]", "", t)  # diacritics, tatweel
    t = t.replace("ي", "ی").replace("ك", "ک").replace("ۀ", "ه").replace("ة", "ه").replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    t = t.replace("‌", "").replace("‍", "")
    t = re.sub(r"[^؀-ۿa-zA-Z0-9 ]", " ", t)
    t = re.sub(r"[۰-۹]", lambda m: str("۰۱۲۳۴۵۶۷۸۹".index(m.group())), t)
    return re.sub(r"\s+", " ", t).strip()


def similarity(a, b):
    a, b = normalise(a).replace(" ", ""), normalise(b).replace(" ", "")
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def pitch_track(x, sr, fmin=60.0, fmax=420.0):
    """Autocorrelation pitch per 32 ms frame; returns voiced F0 values in Hz."""
    win, hop = int(0.032 * sr), int(0.010 * sr)
    lo, hi = int(sr / fmax), int(sr / fmin)
    f0 = []
    peak = np.max(np.abs(x)) + 1e-9
    for s in range(0, len(x) - win, hop):
        seg = x[s:s + win]
        if np.sqrt(np.mean(seg * seg)) < 0.03 * peak:
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, mode="full")[win - 1:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.42:
            f0.append(sr / k)
    return np.array(f0)


def band_profile(x, sr, bands=20):
    """Average log-spectrum in 20 bands from 100 Hz to 7 kHz: a crude voice fingerprint."""
    n = 1024
    hop = 256
    w = np.hanning(n)
    spec = []
    for s in range(0, len(x) - n, hop):
        spec.append(np.abs(np.fft.rfft(x[s:s + n] * w)) ** 2)
    if not spec:
        return [0.0] * bands, 0.0
    S = np.mean(spec, axis=0)
    f = np.fft.rfftfreq(n, 1 / sr)
    edges = np.geomspace(100, 7000, bands + 1)
    prof = [10 * np.log10(S[(f >= a) & (f < b)].mean() + 1e-12) for a, b in zip(edges[:-1], edges[1:])]
    prof = np.array(prof) - np.mean(prof)
    centroid = float((f * S).sum() / (S.sum() + 1e-12))
    return [round(float(v), 2) for v in prof], centroid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--whisper", default=os.environ.get("WHISPER_DIR", "/home/user/models/whisper"))
    ap.add_argument("--lines")
    ap.add_argument("--redo", action="store_true")
    ap.add_argument("--threads", type=int, default=os.cpu_count() or 4)
    args = ap.parse_args()
    torch.set_num_threads(args.threads)

    from transformers import pipeline
    import torchaudio

    asr = pipeline("automatic-speech-recognition", model=args.whisper, dtype=torch.float32, device="cpu")
    want = set(args.lines.split(",")) if args.lines else None
    rows = []
    for lid in sorted(os.listdir(TAKES)):
        if want and lid not in want:
            continue
        d = os.path.join(TAKES, lid)
        for name in sorted(os.listdir(d)):
            if not name.endswith(".wav"):
                continue
            base = os.path.join(d, name[:-4])
            meta = json.load(open(base + ".json", encoding="utf-8"))
            out_path = base + ".analysis.json"
            if os.path.exists(out_path) and not args.redo:
                rows.append(json.load(open(out_path, encoding="utf-8")))
                continue
            x, sr = sf.read(base + ".wav", dtype="float32", always_2d=True)
            x = x.mean(axis=1)
            x16 = torchaudio.functional.resample(torch.from_numpy(x), sr, 16000).numpy()
            res = asr({"raw": x16, "sampling_rate": 16000}, return_timestamps="word", generate_kwargs={"language": "fa", "task": "transcribe"})
            heard = res["text"].strip()
            words = [{"w": c["text"].strip(), "start": c["timestamp"][0], "end": c["timestamp"][1]} for c in res.get("chunks", []) if c["timestamp"][0] is not None]
            f0 = pitch_track(x, sr)
            prof, centroid = band_profile(x, sr)
            dur = len(x) / sr
            win = int(0.02 * sr)
            n = len(x) // win
            e = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
            silence = float(np.mean(20 * np.log10(e / (e.max() + 1e-9) + 1e-9) < -35))
            row = {
                "line": lid, "take": name[:-4], "speaker": meta.get("speaker"), "text": meta["text"], "heard": heard,
                "match": round(similarity(meta["text"], heard), 3), "seconds": round(dur, 2), "ended": bool(meta.get("ended")),
                "f0": round(float(np.median(f0)), 1) if len(f0) else 0.0,
                "f0_spread_st": round(float(np.std(12 * np.log2(f0 / np.median(f0)))), 2) if len(f0) > 5 else 0.0,
                "voiced_frames": int(len(f0)), "centroid": round(centroid), "silence": round(silence, 2),
                "peak": round(float(np.max(np.abs(x))), 3), "profile": prof, "words": words, "seeded": bool(meta.get("seeded")),
            }
            json.dump(row, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
            rows.append(row)
            print(f"{lid} {name[:-4]:<7} {row['seconds']:5.2f}s  f0 {row['f0']:6.1f} Hz ±{row['f0_spread_st']:4.2f}st  bright {row['centroid']:5d}  match {row['match']:.2f}  | {heard}", flush=True)
    print(f"analysed {len(rows)} takes")


if __name__ == "__main__":
    sys.exit(main())
