#!/usr/bin/env python3
"""
3RAMIC — "THE FLOOR THAT QUIT"
Synthesises ALL audio for the film from scratch with numpy (no samples, no
third-party recordings): an original music score, every sound effect, and a
clearly-labelled SILENT narration placeholder.

    python3 scripts/make-audio.py

Outputs (48 kHz WAV):
  public/audio/score.wav                     original electronic score, 40 s, 120 bpm
  public/audio/sfx/*.wav                     individual sound effects
  public/audio/narration-PLACEHOLDER.wav     40 s of silence — replace with the recorded Persian VO
"""
import os
import wave

import numpy as np

SR = 48000
FPS = 30
DUR = 40.0
ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
SFX = os.path.join(ROOT, "sfx")
os.makedirs(SFX, exist_ok=True)
rng = np.random.default_rng(317)


# ----------------------------------------------------------------------------- utils
def t_axis(d):
    return np.arange(int(d * SR)) / SR


def write(path, x, stereo=False):
    x = np.asarray(x, dtype=np.float64)
    if stereo and x.ndim == 1:
        x = np.stack([x, x], axis=1)
    peak = np.max(np.abs(x)) if x.size else 0
    if peak > 0.98:
        x = x * (0.98 / peak)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2 if (stereo or x.ndim == 2) else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def spectral(x, fn):
    """Zero-phase FFT filter: fn(freqs) -> gain."""
    n = len(x)
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * fn(fr), n)


def lowpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, lo, hi):
    return highpass(lowpass(x, hi), lo)


def env(n, a=0.002, d=0.1, s=0.0, r=0.05, sus_t=0.0):
    a_n, d_n, s_n, r_n = int(a * SR), int(d * SR), int(sus_t * SR), int(r * SR)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1)),
        np.linspace(1, s, max(d_n, 1)),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def expdec(t, rate):
    return np.exp(-t * rate)


def reverb(x, secs=1.2, mix=0.25, damp=3000):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = lowpass(ir, damp)
    ir[0] = 0
    wet = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n), len(x) + n)[: len(x)]
    wet = wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    return x * (1 - mix) + wet * mix


def pad_to(x, d):
    n = int(d * SR)
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ----------------------------------------------------------------------------- instruments
def marimba(f, d=0.6, amp=1.0):
    t = t_axis(d)
    y = (np.sin(2 * np.pi * f * t) * expdec(t, 5)
         + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * expdec(t, 14)
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * expdec(t, 30))
    y *= np.minimum(1, t / 0.002)
    return y * amp


def pizz(f, d=0.45, amp=1.0):
    t = t_axis(d)
    y = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(4 * np.pi * f * t) + 0.2 * np.sin(6 * np.pi * f * t)
    return y * expdec(t, 9) * np.minimum(1, t / 0.003) * amp


def reed(f, d=0.22, amp=1.0):
    """Staccato bassoon-ish voice (odd harmonics, slight vibrato) — comic march lead."""
    t = t_axis(d)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    y = sum((1 / k) * np.sin(2 * np.pi * f * k * vib * t) for k in (1, 3, 5, 7, 9))
    y = lowpass(y, 1800)
    return y * env(len(t), 0.012, 0.05, 0.6, 0.05, d - 0.12) * amp


def pad(freqs, d, amp=1.0, attack=0.8, release=1.0, bright=2200):
    t = t_axis(d)
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.13):
            ff = f * 2 ** (det / 12)
            for k in range(1, 9):
                y += (1 / k) * np.sin(2 * np.pi * ff * k * t + k * det * 10)
    y = lowpass(y, bright)
    e = np.minimum(1, t / attack) * np.minimum(1, (d - t) / release)
    return norm(y * np.clip(e, 0, 1), 1) * amp


def kick(amp=1.0):
    t = t_axis(0.45)
    f = 45 + 75 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * expdec(t, 7) + 0.3 * rng.standard_normal(len(t)) * expdec(t, 120)
    return y * amp


def brush(amp=1.0, d=0.18):
    t = t_axis(d)
    y = bandpass(rng.standard_normal(len(t)), 1800, 9000) * expdec(t, 22)
    return y * amp


def hat(amp=1.0):
    t = t_axis(0.06)
    return highpass(rng.standard_normal(len(t)), 7000) * expdec(t, 80) * amp


def bell(f, d=2.5, amp=1.0, ratio=3.5, index=4.0):
    t = t_axis(d)
    I = index * expdec(t, 2.2)
    y = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t))
    return y * expdec(t, 1.6) * np.minimum(1, t / 0.002) * amp


def place(buf, x, at_s, gain=1.0, pan=0.0):
    i = int(at_s * SR)
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[i:i + n, 0] += x[:n] * gain * l * 1.414
    buf[i:i + n, 1] += x[:n] * gain * r * 1.414


# ----------------------------------------------------------------------------- SCORE
# Playful electronic score at 120 bpm (one beat = 15 frames, so the edit lands on the grid).
# Everything is synthesised here: a filter-enveloped saw bass, an 808-style kick, claps, hats,
# plucks, FM blips, pads, risers and sub drops. No samples.
BEAT = 0.5
STEP = BEAT / 4  # one 16th note

_wave_cache = {}


