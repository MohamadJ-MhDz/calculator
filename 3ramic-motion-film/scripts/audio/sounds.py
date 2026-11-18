"""
3RAMIC — synthesised instruments and sound effects (numpy only, deterministic).

Everything here is generated from scratch by code in this repository: no samples, no
third-party recordings, so the score and effects are original and free of licence
questions. Each function returns a mono float64 array at 48 kHz.
"""
import numpy as np

from dsp import SR, eq

A4 = 440.0
NOTE = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}


def hz(name):
    """'D4' -> 293.66 Hz."""
    n, o = (name[:-1], int(name[-1]))
    return A4 * 2 ** ((NOTE[n] + 12 * (o - 4)) / 12)


def _t(dur):
    return np.arange(int(dur * SR)) / SR


def _env(n, attack, decay_tau=None, release=0.0, sustain=1.0):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    e = a * (np.exp(-t / decay_tau) if decay_tau else sustain)
    if release > 0:
        r = int(release * SR)
        if r < n:
            e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


# ----------------------------------------------------------------------------- tuned
def pluck_bass(f, dur=0.9, seed=1, bright=0.5):
    """Pizzicato upright bass: Karplus-Strong string, computed one period at a time."""
    n = int(dur * SR)
    L = max(2, int(round(SR / f)))
    rng = np.random.default_rng(seed)
    exc = rng.standard_normal(L) * np.hanning(L) ** 0.5
    exc = np.convolve(exc, [0.5, 0.5], "same") * (0.6 + 0.4 * bright)
    y = np.zeros(n + L + 1)
    y[:L] = exc
    loss = 0.996 - 0.004 * (1 - bright)
    for s in range(L, n + 1, L):
        e = min(s + L, n + 1)
        prev = y[s - L:e - L]
        prev2 = y[s - L - 1:e - L - 1] if s - L - 1 >= 0 else np.concatenate([[0.0], y[s - L:e - L - 1]])
        y[s:e] = loss * 0.5 * (prev + prev2)
    y = y[:n]
    body = np.sin(2 * np.pi * f * _t(dur)) * np.exp(-_t(dur) / 0.35) * 0.35
    out = (y + body) * _env(n, 0.002, None, release=0.06)
    return eq(out, ("lp", 1400 + 1800 * bright), ("hp", 35))


def vibes(f, dur=2.2, vel=1.0, motor=5.6, depth=0.28):
    """Vibraphone: inharmonic bar partials, soft mallet, motor tremolo."""
    t = _t(dur)
    parts = [(1.0, 1.0, 1.9), (3.98, 0.22, 0.55), (9.9, 0.06, 0.18)]
    y = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / tau) for m, a, tau in parts)
    trem = 1 - depth * (0.5 + 0.5 * np.sin(2 * np.pi * motor * t))
    click = noise(len(t), int(f)) * np.exp(-t / 0.004) * 0.05
    return (y * trem + click) * _env(len(t), 0.003, None, release=0.15) * vel


def celesta(f, dur=1.4, vel=1.0):
    t = _t(dur)
    parts = [(1.0, 1.0, 0.9), (2.0, 0.35, 0.35), (4.07, 0.12, 0.12), (6.3, 0.05, 0.06)]
    y = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / tau) for m, a, tau in parts)
    return y * _env(len(t), 0.001, None, release=0.1) * vel


def marimba(f, dur=0.7, vel=1.0):
    t = _t(dur)
    parts = [(1.0, 1.0, 0.32), (3.93, 0.3, 0.07), (9.2, 0.08, 0.02)]
    y = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / tau) for m, a, tau in parts)
    return y * _env(len(t), 0.0015, None, release=0.05) * vel


def pad(freqs, dur, attack=0.6, release=0.9, bright=0.35, seed=11, width=0.6):
    """Warm string-like pad (detuned saws, low-passed). Returns stereo (n, 2)."""
    t = _t(dur)
    rng = np.random.default_rng(seed)
    L = np.zeros(len(t))
    R = np.zeros(len(t))
    for f in freqs:
        for k, det in enumerate((-0.11, -0.04, 0.0, 0.05, 0.12)):
            ph = rng.uniform(0, 1)
            ff = f * 2 ** (det / 12 * 0.6)
            saw = 2 * ((ff * t + ph) % 1.0) - 1
            side = (k - 2) / 2 * width
            L += saw * (1 - side) * 0.5
            R += saw * (1 + side) * 0.5
    e = _env(len(t), attack, None, release=release)
    cut = 700 + 2600 * bright
    st = np.stack([L, R], axis=1) * e[:, None] / (len(freqs) * 3.5)
    return eq(st, ("lp", cut, 0.6), ("hp", 90))


