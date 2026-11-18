#!/usr/bin/env python3
"""
3RAMIC — dialogue synthesis (offline, free, runs on a laptop CPU).

Needs only:  pip install numpy onnxruntime onnx

    python scripts/audio/voice_synthesize.py --setup            # download the voice models once (~450 MB)
    python scripts/audio/voice_synthesize.py --takes 6          # several takes of every line with the cast voices
    python scripts/audio/voice_synthesize.py --audition         # every candidate voice on every line of its role
    python scripts/audio/voice_synthesize.py --lines L01,L15

What it does
  * Reads the exact phonemes of each line from production/phonemes.json and the cast from
    production/cast.json, and feeds the phonemes straight to the voice models — no
    text front-end guesses a pronunciation. The brand is always se-râ-mik.
  * Two engines, both open models trained on public-domain (CC0) Persian recordings:
      piper   VITS voices (rhasspy/piper-voices, MahtaFetrat/Mana-Persian-Piper)
      matcha  Matcha-TTS voices (mah92) + the BSC-LT Vocos vocoder
  * The models are patched to also return how long each phoneme lasts, so every take
    comes with an exact phoneme and word timeline (used for subtitles and mouth shapes).
  * Writes 48 kHz mono WAV takes to production/takes/<line>/ with a JSON side-car.
    scripts/audio/voice_analyze.py then checks every take by transcription and
    scripts/audio/voice_select.py copies the chosen ones into public/audio/voice/.

What it does not do: act. These are neutral reading voices. Rate, pauses and the models'
own intonation variability are set per line from the acting notes, and several takes are
generated so the liveliest correct one can be chosen — that is the extent of the
"performance". For a release with real comic timing, record actors against
production/acting-direction.fa.md and drop the WAVs into public/audio/voice/.
"""
import argparse
import json
import os
import sys
import urllib.request
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MODELS = os.environ.get("VOICE_MODELS", os.path.join(ROOT, "voice-models"))
OUT_SR = 48000
HOP = 256
MODEL_SR = 22050

SKIP = set("ˈˌ")  # stress marks: fed to the model, not phonemes themselves
PUNCT = set(".,!?;:")


def aligned_path(path):
    return path[:-5] + "-aligned.onnx"


# ----------------------------------------------------------------------------- setup
def setup(cast):
    import onnx

    def fetch(repo, path, dest):
        if os.path.exists(dest):
            return
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        url = f"https://huggingface.co/{repo}/resolve/main/{path}"
        print("  download", url)
        urllib.request.urlretrieve(url, dest + ".part")
        os.replace(dest + ".part", dest)

    def patch(src, tensor):
        dst = aligned_path(src)
        if os.path.exists(dst):
            return
        m = onnx.load(src)
        names = [o for n in m.graph.node if n.op_type == "Ceil" for o in n.output]
        name = tensor if tensor in names else names[0]
        vi = onnx.helper.ValueInfoProto()
        vi.name = name
        m.graph.output.append(vi)
        onnx.save(m, dst)
        print("  patched", os.path.relpath(dst, MODELS), "(+ duration output", name + ")")

    for name, m in cast["models"].items():
        dest = os.path.join(MODELS, m["file"])
        fetch(m["repo"], m["path"], dest)
        if m["engine"] == "piper":
            fetch(m["repo"], m["path"] + ".json", dest + ".json")
        else:
            fetch(m["repo"], m["tokensPath"], os.path.join(MODELS, m["tokens"]))
        patch(dest, "/Ceil_output_0")
    v = cast["vocoder"]
    fetch(v["repo"], v["path"], os.path.join(MODELS, v["file"]))
    print("voice models ready in", MODELS)


# ----------------------------------------------------------------------------- dsp
def istft(spec, n_fft=1024, hop=HOP):
    """Inverse STFT (periodic Hann, centred) — spec is [bins, frames] complex."""
    win = np.hanning(n_fft + 1)[:-1]
    frames = spec.shape[1]
    n = n_fft + hop * (frames - 1)
    y = np.zeros(n)
    wsum = np.zeros(n)
    seg = np.fft.irfft(spec, n=n_fft, axis=0) * win[:, None]
    for t in range(frames):
        y[t * hop:t * hop + n_fft] += seg[:, t]
        wsum[t * hop:t * hop + n_fft] += win * win
    y /= np.maximum(wsum, 1e-8)
    return y[n_fft // 2: n - n_fft // 2]


def resample(x, sr_in, sr_out, taps=24):
    """Band-limited (windowed-sinc) resampling."""
    if sr_in == sr_out:
        return x
    ratio = sr_out / sr_in
    cutoff = min(1.0, ratio)
    n_out = int(len(x) * ratio)
    t = np.arange(n_out) / ratio
    i0 = np.floor(t).astype(np.int64)
    frac = t - i0
    k = np.arange(-taps + 1, taps + 1)
    idx = i0[:, None] + k[None, :]
    u = (k[None, :] - frac[:, None])
    w = cutoff * np.sinc(cutoff * u) * (0.42 + 0.5 * np.cos(np.pi * u / taps) + 0.08 * np.cos(2 * np.pi * u / taps))
    w[np.abs(u) > taps] = 0
    xp = np.concatenate([np.zeros(taps), x, np.zeros(taps + 2)])
    return (xp[np.clip(idx + taps, 0, len(xp) - 1)] * w).sum(axis=1)


def active_rms(x, sr):
    win = int(0.02 * sr)
    n = len(x) // win
    if n < 2:
        return float(np.sqrt(np.mean(x * x) + 1e-12))
    e = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    act = e[e > e.max() * 10 ** (-35 / 20)]
    return float(np.sqrt(np.mean(act * act)))


def write_wav(path, x, sr):
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data.tobytes())