def saw(f, d):
    """Band-limited sawtooth (additive)."""
    key = ("saw", round(f, 3), round(d, 4))
    if key not in _wave_cache:
        t = t_axis(d)
        y = np.zeros_like(t)
        k = 1
        while f * k < 9000 and k <= 64:
            y += ((-1) ** (k + 1)) * np.sin(2 * np.pi * f * k * t) / k
            k += 1
        _wave_cache[key] = y
    return _wave_cache[key]


def square(f, d):
    key = ("sq", round(f, 3), round(d, 4))
    if key not in _wave_cache:
        t = t_axis(d)
        y = np.zeros_like(t)
        k = 1
        while f * k < 9000 and k <= 63:
            y += np.sin(2 * np.pi * f * k * t) / k
            k += 2
        _wave_cache[key] = y
    return _wave_cache[key]


def bass(m, d=0.12, bright=1500.0, dark=170.0, rate=20.0, sub=0.7, drive=1.5):
    """Confident synth bass: saw + sub through a decaying low-pass ('wow')."""
    f = mtof(m)
    t = t_axis(d)
    raw = saw(f, d) + 0.5 * square(f, d)
    e = np.exp(-t * rate)
    y = lowpass(raw, dark) * (1 - e) + lowpass(raw, bright) * e
    y = y + sub * np.sin(2 * np.pi * f * t)
    a = np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.02)
    return np.tanh(y * drive * 0.6) * np.clip(a, 0, 1)


def pluck(m, d=0.3, bright=4200.0, rate=14.0):
    """Short filtered-square pluck for arps and the hook."""
    f = mtof(m)
    t = t_axis(d)
    raw = 0.6 * square(f, d) + 0.4 * saw(f * 1.006, d)
    e = np.exp(-t * rate)
    y = lowpass(raw, 600) * (1 - e) + lowpass(raw, bright) * e
    return y * np.exp(-t * 9) * np.minimum(1, t / 0.003) * np.minimum(1, (d - t) / 0.01)


def blip(m, d=0.09, index=2.2):
    """Quirky FM bleep."""
    f = mtof(m)
    t = t_axis(d)
    y = np.sin(2 * np.pi * f * t + index * np.exp(-t * 30) * np.sin(2 * np.pi * f * 2.0 * t))
    return y * np.exp(-t * 28) * np.minimum(1, t / 0.002)


def kick808(amp=1.0, d=0.42):
    t = t_axis(d)
    f = 46 + 120 * np.exp(-t * 36)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
    y += 0.35 * highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t * 180)
    return np.tanh(y * 1.6) * amp


def clap(amp=1.0):
    t = t_axis(0.28)
    n = bandpass(rng.standard_normal(len(t)), 900, 3800)
    e = np.zeros_like(t)
    for off in (0.0, 0.011, 0.023):
        e += np.where(t >= off, np.exp(-(t - off) * 160), 0) * 0.6
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) * 22), 0)
    return n * e * amp


def chat(amp=1.0):
    t = t_axis(0.05)
    return highpass(rng.standard_normal(len(t)), 7500) * np.exp(-t * 95) * amp


def ohat(amp=1.0):
    t = t_axis(0.22)
    return highpass(rng.standard_normal(len(t)), 6500) * np.exp(-t * 16) * amp


def rim(f=1750, amp=1.0):
    t = t_axis(0.05)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 110) + 0.3 * rng.standard_normal(len(t)) * np.exp(-t * 300)) * amp


def cer_perc(pitch=1.0, amp=1.0):
    """A ceramic 'tink' used as percussion — the tiles are in the band."""
    t = t_axis(0.12)
    y = sum(np.sin(2 * np.pi * f * pitch * t + ph) * np.exp(-t * r) for f, r, ph in ((1850, 60, 0.3), (2960, 80, 1.1), (4700, 110, 2.0)))
    return y * amp * 0.5


def riser(d, lo=300.0, hi=7000.0):
    t = t_axis(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    segs = 24
    L = len(t) // segs + 1
    for i in range(segs):
        c = lo * (hi / lo) ** (i / (segs - 1))
        w = np.zeros_like(t)
        w[i * L:(i + 1) * L] = 1
        out += bandpass(n, c * 0.7, c * 1.5) * w
    tone = np.sin(2 * np.pi * np.cumsum(110 * (4 ** (t / d))) / SR) * 0.25
    return (out * 0.6 + tone) * (t / d) ** 2


def subdrop(d=1.6, f0=95.0, f1=30.0):
    t = t_axis(d)
    f = f1 + (f0 - f1) * np.exp(-t * 5)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4) * np.minimum(1, t / 0.004)


def chord_stab(notes, d=1.4, bright=2400.0):
    t = t_axis(d)
    y = np.zeros_like(t)
    for m in notes:
        for det in (-0.08, 0.08):
            y += saw(mtof(m) * 2 ** (det / 12), d)
    return lowpass(y, bright) * np.exp(-t * 3.2) * np.minimum(1, t / 0.004)