def stab(freqs, dur=0.5, bright=0.7):
    """Short brassy chord hit (mugshot sting)."""
    t = _t(dur)
    y = np.zeros(len(t))
    for f in freqs:
        for det in (-0.08, 0.0, 0.07):
            y += 2 * ((f * 2 ** (det / 12) * t) % 1.0) - 1
    y *= np.exp(-t / 0.16) * _env(len(t), 0.004, None, release=0.08) / (len(freqs) * 3)
    return eq(y, ("lp", 2200 + 3000 * bright, 0.8), ("peak", 1200, 1.0, 3), ("hp", 120))


# ----------------------------------------------------------------------------- drums
def brush(dur=0.22, seed=5, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = noise(n, seed) * (np.clip(t / 0.02, 0, 1) * np.exp(-t / 0.08))
    return eq(y, ("bp", 4200, 0.6), ("hp", 1800)) * vel * 1.6


def rim(seed=6, vel=1.0):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.012)
    y = tone * 0.6 + noise(n, seed) * np.exp(-t / 0.006) * 0.5
    return eq(y, ("bp", 2200, 1.2)) * vel * 2.2


def snap(seed=8, vel=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    y = noise(n, seed) * np.exp(-t / 0.011)
    return eq(y, ("bp", 2700, 1.6), ("hp", 900)) * vel * 3.0


def kick(vel=1.0):
    t = _t(0.45)
    f = 50 + 75 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.18) * vel


