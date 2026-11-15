#!/usr/bin/env python3
"""
3RAMIC — dialogue synthesis with Aava (Persian Orpheus-3B, Apache-2.0) + SNAC (MIT).

Runs fully offline on a CPU once the two model folders are on disk:

    AAVA_DIR   KEYHAN-A/aava-tts-persian-3b      (config, tokenizer, 2 safetensors shards)
    SNAC_DIR   hubertsiuzdak/snac_24khz          (config.json, pytorch_model.bin)

It writes candidate takes to production/takes/<line>/<take>.wav with a JSON side-car.
Nothing here decides which take is used: scripts/audio/voice_select.py scores the takes
(transcript check, length, voice consistency) and copies the chosen ones to
public/audio/voice/.

    python scripts/audio/voice_generate.py --lines L01,L03 --takes 4
    python scripts/audio/voice_generate.py --text "سلام" --out /tmp/test.wav

A character keeps one voice across its lines by *in-context prompting*: a previously
generated take of that character (its "voice seed", itself synthetic) is placed in
front of the new line, so the model continues in the same voice. No recording of a
real person is used as a reference.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))

SOH, EOT, EOH, SOA, SOS, EOS, EOA = 128259, 128009, 128260, 128261, 128257, 128258, 128262
AUDIO0 = 128266  # first audio code; 7 codebook slots of 4096 follow
SR = 24000
TOKENS_PER_SECOND = 7 * SR / 2048  # 7 tokens per 2048-sample SNAC frame ≈ 82


def load(aava_dir, snac_dir, threads):
    from snac import SNAC
    from transformers import AutoModelForCausalLM, AutoTokenizer

    torch.set_num_threads(threads)
    t0 = time.time()
    tok = AutoTokenizer.from_pretrained(aava_dir)
    model = AutoModelForCausalLM.from_pretrained(aava_dir, dtype=torch.bfloat16, low_cpu_mem_usage=True)
    model.eval()
    snac = SNAC.from_pretrained(snac_dir).eval()
    print(f"[load] model + codec ready in {time.time() - t0:.1f}s, {threads} threads", flush=True)
    return tok, model, snac


def text_block(tok, text, voice="aava"):
    ids = tok(f"{voice}: {text}", add_special_tokens=True).input_ids
    return [SOH] + ids + [EOT, EOH]


def codes_to_tokens(codes):
    """SNAC codes (3 layers at 12/24/48 Hz) -> Orpheus token stream (7 per frame)."""
    l1, l2, l3 = [c[0].tolist() for c in codes]
    out = []
    for i in range(len(l1)):
        out += [
            AUDIO0 + l1[i],
            AUDIO0 + 4096 + l2[2 * i],
            AUDIO0 + 2 * 4096 + l3[4 * i],
            AUDIO0 + 3 * 4096 + l3[4 * i + 1],
            AUDIO0 + 4 * 4096 + l2[2 * i + 1],
            AUDIO0 + 5 * 4096 + l3[4 * i + 2],
            AUDIO0 + 6 * 4096 + l3[4 * i + 3],
        ]
    return out


def tokens_to_codes(tokens):
    toks = [t for t in tokens if AUDIO0 <= t < AUDIO0 + 7 * 4096]
    n = len(toks) // 7
    l1, l2, l3 = [], [], []
    bad = 0
    for i in range(n):
        f = [toks[7 * i + k] - AUDIO0 - k * 4096 for k in range(7)]
        if any(v < 0 or v >= 4096 for v in f):
            bad += 1
            continue
        l1.append(f[0])
        l2 += [f[1], f[4]]
        l3 += [f[2], f[3], f[5], f[6]]
    return [torch.tensor(l)[None] for l in (l1, l2, l3)], n, bad


@torch.no_grad()
def encode_reference(snac, wav_path):
    x, sr = sf.read(wav_path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        raise SystemExit(f"{wav_path}: reference must be {SR} Hz")
    codes = snac.encode(torch.from_numpy(x)[None, None])
    return codes_to_tokens(codes)


@torch.no_grad()
def synthesize(tok, model, snac, text, ref=None, seed=0, temperature=0.6, top_p=0.9, repetition_penalty=1.1, max_seconds=8.0):
    """ref = (ref_text, ref_audio_tokens) or None. Returns (audio float32, info)."""
    ids = []
    if ref is not None:
        ref_text, ref_tokens = ref
        ids += text_block(tok, ref_text) + [SOA, SOS] + ref_tokens + [EOS, EOA]
    ids += text_block(tok, text) + [SOA, SOS]
    inp = torch.tensor([ids])
    torch.manual_seed(seed)
    t0 = time.time()
    out = model.generate(
        input_ids=inp,
        attention_mask=torch.ones_like(inp),
        max_new_tokens=int(max_seconds * TOKENS_PER_SECOND),
        do_sample=True,
        temperature=temperature,
        top_p=top_p,
        repetition_penalty=repetition_penalty,
        eos_token_id=[EOS, EOA, 128001],
        pad_token_id=128004,
    )
    new = out[0, inp.shape[1]:].tolist()
    dt = time.time() - t0
    codes, frames, bad = tokens_to_codes(new)
    if frames - bad < 2:
        return np.zeros(0, dtype=np.float32), dict(tokens=len(new), frames=frames, bad=bad, seconds=0.0, gen_seconds=dt, ended=False)
    audio = snac.decode(codes)[0, 0].float().cpu().numpy()
    ended = len(new) > 0 and new[-1] in (EOS, EOA, 128001)
    return audio, dict(tokens=len(new), frames=frames, bad=bad, seconds=len(audio) / SR, gen_seconds=dt, tok_per_s=len(new) / max(dt, 1e-6), ended=ended)


def trim(audio, pad_s=0.03, floor_db=-42.0):
    """Cut leading/trailing silence, keep a short pad, fade the edges."""
    if len(audio) == 0:
        return audio
    win = int(0.01 * SR)
    n = len(audio) // win
    if n < 3:
        return audio
    e = np.sqrt(np.mean(audio[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(e + 1e-9)
    idx = np.flatnonzero(db > db.max() + floor_db)
    a = max(0, idx[0] * win - int(pad_s * SR))
    b = min(len(audio), (idx[-1] + 1) * win + int(pad_s * SR))
    y = audio[a:b].copy()
    f = min(len(y) // 2, int(0.008 * SR))
    if f > 0:
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aava", default=os.environ.get("AAVA_DIR", "/home/user/models/aava"))
    ap.add_argument("--snac", default=os.environ.get("SNAC_DIR", "/home/user/models/snac"))
    ap.add_argument("--threads", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--text", help="one-off synthesis of this text")
    ap.add_argument("--out", help="output wav for --text")
    ap.add_argument("--lines", help="comma-separated line ids from production/screenplay.json (default: all)")
    ap.add_argument("--takes", type=int, default=3)
    ap.add_argument("--seed0", type=int, default=1000)
    ap.add_argument("--temperature", type=float, default=0.6)
    ap.add_argument("--top-p", type=float, default=0.9)
    ap.add_argument("--rep", type=float, default=1.1)
    ap.add_argument("--no-seed-voice", action="store_true", help="ignore production/cast.json voice seeds")
    args = ap.parse_args()

    tok, model, snac = load(args.aava, args.snac, args.threads)

    if args.text:
        audio, info = synthesize(tok, model, snac, args.text, seed=args.seed0, temperature=args.temperature, top_p=args.top_p, repetition_penalty=args.rep)
        sf.write(args.out or "out.wav", trim(audio), SR, subtype="PCM_16")
        print(json.dumps(info), flush=True)
        return

    sp = json.load(open(os.path.join(ROOT, "production", "screenplay.json"), encoding="utf-8"))
    cast_path = os.path.join(ROOT, "production", "cast.json")
    cast = json.load(open(cast_path, encoding="utf-8")) if os.path.exists(cast_path) else {"voices": {}}
    want = set(args.lines.split(",")) if args.lines else None
    refs = {}
    for l in sp["lines"]:
        if want and l["id"] not in want:
            continue
        voice = cast.get("voices", {}).get(l["speaker"], {})
        ref = None
        seed_wav = voice.get("seedTake")
        if seed_wav and not args.no_seed_voice:
            if l["speaker"] not in refs:
                refs[l["speaker"]] = (voice["seedText"], encode_reference(snac, os.path.join(ROOT, seed_wav)))
            ref = refs[l["speaker"]]
        texts = l.get("speechVariants") or [l["speechText"]]
        out_dir = os.path.join(ROOT, "production", "takes", l["id"])
        os.makedirs(out_dir, exist_ok=True)
        for k in range(args.takes):
            seed = args.seed0 + k
            text = texts[k % len(texts)]
            name = f"s{seed}"
            wav_path = os.path.join(out_dir, name + ".wav")
            if os.path.exists(wav_path):
                continue
            est = 0.25 * len(text.split()) + 2.5
            audio, info = synthesize(
                tok, model, snac, text, ref=ref, seed=seed,
                temperature=voice.get("temperature", args.temperature), top_p=args.top_p,
                repetition_penalty=args.rep, max_seconds=max(4.0, est * 2),
            )
            audio = trim(audio)
            if len(audio) == 0:
                print(f"[{l['id']} {name}] EMPTY {info}", flush=True)
                continue
            sf.write(wav_path, audio, SR, subtype="PCM_16")
            info.update(line=l["id"], speaker=l["speaker"], text=text, seed=seed, seeded=bool(ref), seconds=len(audio) / SR)
            json.dump(info, open(os.path.join(out_dir, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
            print(f"[{l['id']} {name}] {info['seconds']:.2f}s audio, {info['tokens']} tok in {info['gen_seconds']:.0f}s ({info.get('tok_per_s', 0):.1f} tok/s) ended={info['ended']}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