def make_score():
    N = int(DUR * SR)
    DR = np.zeros((N, 2))  # drums
    BS = np.zeros((N, 2))  # bass
    MU = np.zeros((N, 2))  # plucks, pads, blips (gets reverb)
    FX = np.zeros((N, 2))  # risers, impacts
    kicks = []

    def put_kick(at, g=0.9):
        place(DR, kick808(), at, g)
        kicks.append(at)

    # hook (16th-step, midi, length in steps) over two bars — major; minor swaps F#→F and B→C
    HOOK = [
        [(0, 74, 2), (3, 78, 1), (4, 76, 2), (6, 74, 1), (8, 81, 2), (11, 78, 1), (12, 76, 2), (14, 74, 2)],
        [(0, 71, 2), (3, 74, 1), (4, 76, 2), (6, 78, 1), (8, 76, 2), (10, 74, 1), (12, 69, 3)],
    ]
    to_minor = {78: 77, 71: 72, 66: 65, 59: 60}

    def hook_bar(at, which, minor=False, g=0.16, octave=0):
        for st, m, ln in HOOK[which]:
            if minor:
                m = to_minor.get(m, m)
            place(MU, pluck(m + octave, ln * STEP + 0.12), at + st * STEP, g, 0.2 if st % 4 else -0.2)

    def groove_bar(at, root, minor=False, steps=16, bass_g=0.5, drums=True, hats=True, perc=True, bright=1500.0):
        third = 3 if minor else 4
        line = {0: 0, 2: 0, 3: 12, 5: 0, 6: third, 8: 0, 10: 0, 11: 12, 12: 7, 14: 10, 15: 12}
        for st in range(steps):
            t0 = at + st * STEP
            if st in line:
                long = st in (0, 8)
                place(BS, bass(root + line[st], 0.2 if long else 0.105, bright=bright), t0, bass_g)
            if drums:
                if st % 4 == 0:
                    put_kick(t0)
                if st in (4, 12):
                    place(DR, clap(), t0, 0.34)
            if hats:
                if st % 4 == 2:
                    place(DR, ohat() if st == 14 else chat(), t0, 0.2 if st == 14 else 0.24, 0.3)
                elif st % 2 == 1:
                    place(DR, chat(), t0, 0.09, -0.3)
            if perc and st in (3, 7, 10):
                place(DR, cer_perc(1.0 + 0.18 * (st % 3)), t0, 0.16, 0.5 if st == 7 else -0.5)

    # ------------------------------------------------------------------ 0 – 4.07 s  · THE INCIDENT
    # tension: sub drone, a clock that is slightly too loud, a bassline that sneaks
    t = t_axis(4.2)
    drone = np.sin(2 * np.pi * mtof(26) * t) + 0.45 * np.sin(2 * np.pi * mtof(38) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * t))
    place(BS, drone * np.minimum(1, t / 1.0), 0.0, 0.2)
    for i in range(8):
        place(DR, rim(1750 if i % 2 == 0 else 1320), i * BEAT, 0.13, 0.35 if i % 2 else -0.35)
    for at, m in [(0.5, 38), (1.25, 41), (1.5, 38), (2.0, 33), (2.5, 38), (2.75, 41), (3.0, 43), (3.25, 44), (3.5, 45), (3.75, 46)]:
        place(BS, bass(m, 0.16, bright=700, rate=26), at, 0.34)
    for at, m in [(0.75, 86), (1.75, 89), (2.25, 86), (3.125, 93)]:
        place(MU, blip(m), at, 0.1, 0.4)
    place(MU, pad([mtof(50), mtof(51), mtof(57)], 4.1, 1.0, 2.5, 0.05, 1100), 0.0, 0.05)
    place(FX, riser(1.2), 2.87, 0.3)
    for i in range(5):  # hats accelerating into the cut
        place(DR, chat(), 3.44 + i * STEP, 0.1 + 0.03 * i)
    cut_a = 122 / FPS  # the abrupt comedic cut: everything stops

    # ------------------------------------------------------------------ 5 – 9.6 s  · THE RESIGNATION (the drop)
    groove_bar(5.0, 38, minor=True)
    groove_bar(7.0, 38, minor=True)
    groove_bar(9.0, 38, minor=True, steps=5)
    hook_bar(5.0, 0, minor=True)
    hook_bar(7.0, 1, minor=True)
    place(MU, pluck(74, 0.3), 9.0, 0.16)
    place(MU, pluck(77, 0.3), 9.25, 0.16)
    place(FX, subdrop(1.2), 5.0, 0.35)
    stop_a, stop_b = 9.3, 9.62  # tape-stop into the comedic pause

    # ------------------------------------------------------------------ 10.73 s  · title hit (door slam)
    hit = 322 / FPS
    place(FX, subdrop(2.0, 110, 28), hit, 0.5)
    place(MU, chord_stab([38, 45, 50, 53, 64], 1.8), hit, 0.1)

    # ------------------------------------------------------------------ 11 – 17 s  · THE INVESTIGATION
    # half-time, dark: a closed-filter bass pulse, ticking hats, glitchy bleeps, a rubbing pad
    prng = np.random.default_rng(31703)
    for bar in range(3):
        at = 11.0 + bar * 2
        for st in range(16):
            t0 = at + st * STEP
            if st % 2 == 0:
                root = 39 if (bar == 1 and st >= 8) else 38
                place(BS, bass(root, 0.11, bright=520 + 90 * bar, dark=140, rate=24), t0, 0.42 if st % 8 == 0 else 0.3)
            if st in (0, 10):
                put_kick(t0, 0.8)
            if st == 8:
                place(DR, rim(1500), t0, 0.3)
                place(DR, clap(), t0, 0.14)
            place(DR, chat(), t0, 0.12 if st % 4 == 2 else 0.05, 0.3 if st % 2 else -0.3)
            if prng.random() < 0.3:
                place(MU, blip(int(prng.choice([86, 89, 93, 96, 98])), 0.07), t0, 0.07, float(prng.uniform(-0.7, 0.7)))
        place(MU, pad([mtof(50), mtof(51), mtof(57)], 2.1, 1.0, 0.4, 0.4, 1300), at, 0.045)
    for fr in (378, 422, 470):  # exhibit cuts
        place(FX, riser(0.35, 800, 6000), fr / FPS - 0.35, 0.18)
        place(FX, subdrop(1.1, 100, 32), fr / FPS, 0.42)
        place(MU, chord_stab([50, 53, 57, 63], 0.7, 1800), fr / FPS, 0.06)
    place(FX, riser(0.6, 500, 8000), 16.4, 0.26)  # scan wipe into the system

    # ------------------------------------------------------------------ 17 – 24 s  · THE 3RAMIC SYSTEM
    # the same groove, now major and bright
    ROOTS = [38, 43, 35, 33]  # D  G  Bm  A
    ARPS = [[62, 66, 69, 74], [62, 67, 71, 74], [62, 66, 71, 74], [61, 64, 69, 73]]
    for bar in range(4):
        at = 17.0 + bar * 2
        steps = 16 if bar < 3 else 8
        groove_bar(at, ROOTS[bar], minor=(bar == 2), steps=steps, bass_g=0.46, drums=bar > 0, perc=True)
        for st in range(steps):
            n = ARPS[bar][[0, 1, 2, 3, 2, 1, 2, 3][st % 8]] + (12 if st % 8 >= 4 else 0)
            place(MU, pluck(n, 0.22, bright=3600), at + st * STEP, 0.085, 0.45 if st % 2 else -0.45)
        place(MU, pad([mtof(m) for m in ARPS[bar][:3]], 2.05 if bar < 3 else 1.0, 1.0, 0.25, 0.3, 2000), at, 0.05)
    put_kick(17.0, 0.9)
    place(FX, riser(1.0, 400, 9000), 23.0, 0.3)
    for i in range(8):  # snare-ish roll into the transformation
        place(DR, clap(), 23.5 + i * STEP / 2, 0.08 + 0.025 * i)

    # ------------------------------------------------------------------ 24 – 34 s  · THE TRANSFORMATION
    groove_bar(24.0, 38, steps=12)  # 24.0 – 25.5: full groove + hook
    hook_bar(24.0, 0, g=0.17)
    place(FX, subdrop(1.3), 24.0, 0.36)
    # 25.5 / 26.0 / 26.5: stop-time hits on the three macro cuts
    for i, (at, chord) in enumerate([(25.5, [50, 57, 62, 66]), (26.0, [47, 54, 59, 62]), (26.5, [45, 52, 57, 61])]):
        put_kick(at, 1.0)
        place(DR, clap(), at, 0.3)
        place(BS, bass(chord[0] - 12, 0.3, bright=1900), at, 0.55)
        place(MU, chord_stab(chord, 0.5, 3000), at, 0.09)
        place(DR, cer_perc(1.0 + 0.2 * i), at + 0.25, 0.2, 0.4)
        place(DR, cer_perc(1.3 + 0.2 * i), at + 0.375, 0.16, -0.4)
    place(FX, riser(0.5, 600, 9000), 26.5, 0.22)
    # 27 – 31: they come home — full groove, hook an octave up on the repeats
    for bar, root in enumerate([43, 35, 33]):  # G  Bm  A  (27, 29, 31)
        at = 27.0 + bar * 2
        steps = 16 if bar < 2 else 2
        groove_bar(at, root, minor=(bar == 1), steps=steps)
        if bar < 2:
            hook_bar(at, bar, g=0.17)
            hook_bar(at, bar, g=0.06, octave=12)
            place(MU, pad([mtof(m) for m in ARPS[bar + 1][:3]], 2.05, 1.0, 0.2, 0.3, 2400), at, 0.06)
    place(FX, subdrop(1.3), 27.0, 0.36)
    # 31.2 – 32: slow motion — the music sinks under water (done in the master below)
    place(MU, pad([mtof(45), mtof(52), mtof(57), mtof(61)], 1.0, 1.0, 0.1, 0.2, 900), 31.0, 0.09)
    place(FX, riser(0.7, 300, 5000), 31.3, 0.2)
    # 32: the click — everything comes back for the pull-back
    place(FX, subdrop(1.8, 110, 28), 32.0, 0.5)
    groove_bar(32.0, 38, steps=16)
    hook_bar(32.0, 0, g=0.18)
    hook_bar(32.0, 0, g=0.07, octave=12)
    place(MU, pad([mtof(m) for m in (50, 57, 62, 66)], 2.05, 1.0, 0.1, 0.3, 2600), 32.0, 0.07)

    # ------------------------------------------------------------------ 34 – 36.5 s  · THE ENDING
    # the groove thins out: bass, a soft pad and the arp walking home
    for st in range(20):
        t0 = 34.0 + st * STEP
        if st % 4 == 0:
            place(BS, bass(38 if st < 16 else 45, 0.2, bright=900), t0, 0.4)
        n = ARPS[0][[0, 1, 2, 3, 2, 1, 2, 3][st % 8]] + 12
        place(MU, pluck(n, 0.25, bright=3000), t0, 0.07, 0.4 if st % 2 else -0.4)
        if st % 4 == 2:
            place(DR, chat(), t0, 0.12)
    place(MU, pad([mtof(m) for m in (50, 57, 62, 66)], 2.5, 1.0, 0.4, 0.4, 2000), 34.0, 0.08)
    place(FX, riser(0.7, 500, 8000), 35.8, 0.22)

    # ------------------------------------------------------------------ 36.5 – 40 s  · END CARD
    place(FX, subdrop(2.6, 100, 27), 36.5, 0.55)
    put_kick(36.5, 1.0)
    place(MU, pad([mtof(m) for m in (38, 50, 57, 62, 66, 69)], 3.5, 1.0, 0.04, 2.3, 2600), 36.5, 0.15)
    for k, (st, m) in enumerate([(0, 74), (3, 78), (4, 76), (6, 74), (8, 81)]):  # the hook, once, alone
        place(MU, pluck(m, 0.5, bright=3400), 36.5 + st * STEP, 0.15, -0.2 + 0.1 * k)
    for k, m in enumerate((74, 78, 81, 86)):  # bells as the tagline lands
        place(MU, bell(mtof(m), 2.4), 37.7 + k * 0.06, 0.07, -0.3 + k * 0.2)

    # ------------------------------------------------------------------ mix
    duck = np.ones(N)  # side-chain: bass and music breathe around every kick
    tt = np.arange(int(0.5 * SR)) / SR
    shape = 1 - 0.55 * np.exp(-tt / 0.1)
    for at in kicks:
        i = int(at * SR)
        n = min(len(shape), N - i)
        duck[i:i + n] = np.minimum(duck[i:i + n], shape[:n])
    for ch in range(2):
        MU[:, ch] = reverb(MU[:, ch], 1.5 + 0.1 * ch, 0.22)
        DR[:, ch] = reverb(DR[:, ch], 0.5, 0.06, 5000)
    S = DR * 0.9 + BS * duck[:, None] + MU * duck[:, None] * 1.25 + FX

    # slow motion (31.2 – 32.0 s): cross-fade into a low-passed copy
    a, b = int(31.2 * SR), int(32.0 * SR)
    w = np.sin(np.linspace(0, np.pi / 2, b - a)) ** 2
    for ch in range(2):
        seg = S[a:b, ch].copy()
        S[a:b, ch] = seg * (1 - w) + lowpass(seg, 320) * w * 1.3

    # tape-stop into the comedic pause, then silence until the door slams
    a, b = int(stop_a * SR), int(stop_b * SR)
    L = b - a
    speed = np.linspace(1, 0, L) ** 0.8
    posn = np.cumsum(speed)
    idx = np.clip(posn, 0, L - 2)
    for ch in range(2):
        seg = S[a:a + L, ch].copy()
        S[a:b, ch] = np.interp(idx, np.arange(L), seg) * np.linspace(1, 0, L) ** 0.5
    S[b:int(hit * SR)] = 0

    # the abrupt cut at 4.07 s: dead silence until the drop
    c = int(cut_a * SR)
    S[c:int(5.0 * SR)] = 0
    S[c - 240:c] *= np.linspace(1, 0, 240)[:, None]

    S = np.tanh(S * 1.15)
    fade = np.ones(N)
    fade[-int(0.9 * SR):] = np.linspace(1, 0, int(0.9 * SR)) ** 1.5
    S *= fade[:, None]
    return norm(S, 0.86)


