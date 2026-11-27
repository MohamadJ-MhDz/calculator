#!/usr/bin/env python3
"""
3RAMIC — intonation shaping for the synthetic voices (WORLD vocoder, local, free).

The open TTS voices read every line like a statement: pitch falls at the end, the range is
narrow, and a character's pitch drifts from line to line. This script re-shapes only the pitch
contour of a recording, with settings from production/prosody.json:

  * one steady pitch per character   ("targetHz": the line's median is moved there, ≤ ±4 semitones)
  * livelier delivery                ("range": deviations from the median are scaled, e.g. 1.4)
  * questions that rise              ("endRise": semitones added over the last voiced stretch)
  * a lift for shouted lines         ("lift": semitones added to the whole line)

Optional "tempo" speeds a character up or down without changing pitch; voice_select.py scales the
phoneme timing by the same factor, so lip-sync and subtitles stay exact.

    python scripts/audio/voice_prosody.py in.wav out.wav --speaker tile --line L01

Needs: numpy, soundfile, pyworld  (pip install pyworld)
"""
import argparse
import json
import os

import numpy as np
import pyworld as pw
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
PERIOD = 5.0  # ms


def settings(speaker, line):
    cfg = json.load(open(os.path.join(ROOT, "production", "prosody.json"), encoding="utf-8"))
    s = dict(cfg["characters"].get(speaker, {}))
    s.update(cfg["lines"].get(line, {}))
    return s


def active_rms(x, sr):
    win = int(0.02 * sr)
    n = len(x) // win
    if n < 2:
        return float(np.sqrt(np.mean(x * x) + 1e-12))
    e = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    act = e[e > e.max() * 10 ** (-35 / 20)]
    return float(np.sqrt(np.mean(act * act)))


def shape(x, sr, s, end_from=None):
    """end_from: start (s) of the line's last word, for question rises."""
    x = x.astype(np.float64)
    f0, t = pw.harvest(x, sr, f0_floor=55.0, f0_ceil=500.0, frame_period=PERIOD)
    sp = pw.cheaptrick(x, f0, t, sr)
    ap = pw.d4c(x, f0, t, sr)
    voiced = f0 > 0
    if voiced.sum() < 5:
        return x, {}
    st = np.zeros_like(f0)
    st[voiced] = 12 * np.log2(f0[voiced])
    med = float(np.median(st[voiced]))
    new = st.copy()
    # livelier: scale the movement around the median
    new[voiced] = med + (st[voiced] - med) * s.get("range", 1.0)
    # one steady pitch per character
    shift = 0.0
    if s.get("targetHz"):
        shift = float(np.clip(12 * np.log2(s["targetHz"]) - med, -4.0, 4.0))
    shift += s.get("lift", 0.0)
    new[voiced] += shift
    # question rise: over the final word the natural fall is replaced by a rising line that starts
    # at the word's own opening pitch (blended in over 60 ms, so there is no jump)
    rise = s.get("endRise", 0.0)
    if rise:
        idx = np.flatnonzero(voiced)
        last = idx[-1]
        if end_from is not None:
            first = int(end_from * 1000 / PERIOD)
        else:
            first = last - int(s.get("endDur", 0.32) * 1000 / PERIOD)
        first = int(np.clip(first, idx[0], last - 2))
        near = idx[(idx >= first) & (idx <= first + 8)]
        base = float(np.median(new[near])) if len(near) else float(np.median(new[voiced]))
        n = np.arange(len(f0))
        ramp = np.clip((n - first) / max(1, last - first), 0, 1)
        target = base + rise * ramp ** 1.3
        blend = np.clip((n - first) / (60 / PERIOD), 0, 1)
        zone = voiced & (n >= first)
        new[zone] = (1 - blend[zone]) * new[zone] + blend[zone] * target[zone]
    f0n = np.zeros_like(f0)
    f0n[voiced] = 2 ** (new[voiced] / 12)
    # tempo: pick analysis frames at a faster/slower rate (pitch and timbre unchanged)
    tempo = float(s.get("tempo", 1.0))
    n_out = len(x)
    if abs(tempo - 1.0) > 1e-3:
        m = int(round(len(f0n) / tempo))
        pick = np.clip(np.round(np.linspace(0, len(f0n) - 1, m)).astype(int), 0, len(f0n) - 1)
        f0n, sp, ap = f0n[pick], np.ascontiguousarray(sp[pick]), np.ascontiguousarray(ap[pick])
        n_out = int(round(len(x) / tempo))
    y = pw.synthesize(f0n, sp, ap, sr, frame_period=PERIOD)
    y = y[:n_out] if len(y) >= n_out else np.concatenate([y, np.zeros(n_out - len(y))])
    # same loudness as before
    y *= active_rms(x, sr) / max(active_rms(y, sr), 1e-9)
    peak = np.max(np.abs(y))
    if peak > 0.89:
        y *= 0.89 / peak
    return y, {"medianHz": round(2 ** (med / 12), 1), "shiftSt": round(shift, 2), "range": s.get("range", 1.0), "endRiseSt": rise, "tempo": tempo}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--speaker", required=True)
    ap.add_argument("--line", required=True)
    ap.add_argument("--last-word-start", type=float, default=None)
    a = ap.parse_args()
    x, sr = sf.read(a.src, dtype="float64")
    if x.ndim > 1:
        x = x.mean(axis=1)
    y, info = shape(x, sr, settings(a.speaker, a.line), a.last_word_start)
    sf.write(a.dst, y, sr, subtype="PCM_16")
    print(a.line, info)


if __name__ == "__main__":
    main()
