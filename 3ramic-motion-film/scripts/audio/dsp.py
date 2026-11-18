"""
3RAMIC — small numpy-only DSP toolkit used by build_audio.py (no scipy needed).

Filters are designed as standard RBJ biquads and applied exactly in the frequency domain
(zero-padded FFT, so the result equals causal IIR filtering of the padded signal).
Loudness follows ITU-R BS.1770-4 / EBU R128; true peak uses 4x band-limited oversampling.
"""
import wave

import numpy as np

SR = 48000


# ----------------------------------------------------------------------------- io
def read_wav(path):
    with wave.open(path, "rb") as w:
        sr, ch, n, sw = w.getframerate(), w.getnchannels(), w.getnframes(), w.getsampwidth()
        raw = w.readframes(n)
    if sw == 2:
        x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    elif sw == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float64) / (1 << 23)
    else:
        raise ValueError(f"{path}: unsupported sample width {sw}")
    x = x.reshape(-1, ch)
    return x, sr


def write_wav(path, x, sr=SR, bits=16, seed=7):
    """x: (n,) or (n, ch) float in [-1, 1]. 16-bit output gets TPDF dither."""
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    if x.ndim == 1:
        x = x[:, None]
    if bits == 16:
        rng = np.random.default_rng(seed)
        d = (rng.random(x.shape) - rng.random(x.shape)) / 32768.0
        data = np.clip(np.round((x + d) * 32767), -32768, 32767).astype("<i2").tobytes()
        width = 2
    else:
        v = np.clip(np.round(x * 8388607), -8388608, 8388607).astype(np.int32)
        b = np.stack([(v & 0xFF), (v >> 8) & 0xFF, (v >> 16) & 0xFF], axis=-1).astype(np.uint8)
        data = b.tobytes()
        width = 3
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(width)
        w.setframerate(sr)
        w.writeframes(data)


def resample(x, sr_in, sr_out, taps=32):
    if sr_in == sr_out:
        return x
    ratio = sr_out / sr_in
    cutoff = min(1.0, ratio)
    n_out = int(round(len(x) * ratio))
    t = np.arange(n_out) / ratio
    i0 = np.floor(t).astype(np.int64)
    frac = t - i0
    k = np.arange(-taps + 1, taps + 1)
    idx = i0[:, None] + k[None, :]
    u = k[None, :] - frac[:, None]
    w = cutoff * np.sinc(cutoff * u) * (0.42 + 0.5 * np.cos(np.pi * u / taps) + 0.08 * np.cos(2 * np.pi * u / taps))
    xp = np.concatenate([np.zeros(taps), x, np.zeros(taps + 2)])
    return (xp[np.clip(idx + taps, 0, len(xp) - 1)] * w).sum(axis=1)