# ----------------------------------------------------------------------------- SFX
def sfx_tick():
    t = t_axis(0.06)
    return norm(bandpass(rng.standard_normal(len(t)), 2500, 7000) * expdec(t, 140) + 0.5 * np.sin(2 * np.pi * 3200 * t) * expdec(t, 90))


def sfx_beep():
    t = t_axis(0.07)
    b = np.sin(2 * np.pi * 2093 * t) * env(len(t), 0.003, 0.01, 0.8, 0.01, 0.045)
    return norm(np.concatenate([b, np.zeros(int(0.06 * SR)), b]))


def sfx_bloop(f0=600, f1=1500, d=0.14):
    t = t_axis(d)
    f = f0 + (f1 - f0) * (t / d) ** 0.6
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.004, d - 0.03, 0, 0.02))


def sfx_crack():
    t = t_axis(0.5)
    parts = [(2140, 26), (3420, 34), (5710, 45), (7930, 60), (1290, 18)]
    y = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * expdec(t, r) for f, r in parts)
    y += 2.5 * highpass(rng.standard_normal(len(t)), 1500) * expdec(t, 70)
    thump = np.sin(2 * np.pi * (90 + 60 * np.exp(-t * 30)) * t) * expdec(t, 25)
    return norm(y * 0.5 + thump)