def clap(seed=9, vel=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for k, d in enumerate((0.0, 0.011, 0.022)):
        i = int(d * SR)
        env[i:] += np.exp(-(t[: n - i]) / (0.006 if k < 2 else 0.07))
    return eq(noise(n, seed) * env, ("bp", 1300, 0.9)) * vel * 1.2


def cymbal(dur=1.6, seed=10, vel=1.0, swell=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = (t / dur) ** 2.2 if swell else np.exp(-t / 0.55)
    y = noise(n, seed) * env
    return eq(y, ("hp", 5200), ("peak", 9000, 0.8, 3)) * vel * 0.8


def snare_roll(dur, seed=12, vel=1.0):
    """Building brush roll (crescendo) for a fill."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = 18 + 14 * t / dur
    ph = np.cumsum(rate) / SR
    pulses = (0.5 + 0.5 * np.cos(2 * np.pi * ph)) ** 6
    y = noise(n, seed) * pulses * (0.25 + 0.75 * t / dur)
    return eq(y, ("bp", 3800, 0.7)) * vel * 1.3


# ----------------------------------------------------------------------------- effects
def whoosh(dur=0.45, f0=300, f1=2500, seed=20, vel=1.0):
    """Air movement: noise through a band-pass that sweeps f0 -> f1, swelled in the middle."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n, seed)
    y = np.zeros(n)
    # piecewise sweep: 12 overlapping band-passed segments
    seg = n // 12 + 1
    win = np.hanning(seg * 2)
    for k in range(12):
        a = max(0, k * seg - seg // 2)
        b = min(n, a + seg * 2)
        fc = f0 * (f1 / f0) ** (k / 11)
        part = eq(x[a:b] * win[: b - a], ("bp", fc, 1.2))
        y[a:b] += part
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.4
    return y * env * vel * 1.4


def paper(dur=0.35, seed=30, vel=1.0):
    """Paper rustle: crackly noise bursts."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    y = noise(n, seed + 1) * 0.15
    for _ in range(int(dur * 70)):
        i = rng.integers(0, max(1, n - 400))
        L = rng.integers(60, 400)
        y[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.4, 1.0)
    env = np.sin(np.pi * np.arange(n) / n) ** 0.6
    return eq(y * env, ("hp", 1500), ("peak", 5000, 1, 3)) * vel * 0.9


def thud(dur=0.25, f=85, vel=1.0, seed=31):
    t = _t(dur)
    body = np.sin(2 * np.pi * f * t * (1 - 0.15 * t / dur)) * np.exp(-t / 0.07)
    knock = eq(noise(len(t), seed) * np.exp(-t / 0.012), ("lp", 1400))
    return (body * 0.9 + knock * 0.5) * vel


def ceramic_tick(f=3100, vel=1.0, seed=40, dur=0.25):
    """The sound of a glazed tile edge touching another: a hard click with a short ring."""
    t = _t(dur)
    ring = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / tau) for m, a, tau in ((1.0, 1.0, 0.03), (1.51, 0.5, 0.018), (2.33, 0.3, 0.01)))
    click = noise(len(t), seed) * np.exp(-t / 0.0015)
    return eq(ring * 0.5 + click * 0.7, ("hp", 700)) * vel


def tile_clack(vel=1.0, seed=41, pitch=1.0):
    """A tile set down / popped out: low knock + ceramic tick."""
    return (pad_len(thud(0.18, 120 * pitch, 0.6, seed), int(0.3 * SR)) + pad_len(ceramic_tick(2400 * pitch, 0.9, seed + 1), int(0.3 * SR))) * vel


def tile_place(vel=1.0, seed=42):
    """THE click: a tile dropping into its own place — firm, satisfying, short."""
    a = pad_len(thud(0.22, 95, 1.0, seed), int(0.4 * SR))
    b = pad_len(ceramic_tick(2050, 1.0, seed + 1, 0.3), int(0.4 * SR))
    c = pad_len(ceramic_tick(4100, 0.35, seed + 2, 0.2), int(0.4 * SR))
    return (a * 0.9 + b + c) * vel


def squeak(dur=0.32, f0=1250, f1=1750, vel=1.0, seed=50):
    """Rubber-duck squeak: a buzzy reed tone gliding up then down, with air."""
    t = _t(dur)
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1))
    f = f0 + (f1 - f0) * shape + 30 * np.sin(2 * np.pi * 31 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sign(np.sin(ph)) * 0.35 + np.sin(ph) * 0.65
    air = noise(len(t), seed) * 0.15
    y = (tone + air) * shape ** 0.6
    return eq(y, ("bp", 1600, 0.9), ("peak", 3200, 1.2, 4)) * vel * 0.8


def squeak_slide(dur=0.6, vel=1.0):
    """Rubber squeaking down glass: a series of short squeaks, descending."""
    n = int(dur * SR)
    y = np.zeros(n)
    k = 0
    for i, s in enumerate(np.linspace(0, dur - 0.08, 7)):
        f = 1700 - i * 110
        q = squeak(0.07, f, f * 1.1, 0.6 - i * 0.05, seed=60 + i)
        a = int(s * SR)
        y[a:a + len(q)] += q[: n - a]
        k += 1
    return y * vel


def creak(dur=0.7, f=95, vel=1.0, seed=70):
    """Heavy wood creak: stick-slip pulses at a drifting rate through a wooden body."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = f * (1 + 0.25 * np.sin(2 * np.pi * 1.3 * t + 0.5))
    ph = np.cumsum(rate) / SR
    pulses = (np.sin(2 * np.pi * ph) > 0.92).astype(float)
    rng = np.random.default_rng(seed)
    pulses *= rng.uniform(0.5, 1.0, n)
    body = eq(pulses, ("bp", 420, 3), ("bp", 900, 2)) * 6
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return body * env * vel


def glass_slide(dur=0.6, vel=1.0, seed=80):
    w = whoosh(dur, 900, 3200, seed, 0.6)
    t = _t(dur)
    ring = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((2600, 0.5), (3900, 0.3), (5300, 0.15))) * np.sin(np.pi * t / dur) * 0.08
    return (w + ring) * vel


def shimmer(dur=1.2, root=880.0, vel=1.0, seed=90):
    """Gentle sparkle: a cloud of quiet high celesta notes."""
    n = int(dur * SR)
    y = np.zeros(n + SR)
    rng = np.random.default_rng(seed)
    scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2]
    for k in range(14):
        s = int(rng.uniform(0, dur * 0.8) * SR)
        f = root * scale[rng.integers(0, len(scale))] * (2 if rng.random() > 0.6 else 1)
        c = celesta(f, 0.6, rng.uniform(0.15, 0.35))
        y[s:s + len(c)] += c
    return y[:n] * np.linspace(1, 0.6, n) * vel


def riser(dur=1.5, vel=1.0, seed=95):
    """Rising tension: filtered noise sweep + upward sine glide."""
    t = _t(dur)
    w = whoosh(dur, 200, 6000, seed, 0.8)
    f = 220 * 2 ** (2.2 * t / dur)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * 0.25
    return (w * (t / dur) ** 1.5 + s) * vel


def drip(vel=1.0):
    """A single tap drip ('plip')."""
    t = _t(0.2)
    f = 1400 * np.exp(-t / 0.03) + 600
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    return y * vel * 0.7


def stamp(vel=1.0):
    """Rubber stamp on paper: dull thump + slap."""
    a = pad_len(thud(0.2, 70, 1.0, 101), int(0.3 * SR))
    b = pad_len(eq(noise(int(0.05 * SR), 102) * np.exp(-np.arange(int(0.05 * SR)) / (0.008 * SR)), ("bp", 900, 0.8)), int(0.3 * SR))
    return (a + b * 1.2) * vel


def shutter(vel=1.0):
    """Mugshot camera: two mechanical clicks."""
    n = int(0.25 * SR)
    y = np.zeros(n)
    for s, f in ((0.0, 3200), (0.075, 2600)):
        c = ceramic_tick(f, 0.8, int(f), 0.06)
        i = int(s * SR)
        y[i:i + len(c)] += c[: n - i]
    return eq(y, ("hp", 1200)) * vel


def cloth(dur=0.2, vel=1.0, seed=110):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return eq(noise(n, seed) * np.sin(np.pi * t / dur) ** 2, ("bp", 1800, 0.7)) * vel * 0.7


def footstep(vel=1.0, seed=120):
    """A small shoe on a glazed floor."""
    return (pad_len(ceramic_tick(1700, 0.35, seed, 0.12), int(0.15 * SR)) + pad_len(thud(0.1, 160, 0.3, seed + 1), int(0.15 * SR))) * vel


def pop(vel=1.0, f=520, seed=130):
    """A soft 'blup' (fixtures popping into place)."""
    t = _t(0.18)
    ff = f * (1 + 1.2 * np.exp(-t / 0.02))
    y = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.05)
    return y * vel * 0.8