# ----------------------------------------------------------------------------- filters
def biquad(kind, f0, q=0.707, gain_db=0.0, sr=SR):
    """RBJ audio-EQ-cookbook biquad: returns (b, a) normalised so a[0] = 1."""
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / sr
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "lowshelf":
        s = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s)]
        a = [(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s]
    elif kind == "highshelf":
        s = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s)]
        a = [(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    else:
        raise ValueError(kind)
    b, a = np.array(b, float), np.array(a, float)
    return b / a[0], a / a[0]


def _response(sections, n_fft, sr=SR):
    w = np.exp(-1j * np.linspace(0, np.pi, n_fft // 2 + 1))
    H = np.ones_like(w)
    for b, a in sections:
        H *= (b[0] + b[1] * w + b[2] * w * w) / (a[0] + a[1] * w + a[2] * w * w)
    return H


def filt(x, sections, pad=None):
    """Apply a cascade of biquads [(b, a), ...] to x (n,) or (n, ch), causally."""
    if not sections:
        return x
    pad = pad if pad is not None else min(SR, max(4096, len(x) // 8))
    n = len(x) + pad
    n_fft = 1 << int(np.ceil(np.log2(n)))
    H = _response(sections, n_fft)
    X = np.fft.rfft(x, n=n_fft, axis=0)
    y = np.fft.irfft(X * (H[:, None] if x.ndim == 2 else H), n=n_fft, axis=0)
    return y[: len(x)]


def eq(x, *bands):
    """bands: ("hp", 90), ("peak", 3000, 1.0, +2.5), ("highshelf", 9000, 0.7, -3) ..."""
    secs = []
    for bnd in bands:
        kind, f0 = bnd[0], bnd[1]
        q = bnd[2] if len(bnd) > 2 else 0.707
        g = bnd[3] if len(bnd) > 3 else 0.0
        secs.append(biquad(kind, f0, q, g))
    return filt(x, secs)


def fft_convolve(x, h):
    n = len(x) + len(h) - 1
    n_fft = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, n_fft) * np.fft.rfft(h, n_fft), n_fft)[:n]


# ----------------------------------------------------------------------------- space
def room_ir(rt60=0.35, pre=0.006, size=1.0, seed=3, sr=SR, bright=0.6):
    """Stereo impulse response of a small tiled room: early reflections + dense tail."""
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.6 + pre) * sr)
    t = np.arange(n) / sr
    ir = np.zeros((n, 2))
    for ch in range(2):
        tail = rng.standard_normal(n) * np.exp(-6.9 * t / rt60)
        tail[: int(pre * sr)] = 0
        # brighter at first, darker later (tiles reflect highs, air absorbs them)
        tail = eq(tail, ("lp", 9000 * bright + 1500), ("hp", 180))
        er = np.zeros(n)
        for k in range(9):
            d = int((pre + rng.uniform(0.002, 0.028) * size) * sr)
            if d < n:
                er[d] += rng.uniform(0.25, 0.6) * (1 if rng.random() > 0.3 else -1)
        ir[:, ch] = er * 0.9 + tail * 0.35
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-12
    return ir


def reverb(x, ir, wet=0.15):
    """x mono (n,) -> stereo (n, 2): dry centre + wet room."""
    out = np.zeros((len(x), 2))
    for ch in range(2):
        out[:, ch] = x + wet * fft_convolve(x, ir[:, ch])[: len(x)]
    return out


def pan(x, p=0.0):
    """Constant-power pan of mono x: p in [-1 (left), 1 (right)]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1) * np.sqrt(2)


# ----------------------------------------------------------------------------- dynamics
def envelope(x, sr=SR, block=48, attack=0.005, release=0.12):
    """Peak envelope in blocks (fast; returns per-sample values by interpolation)."""
    m = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=1)
    nb = int(np.ceil(len(m) / block))
    mp = np.concatenate([m, np.zeros(nb * block - len(m))]).reshape(nb, block).max(axis=1)
    a = np.exp(-block / (attack * sr))
    r = np.exp(-block / (release * sr))
    e = np.zeros(nb)
    v = 0.0
    for i in range(nb):
        c = a if mp[i] > v else r
        v = c * v + (1 - c) * mp[i]
        e[i] = v
    return np.interp(np.arange(len(m)), np.arange(nb) * block + block / 2, e)


def compress(x, threshold_db=-18.0, ratio=3.0, attack=0.006, release=0.1, makeup_db=0.0, knee_db=6.0):
    env = envelope(x, attack=attack, release=release)
    lv = 20 * np.log10(env + 1e-9)
    over = lv - threshold_db
    gr = np.where(over <= -knee_db / 2, 0.0, np.where(over >= knee_db / 2, over * (1 - 1 / ratio), (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = 10 ** ((makeup_db - gr) / 20)
    return x * (g[:, None] if x.ndim == 2 else g)


def oversample4(x):
    """4x band-limited upsampling (for true-peak measurement)."""
    taps = 48
    k = np.arange(-taps, taps + 1)
    out = []
    for ph in range(4):
        frac = ph / 4
        h = np.sinc(k - frac) * np.kaiser(len(k), 8.0)
        out.append(np.convolve(x, h[::-1], mode="same"))
    y = np.empty(len(x) * 4)
    for ph in range(4):
        y[ph::4] = out[ph]
    return y


def true_peak_db(x):
    x = x if x.ndim == 2 else x[:, None]
    tp = max(np.max(np.abs(oversample4(x[:, ch]))) for ch in range(x.shape[1]))
    return 20 * np.log10(tp + 1e-12)


def limit(x, ceiling_db=-1.5, lookahead=0.005, release=0.08, sr=SR):
    """Look-ahead brickwall limiter on (oversampled) true peaks, block-domain gain."""
    ceil = 10 ** (ceiling_db / 20)
    block = 24
    x2 = x if x.ndim == 2 else x[:, None]
    pk = np.zeros(len(x2))
    for ch in range(x2.shape[1]):
        o = np.abs(oversample4(x2[:, ch]))
        pk = np.maximum(pk, o.reshape(-1, 4).max(axis=1))
    nb = int(np.ceil(len(pk) / block))
    bp = np.concatenate([pk, np.zeros(nb * block - len(pk))]).reshape(nb, block).max(axis=1)
    need = np.minimum(1.0, ceil / (bp + 1e-12))
    la = max(1, int(lookahead * sr / block))
    # look ahead: each block takes the smallest gain needed within the next `la` blocks
    padded = np.concatenate([need, np.ones(la)])
    ahead = np.min(np.lib.stride_tricks.sliding_window_view(padded, la + 1), axis=1)[:nb]
    r = np.exp(-block / (release * sr))
    g = np.zeros(nb)
    v = 1.0
    for i in range(nb):
        v = ahead[i] if ahead[i] < v else r * v + (1 - r) * ahead[i]
        g[i] = v
    gs = np.interp(np.arange(len(pk)), np.arange(nb) * block, g)
    y = x2 * gs[:, None]
    return y if x.ndim == 2 else y[:, 0]


# ----------------------------------------------------------------------------- loudness
def _k_weight(x, sr=SR):
    # BS.1770 stage 1 (shelf, +4 dB above ~1.5 kHz) and stage 2 (RLB high-pass ~38 Hz)
    if sr == 48000:
        s1 = (np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]), np.array([1.0, -1.69065929318241, 0.73248077421585]))
        s2 = (np.array([1.0, -2.0, 1.0]), np.array([1.0, -1.99004745483398, 0.99007225036621]))
    else:
        s1 = biquad("highshelf", 1681.97, 0.7072, 4.0, sr)
        s2 = biquad("hp", 38.13, 0.5003, 0.0, sr)
    return filt(x, [s1, s2])


def loudness(x, sr=SR):
    """Returns (integrated LUFS, loudness range LU, short-term max LUFS)."""
    x = x if x.ndim == 2 else x[:, None]
    y = _k_weight(x, sr)
    ms = y ** 2
    blk, hop = int(0.4 * sr), int(0.1 * sr)
    n = 1 + (len(ms) - blk) // hop if len(ms) >= blk else 0
    if n <= 0:
        return -70.0, 0.0, -70.0
    cs = np.cumsum(np.concatenate([np.zeros((1, ms.shape[1])), ms]), axis=0)
    z = np.array([(cs[i * hop + blk] - cs[i * hop]) / blk for i in range(n)])  # per block, per channel
    lb = -0.691 + 10 * np.log10(z.sum(axis=1) + 1e-15)
    g1 = lb > -70
    if not g1.any():
        return -70.0, 0.0, -70.0
    l1 = -0.691 + 10 * np.log10(z[g1].sum(axis=1).mean() + 1e-15)
    g2 = g1 & (lb > l1 - 10)
    integrated = -0.691 + 10 * np.log10(z[g2].sum(axis=1).mean() + 1e-15)
    # short-term (3 s) for LRA and max
    sblk = int(3 * sr)
    st = []
    for i in range(0, max(1, len(ms) - sblk + 1), hop):
        e = (cs[min(i + sblk, len(ms))] - cs[i]) / sblk
        st.append(-0.691 + 10 * np.log10(e.sum() + 1e-15))
    st = np.array(st)
    sg = st[st > -70]
    sg = sg[sg > integrated - 20] if len(sg) else sg
    lra = float(np.percentile(sg, 95) - np.percentile(sg, 10)) if len(sg) > 2 else 0.0
    return float(integrated), lra, float(st.max())


def mono_report(stereo):
    """Loudness change when folded to mono and L/R correlation."""
    l_st, _, _ = loudness(stereo)
    mono = stereo.mean(axis=1)
    l_mono, _, _ = loudness(np.stack([mono, mono], axis=1))
    a, b = stereo[:, 0], stereo[:, 1]
    corr = float(np.sum(a * b) / (np.sqrt(np.sum(a * a) * np.sum(b * b)) + 1e-12))
    return {"stereoLUFS": round(l_st, 2), "monoFoldLUFS": round(l_mono, 2), "monoDropLU": round(l_st - l_mono, 2), "correlation": round(corr, 3)}