def sfx_click(pitch=1.0, body=0.6):
    """Satisfying ceramic clack."""
    t = t_axis(0.25)
    parts = [(1850 * pitch, 40), (2960 * pitch, 55), (4700 * pitch, 80)]
    y = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * expdec(t, r) for f, r in parts)
    y += 1.2 * highpass(rng.standard_normal(len(t)), 2500) * expdec(t, 200)
    y += body * np.sin(2 * np.pi * 140 * pitch * t) * expdec(t, 35)
    return norm(y)


def sfx_boing():
    t = t_axis(0.55)
    f = 180 + 320 * (1 - np.exp(-t * 9)) + 60 * np.sin(2 * np.pi * 13 * t) * np.exp(-t * 4)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.005, 0.5, 0, 0.03) * (1 + 0.3 * np.sin(2 * np.pi * 26 * t)))


def sfx_thump(f0=120, d=0.2):
    t = t_axis(d)
    return norm(np.sin(2 * np.pi * (f0 * 0.5 + f0 * np.exp(-t * 25)) * t) * expdec(t, 22) + 0.2 * lowpass(rng.standard_normal(len(t)), 800) * expdec(t, 40))


def sfx_toast():
    t = t_axis(0.45)
    ping = np.sin(2 * np.pi * 2600 * t) * expdec(t, 9) * 0.4 + np.sin(2 * np.pi * 3900 * t) * expdec(t, 14) * 0.25
    spring = np.sin(2 * np.pi * np.cumsum(500 + 200 * np.sin(2 * np.pi * 30 * t)) / SR) * expdec(t, 10) * 0.5
    return norm(ping + spring + sfx_thump(200, 0.45) * 0.5)