# ----------------------------------------------------------------------------- engines
class Piper:
    def __init__(self, path, threads):
        import onnxruntime as ort

        cfg = json.load(open(path + ".json", encoding="utf-8"))
        self.ids = cfg["phoneme_id_map"]
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(aligned_path(path), so, providers=["CPUExecutionProvider"])
        self.noise_w = cfg.get("inference", {}).get("noise_w", 0.8)

    def run(self, symbols, length, noise):
        """symbols: list of single characters. Returns (audio@22050, seconds per symbol, lead-in seconds)."""
        seq = list(self.ids["^"]) + [0]
        owner = [-1] * len(seq)
        for n, s in enumerate(symbols):
            if s not in self.ids:
                continue
            for i in self.ids[s]:
                seq += [i, 0]
                owner += [n, n]
        seq += list(self.ids["$"])
        owner += [-2]
        out = self.sess.run(None, {
            "input": np.array([seq], dtype=np.int64),
            "input_lengths": np.array([len(seq)], dtype=np.int64),
            "scales": np.array([noise, length, self.noise_w], dtype=np.float32),
        })
        audio = out[0].squeeze().astype(np.float64)
        samples = out[1].squeeze() * HOP
        dur = np.zeros(len(symbols))
        lead = 0.0
        for o, s in zip(owner, samples):
            if o >= 0:
                dur[o] += s / MODEL_SR
            elif o == -1:
                lead += s / MODEL_SR
        return audio, dur, lead


class Matcha:
    def __init__(self, path, tokens_path, vocoder, threads):
        import onnxruntime as ort

        self.ids = {}
        for line in open(tokens_path, encoding="utf-8"):
            line = line.rstrip("\n")
            if line:
                sym, idx = line.rsplit(" ", 1)
                self.ids[sym] = int(idx)
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(aligned_path(path), so, providers=["CPUExecutionProvider"])
        self.voc = vocoder

    def run(self, symbols, length, noise):
        seq = [0]
        owner = [-1]
        for n, s in enumerate(symbols):
            if s not in self.ids:
                continue
            seq += [self.ids[s], 0]
            owner += [n, n]
        mel, _, w = self.sess.run(None, {
            "x": np.array([seq], dtype=np.int64),
            "x_lengths": np.array([len(seq)], dtype=np.int64),
            "scales": np.array([noise, length], dtype=np.float32),
        })
        mag, re, im = self.voc.run(None, {"mels": mel})
        audio = istft((mag * re + 1j * mag * im)[0])
        frames = w.squeeze() * length
        dur = np.zeros(len(symbols))
        lead = 0.0
        for o, fr in zip(owner, frames):
            if o >= 0:
                dur[o] += fr * HOP / MODEL_SR
            else:
                lead += fr * HOP / MODEL_SR
        return audio, dur, lead


_engines = {}
_vocoder = None


def engine(cast, name, threads):
    global _vocoder
    if name in _engines:
        return _engines[name]
    m = cast["models"][name]
    path = os.path.join(MODELS, m["file"])
    if not os.path.exists(aligned_path(path)):
        raise SystemExit(f"voice model missing: {aligned_path(path)}\nrun:  python scripts/audio/voice_synthesize.py --setup")
    if m["engine"] == "piper":
        e = Piper(path, threads)
    else:
        if _vocoder is None:
            import onnxruntime as ort

            so = ort.SessionOptions()
            so.intra_op_num_threads = threads
            _vocoder = ort.InferenceSession(os.path.join(MODELS, cast["vocoder"]["file"]), so, providers=["CPUExecutionProvider"])
        e = Matcha(path, os.path.join(MODELS, m["tokens"]), _vocoder, threads)
    _engines[name] = e
    return e