def trowel(dur=1.3, vel=1.0, seed=140):
    """Grout float sweeping: a long wet scrape with the rhythm of the strokes."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    strokes = 0.55 + 0.45 * np.sin(2 * np.pi * 3.2 * t) ** 2
    y = eq(noise(n, seed), ("bp", 1100, 0.5), ("lp", 4500)) * strokes
    env = np.clip(t / 0.08, 0, 1) * np.clip((dur - t) / 0.2, 0, 1)
    return y * env * vel * 0.9


def light_switch(vel=1.0):
    return pad_len(ceramic_tick(2900, 0.6, 150, 0.05), int(0.1 * SR)) * vel


def hum(dur, f=100.0, vel=1.0):
    """Fluorescent-tube hum (mains harmonics) for the cold 'before' light."""
    t = _t(dur)
    y = sum(a * np.sin(2 * np.pi * f * k * t + k) for k, a in ((1, 1.0), (2, 0.5), (3, 0.35), (4, 0.15), (6, 0.08)))
    return eq(y, ("hp", 80)) * vel


def room_tone(dur, seed=160, bright=0.4):
    """Quiet air of a small tiled room (stereo)."""
    n = int(dur * SR)
    L = eq(noise(n, seed), ("lp", 1800 + 3000 * bright), ("hp", 60), ("lowshelf", 200, 0.7, 4))
    R = eq(noise(n, seed + 1), ("lp", 1800 + 3000 * bright), ("hp", 60), ("lowshelf", 200, 0.7, 4))
    return np.stack([L, R], axis=1) * 0.25


def pad_len(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])