def sfx_whoosh(d=0.55, lo=300, hi=5000):
    t = t_axis(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    segs = 24
    L = len(t) // segs + 1
    for i in range(segs):
        c = lo * (hi / lo) ** (np.sin(np.pi * i / segs))
        seg = bandpass(n, c * 0.6, c * 1.6)
        w = np.zeros_like(t)
        w[i * L:(i + 1) * L] = 1
        out += seg * w
    e = np.sin(np.pi * t / d) ** 1.5
    return norm(lowpass(out, hi * 1.2) * e)


def sfx_glitch():
    t = t_axis(0.35)
    y = np.zeros_like(t)
    for i in range(7):
        a = int(rng.uniform(0, 0.3) * SR)
        L = int(rng.uniform(0.01, 0.05) * SR)
        f = rng.uniform(200, 3000)
        seg = np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * rng.uniform(0.3, 1)
        y[a:a + L] += seg[: max(0, min(L, len(y) - a))]
    return norm(np.round(y * 4) / 4)


def sfx_impact():
    t = t_axis(2.0)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-t * 6)) / SR) * expdec(t, 2.2)
    hit = lowpass(rng.standard_normal(len(t)), 2500) * expdec(t, 9)
    return norm(reverb(sub + 0.6 * hit, 1.8, 0.35, 1800))


def sfx_slam():
    t = t_axis(1.0)
    thud = np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 25)) / SR) * expdec(t, 9)
    knock = bandpass(rng.standard_normal(len(t)), 200, 2500) * expdec(t, 35)
    rattle = sum(np.sin(2 * np.pi * f * t) * expdec(t, 18) for f in (930, 1410, 2210)) * 0.15
    return norm(reverb(thud + 0.8 * knock + rattle, 0.9, 0.3, 2500))


def sfx_creak():
    t = t_axis(0.8)
    f = 160 + 90 * np.sin(2 * np.pi * 1.3 * t) + 25 * np.sin(2 * np.pi * 17 * t)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    grit = (rng.random(len(t)) < 0.02).astype(float) * 0.8
    y = bandpass(saw + grit, 300, 3000) * env(len(t), 0.05, 0.6, 0, 0.15)
    return norm(y)


def sfx_crickets(d=1.8):
    t = t_axis(d)
    y = np.zeros_like(t)
    for start in np.arange(0.05, d - 0.3, 0.55):
        for k in range(3):
            a = int((start + k * 0.045) * SR)
            L = int(0.03 * SR)
            tt = np.arange(L) / SR
            if a + L < len(y):
                y[a:a + L] += np.sin(2 * np.pi * 4700 * tt) * np.sin(np.pi * tt / 0.03)
    return norm(y * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t)))


def sfx_scan():
    t = t_axis(0.8)
    f = 300 * (8 ** (t / 0.8))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + highpass(rng.standard_normal(len(t)), 4000) * 0.15
    return norm(y * np.sin(np.pi * t / 0.8))


def sfx_blip(f=1320, d=0.08):
    t = t_axis(d)
    return norm(np.sin(2 * np.pi * f * t) * env(len(t), 0.002, d - 0.02, 0, 0.015))


def sfx_select():
    return norm(np.concatenate([sfx_blip(990, 0.06), sfx_blip(1480, 0.1)]))


def sfx_typing(d=0.5):
    t = t_axis(d)
    y = np.zeros_like(t)
    for at in np.arange(0, d - 0.03, 0.045):
        a = int((at + rng.uniform(0, 0.01)) * SR)
        c = sfx_tick()[: int(0.03 * SR)] * rng.uniform(0.4, 0.9)
        y[a:a + len(c)] += c[: max(0, min(len(c), len(y) - a))]
    return norm(y)