# ----------------------------------------------------------------------------- one take
def synth_line(cast, model_name, spec, base_length, threads, noise_jitter=0.0):
    """Returns (audio@48k, meta) for one line (all its phrases, with pauses)."""
    eng = engine(cast, model_name, threads)
    rate = spec.get("rate", 1.0)
    noise = spec.get("noise", 0.667) + noise_jitter
    chunks, phones, words = [], [], []
    cursor = 0.0  # seconds, at 48 kHz timeline
    word_index = 0
    for ph in spec["phrases"]:
        text = ph["ph"]
        symbols = list(text.replace("+", " "))
        joins = [c == "+" for c in text]  # a '+' is a spoken space that does not start a new written word
        audio, dur, lead = eng.run(symbols, base_length / (rate * ph.get("rate", 1.0)), noise)
        dur = np.asarray(dur, dtype=np.float64)
        lead = float(lead)
        # trim the model's lead-in and tail to short, fixed pads
        t = lead
        starts = []
        for d in dur:
            starts.append(t)
            t += d
        spoken = [i for i, s in enumerate(symbols) if s not in PUNCT and s != " " and dur[i] > 0]
        if not spoken:
            continue
        a = max(0.0, starts[spoken[0]] - 0.02)
        b = min(len(audio) / MODEL_SR, starts[spoken[-1]] + dur[spoken[-1]] + 0.06)
        seg = audio[int(a * MODEL_SR):int(b * MODEL_SR)].copy()
        f = int(0.006 * MODEL_SR)
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        seg = resample(seg, MODEL_SR, OUT_SR)
        off = cursor - a
        # phones and words on the line's own clock
        w_start, w_end, w_syms = None, None, ""
        for i, s in enumerate(symbols):
            is_space = s == " "
            if is_space or i == len(symbols) - 1:
                if not is_space and s not in PUNCT and dur[i] > 0:
                    w_syms += s
                    w_start = starts[i] if w_start is None else w_start
                    w_end = starts[i] + dur[i]
                if is_space and joins[i]:
                    continue  # same written word carries on
                if w_start is not None:
                    words.append({"i": word_index, "ph": w_syms, "start": round(w_start + off, 4), "end": round(w_end + off, 4)})
                    word_index += 1
                w_start, w_end, w_syms = None, None, ""
                continue
            if s in PUNCT or dur[i] <= 0:
                continue
            w_syms += s
            w_start = starts[i] if w_start is None else w_start
            w_end = starts[i] + dur[i]
            if s in SKIP:
                continue
            if s in "ː1" and phones:
                phones[-1]["end"] = round(starts[i] + dur[i] + off, 4)  # length mark / 'q1' belong to the previous phoneme
                continue
            phones.append({"p": s, "start": round(starts[i] + off, 4), "end": round(starts[i] + dur[i] + off, 4)})
        chunks.append(seg)
        cursor += len(seg) / OUT_SR
        pause = ph.get("pause", 0.0)
        if pause:
            chunks.append(np.zeros(int(pause * OUT_SR)))
            cursor += pause
    x = np.concatenate(chunks)
    gain = 10 ** (-21 / 20) / max(active_rms(x, OUT_SR), 1e-6)
    x = x * gain
    peak = np.max(np.abs(x))
    if peak > 0.89:
        x = x * (0.89 / peak)
    return x, {"model": model_name, "seconds": round(len(x) / OUT_SR, 3), "phones": phones, "words": words, "rate": rate, "noise": round(noise, 3)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--setup", action="store_true")
    ap.add_argument("--audition", action="store_true")
    ap.add_argument("--lines")
    ap.add_argument("--takes", type=int, default=4)
    ap.add_argument("--threads", type=int, default=min(4, os.cpu_count() or 2))
    args = ap.parse_args()

    cast = json.load(open(os.path.join(ROOT, "production", "cast.json"), encoding="utf-8"))
    if args.setup:
        return setup(cast)
    sp = json.load(open(os.path.join(ROOT, "production", "screenplay.json"), encoding="utf-8"))
    phon = json.load(open(os.path.join(ROOT, "production", "phonemes.json"), encoding="utf-8"))["lines"]
    want = set(args.lines.split(",")) if args.lines else None
    n = 0
    for l in sp["lines"]:
        if want and l["id"] not in want:
            continue
        voice = cast["voices"][l["speaker"]]
        models = voice["candidates"] if args.audition else [voice["model"]]
        out_dir = os.path.join(ROOT, "production", "takes", l["id"])
        os.makedirs(out_dir, exist_ok=True)
        for m in models:
            base = cast["models"][m]["length"] * (voice["length"] / cast["models"][voice["model"]]["length"] if m == voice["model"] else 1.0)
            for k in range(1 if args.audition else args.takes):
                name = f"{m}-a" if args.audition else f"{m}-t{k}"
                # takes differ by the models' own sampling noise; later takes also vary the liveliness a little
                x, meta = synth_line(cast, m, phon[l["id"]], base, args.threads, noise_jitter=0.0 if args.audition else (k % 3 - 1) * 0.08)
                write_wav(os.path.join(out_dir, name + ".wav"), x, OUT_SR)
                meta.update(line=l["id"], speaker=l["speaker"], text=l["speechText"], take=name, ended=True, seeded=False)
                json.dump(meta, open(os.path.join(out_dir, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
                n += 1
        print(f"{l['id']} {l['speaker']:<9} {len(models) * (1 if args.audition else args.takes)} takes", flush=True)
    print(f"wrote {n} takes to production/takes/")


if __name__ == "__main__":
    sys.exit(main())
