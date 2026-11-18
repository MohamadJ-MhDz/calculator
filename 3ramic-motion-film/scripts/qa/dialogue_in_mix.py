#!/usr/bin/env python3
"""
3RAMIC — intelligibility of the dialogue inside the finished mix (music, effects and all).

Cuts the mix (public/audio/mix.wav, or the audio of a rendered MP4 decoded to WAV) into
scenes, has Whisper large-v3-turbo transcribe each one in Persian, and compares the result
with the scene's spoken lines. Writes production/qa/dialogue-in-mix.json.

    python scripts/qa/dialogue_in_mix.py [--wav path] [--whisper /path/to/whisper-large-v3-turbo]

Needs: torch, transformers, soundfile, numpy (the same environment as voice_analyze.py).
It checks that words can be recognised through the mix. It does not judge acting.
"""
import argparse
import json
import os
import sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "audio"))
from voice_analyze import similarity  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", default=os.path.join(ROOT, "public", "audio", "mix.wav"))
    ap.add_argument("--whisper", default=os.environ.get("WHISPER_DIR", "/home/user/models/whisper"))
    ap.add_argument("--label", default="mix.wav")
    args = ap.parse_args()
    from transformers import pipeline
    import torchaudio

    torch.set_num_threads(os.cpu_count() or 4)
    asr = pipeline("automatic-speech-recognition", model=args.whisper, dtype=torch.float32, device="cpu")
    tl = json.load(open(os.path.join(ROOT, "src", "data", "timeline.json"), encoding="utf-8"))
    x, sr = sf.read(args.wav, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    rows = []
    for sc in tl["scenes"]:
        lines = [l for l in tl["lines"] if sc["from"] <= l["from"] < sc["to"]]
        a, b = int(sc["from"] / tl["fps"] * sr), int(sc["to"] / tl["fps"] * sr)
        seg = torchaudio.functional.resample(torch.from_numpy(x[a:b].copy()), sr, 16000).numpy()
        heard = asr({"raw": seg, "sampling_rate": 16000}, generate_kwargs={"language": "fa", "task": "transcribe"})["text"].strip()
        want = " ".join(l["speech"] for l in lines)
        m = similarity(want, heard)
        rows.append({"scene": sc["id"], "expected": want, "heard": heard, "match": round(m, 3)})
        print(f"{sc['id']:<9} match {m:.2f}\n   expected: {want}\n   heard:    {heard}", flush=True)
    mean = sum(r["match"] for r in rows) / len(rows)
    out = {"source": args.label, "model": "openai/whisper-large-v3-turbo", "meanMatch": round(mean, 3), "scenes": rows,
           "note": "Whole-scene transcription of the finished mix. Measures intelligibility through music and effects; it does not measure acting quality."}
    os.makedirs(os.path.join(ROOT, "production", "qa"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "production", "qa", "dialogue-in-mix.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"mean match {mean:.3f}")


if __name__ == "__main__":
    main()