def sfx_slamhit():
    t = t_axis(0.5)
    y = sfx_thump(140, 0.5) + 0.5 * highpass(rng.standard_normal(len(t)), 3000) * expdec(t, 50)
    return norm(y)


def sfx_ding(f=1760):
    return norm(bell(f, 1.2, 1.0, 2.0, 1.5))


def sfx_chime():
    y = sum(bell(mtof(m), 3.0, 1.0, 3.5, 3.0) for m in (74, 78, 81))
    return norm(reverb(y, 2.0, 0.35))


def sfx_tok(f=800):
    t = t_axis(0.12)
    return norm(np.sin(2 * np.pi * f * t) * expdec(t, 45) + 0.3 * np.sin(2 * np.pi * f * 2.7 * t) * expdec(t, 70))


def sfx_ripple(times, d):
    """A cascade of ceramic pops at the given times (s) — pre-composed for crowd moments."""
    y = np.zeros(int(d * SR))
    for k, at in enumerate(times):
        c = sfx_click(rng.uniform(0.85, 1.25), 0.4) * rng.uniform(0.35, 0.7)
        a = int(at * SR)
        n = min(len(c), len(y) - a)
        if n > 0:
            y[a:a + n] += c[:n]
    return norm(y, 0.9)


def sfx_march(d, rate=24):
    """Tiny-footstep patter + suitcase wheels over grout lines."""
    t = t_axis(d)
    y = np.zeros_like(t)
    for at in np.sort(rng.uniform(0, d - 0.05, int(d * rate))):
        f = rng.uniform(1400, 2600)
        L = int(0.03 * SR)
        tt = np.arange(L) / SR
        a = int(at * SR)
        s = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 160) + 0.6 * rng.standard_normal(L) * np.exp(-tt * 260)) * rng.uniform(0.3, 1)
        y[a:a + L] += s[: max(0, min(L, len(y) - a))]
    rumble = lowpass(rng.standard_normal(len(t)), 400) * 0.25
    for at in np.arange(0, d, 0.19):
        a = int(at * SR)
        L = int(0.02 * SR)
        if a + L < len(y):
            tt = np.arange(L) / SR
            y[a:a + L] += np.sin(2 * np.pi * 900 * tt) * np.exp(-tt * 200) * 0.4
    e = np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.3)
    return norm((y + rumble) * e)


def sfx_steps(times, d):
    y = np.zeros(int(d * SR))
    for at in times:
        c = sfx_tok(rng.uniform(900, 1300)) * 0.5
        a = int(at * SR)
        n = min(len(c), len(y) - a)
        if n > 0:
            y[a:a + n] += c[:n]
    return norm(y, 0.8)


def sfx_rattle(d=1.0):
    """The rest of the floor waking up: ceramic chatter that thickens."""
    y = np.zeros(int(d * SR))
    times = d * 0.92 * rng.uniform(0, 1, 46) ** 0.6
    for at in np.sort(times):
        c = sfx_click(rng.uniform(1.15, 1.9), 0.25)[: int(0.09 * SR)] * rng.uniform(0.25, 0.8) * (0.35 + 0.65 * at / d)
        a = int(at * SR)
        n = min(len(c), len(y) - a)
        if n > 0:
            y[a:a + n] += c[:n]
    return norm(y, 0.85)


def sfx_scrape(d=0.7):
    """A tile slowly prising itself out of its bed: gritty ceramic drag."""
    t = t_axis(d)
    n = bandpass(rng.standard_normal(len(t)), 350, 2600)
    grit = (rng.random(len(t)) < 0.012).astype(float)
    grit = np.convolve(grit, np.exp(-np.arange(200) / 30.0), mode="same")
    am = 0.55 + 0.45 * np.sin(2 * np.pi * (9 + 6 * t / d) * t)
    y = (n * 0.5 + bandpass(grit, 900, 5000) * 1.6) * am
    return norm(y * np.minimum(1, t / 0.12) * np.minimum(1, (d - t) / 0.1))


def sfx_clack():
    """One corner of a rolling tile hitting the floor."""
    y = sfx_click(0.72, 1.0)
    y[: int(0.2 * SR)] += sfx_thump(95, 0.2)[: int(0.2 * SR)] * 0.9
    return norm(y)


def sfx_snap():
    """Sample snapping into place: tight click + body + a little upward chirp."""
    c = sfx_click(1.15, 0.5)
    t = t_axis(0.25)
    chirp = np.sin(2 * np.pi * np.cumsum(700 + 2600 * (t / 0.07).clip(0, 1)) / SR) * np.exp(-t * 55) * 0.5
    body = np.sin(2 * np.pi * np.cumsum(60 + 110 * np.exp(-t * 40)) / SR) * np.exp(-t * 16)
    return norm(c + chirp + body * 1.1)


def sfx_suitcase_roll(d=1.6):
    """Tiny suitcase wheels over tile joints."""
    t = t_axis(d)
    rumble = bandpass(rng.standard_normal(len(t)), 180, 1100) * (0.6 + 0.4 * np.sin(2 * np.pi * 19 * t))
    y = rumble * 0.5
    for at in np.arange(0.04, d - 0.05, 0.145):
        a = int(at * SR)
        L = int(0.03 * SR)
        tt = np.arange(L) / SR
        y[a:a + L] += (np.sin(2 * np.pi * 1150 * tt) * np.exp(-tt * 190) + 0.5 * rng.standard_normal(L) * np.exp(-tt * 260)) * 0.7
    return norm(y * np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.2))


def sfx_slowmo(d=0.9):
    """Slow motion: the world drops an octave."""
    t = t_axis(d)
    f = 160 * (0.35 ** (t / d))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.8 + lowpass(rng.standard_normal(len(t)), 500) * 0.35
    return norm(y * np.sin(np.pi * t / d) ** 0.8)


def sfx_hall_ramp():
    """Hallway tracking shot (42 frames): patter at speed, a slow-motion sag, then back up to speed."""
    d = 42 / FPS
    y = np.zeros(int(d * SR))

    def steps(t0, t1, rate, lo, hi, gain):
        for at in np.sort(rng.uniform(t0, t1, max(1, int((t1 - t0) * rate)))):
            f = rng.uniform(lo, hi)
            L = int(0.035 * SR * (2000 / hi) ** 0.5)
            tt = np.arange(L) / SR
            a = int(at * SR)
            sig = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 150 * hi / 2600) + 0.5 * rng.standard_normal(L) * np.exp(-tt * 240)) * rng.uniform(0.4, 1) * gain
            n = min(L, len(y) - a)
            if n > 0:
                y[a:a + n] += sig[:n]

    steps(0.0, 0.42, 30, 1400, 2600, 1.0)
    steps(0.42, 0.86, 7, 420, 800, 0.9)  # slow motion: sparse, an octave down
    steps(0.86, d - 0.03, 34, 1500, 2800, 1.1)
    sl = sfx_slowmo(0.5)
    a = int(0.4 * SR)
    y[a:a + len(sl)] += sl[: len(y) - a] * 0.9
    t = np.arange(len(y)) / SR
    return norm(y * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.04))


def main():
    write(os.path.join(ROOT, "score.wav"), make_score(), stereo=True)
    write(os.path.join(ROOT, "narration-PLACEHOLDER.wav"), np.zeros(int(DUR * SR)))

    sfx = {
        "tick": sfx_tick(),
        "beep": sfx_beep(),
        "eyes-open": sfx_bloop(500, 1400, 0.15),
        "crack": sfx_crack(),
        "boing": sfx_boing(),
        "land": sfx_thump(160, 0.2),
        "toast-pop": sfx_toast(),
        "catch": sfx_click(1.4, 0.2),
        "whoosh": sfx_whoosh(0.55),
        "whoosh-short": sfx_whoosh(0.3, 600, 7000),
        "glitch": sfx_glitch(),
        "impact": sfx_impact(),
        "door-creak": sfx_creak(),
        "door-slam": sfx_slam(),
        "crickets": sfx_crickets(1.8),
        "scan": sfx_scan(),
        "blip": sfx_blip(),
        "select": sfx_select(),
        "typing": sfx_typing(0.6),
        "slam-hit": sfx_slamhit(),
        "tile-click": sfx_click(1.0, 0.6),
        "tile-click-big": norm(reverb(sfx_click(0.8, 1.0), 0.8, 0.25)),
        "ding": sfx_ding(),
        "chime": sfx_chime(),
        "tok": sfx_tok(),
        "suitcase-down": sfx_thump(110, 0.25),
        "rattle": sfx_rattle(1.0),
        "scrape": sfx_scrape(0.7),
        "clack": sfx_clack(),
        "snap": sfx_snap(),
        "tap": norm(sfx_click(1.9, 0.12)[: int(0.07 * SR)]),
        "suitcase-roll": sfx_suitcase_roll(1.6),
        "slowmo": sfx_slowmo(0.9),
        "hall-ramp": sfx_hall_ramp(),
    }
    # crowd stems, timed from the same formulas the scenes use
    # Scene 02 ripple: same formula as tPop() in Scene02Resignation.tsx (relative to scene start)
    stuck = {(1, -2.5), (2, -2.5), (-2, 1.5), (-2, 2.5), (2, 2.5), (0, -2.5)}  # under furniture + the hero (already up)
    pops = sorted(
        (3 + np.hypot(x, zc + 2.5) * 4.5) / FPS
        for zc in np.arange(-2.5, 3.0, 1.0)
        for x in range(-2, 3)
        if (x, float(zc)) not in stuck
    )
    sfx["floor-ripple"] = sfx_ripple(pops, max(pops) + 0.4)
    sfx["march"] = sfx_march(3.4)
    sfx["flip-cascade"] = sfx_ripple([k * 1.6 / FPS + 0.33 for k in range(16)], 1.4)
    sfx["ripple-long"] = sfx_ripple(sorted(rng.uniform(0, 1.3, 40)), 1.8)
    sfx["steps-hero"] = sfx_steps([k * 0.16 for k in range(7)], 1.3)
    for name, y in sfx.items():
        write(os.path.join(SFX, f"{name}.wav"), y)
    print("wrote", len(sfx), "sfx + score + placeholder")


if __name__ == "__main__":
    main()
