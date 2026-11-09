#!/usr/bin/env python3
"""
3RAMIC — "THE FLOOR THAT QUIT"
Synthesises ALL audio for the film from scratch with numpy (no samples, no
third-party recordings): an original music score, every sound effect, and a
clearly-labelled SILENT narration placeholder.

    python3 scripts/make-audio.py

Outputs (48 kHz WAV):
  public/audio/score.wav                     original music bed, 40 s
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
def make_score():
    N = int(DUR * SR)
    S = np.zeros((N, 2))
    BEAT = 0.5  # 120 bpm
    D = 50  # D3 midi
    # --- 0–5 s: suspense drone + sparse pizzicato
    t = t_axis(5.2)
    drone = (np.sin(2 * np.pi * mtof(38) * t) + 0.5 * np.sin(2 * np.pi * mtof(50) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.25 * t)))
    drone *= np.minimum(1, t / 1.2) * np.minimum(1, (5.2 - t) / 0.3)
    place(S, drone, 0.0, 0.10)
    for at, m in [(0.75, 62), (1.25, 65), (1.55, 69), (1.75, 68)]:
        place(S, pizz(mtof(m), 0.5), at, 0.22, -0.2)
    for at, m in [(2.6, 62), (3.0, 61), (3.4, 62), (3.8, 65), (4.2, 64), (4.45, 62)]:
        place(S, pizz(mtof(m - 12), 0.5), at, 0.2, 0.15)
    # --- 5–9.6 s: the march of the tiles (D minor, comic)
    mel = [62, 64, 65, 67, 69, 69, 70, 69, 67, 65, 64, 62, 64, 65, 64, 61, 62, 64, 65, 67, 69, 72, 70, 69, 67, 64, 65, 64, 62, 0, 62, 0]
    for i in range(36):
        at = 5.0 + i * BEAT / 2
        if at > 9.45:
            break
        m = mel[i % len(mel)]
        if m:
            place(S, reed(mtof(m), 0.2), at, 0.13, 0.25)
    for i in range(10):
        at = 5.0 + i * BEAT
        if at > 9.45:
            break
        place(S, pizz(mtof(D - 12 if i % 2 == 0 else D - 17), 0.45), at, 0.32, -0.1)
        place(S, kick(), at, 0.18 if i % 2 == 0 else 0.0)
        if i % 2 == 1:
            place(S, brush(), at, 0.12, 0.3)
    # --- 10.6 s: title hit
    place(S, pad([mtof(38), mtof(45), mtof(50), mtof(53)], 1.6, 1.0, 0.01, 1.2, 900), 10.67, 0.22)
    # --- 11–17 s: investigation pulse
    for i in range(48):
        at = 11.0 + i * BEAT / 4
        f = mtof(38 + (0 if (i // 8) % 4 != 3 else 1))
        place(S, pizz(f, 0.14) * 0.9, at, 0.16, -0.1)
        if i % 2 == 1:
            place(S, hat(), at, 0.05, 0.4)
    for at in (11.0, 12.67, 14.07, 15.67):
        place(S, kick(), at, 0.34)
        place(S, pad([mtof(50), mtof(53), mtof(56)], 1.2, 1, 0.01, 1.0, 1200), at, 0.05)
    # --- 17–24 s: the system (bright D major arps)
    arp = [62, 66, 69, 74, 69, 66, 62, 66]
    prog_ = [[50, 54, 57], [55, 59, 62], [57, 61, 64], [50, 54, 57]]
    for i in range(56):
        at = 17.0 + i * BEAT / 4
        if at > 23.9:
            break
        bar = int((at - 17.0) // 2) % 4
        shift = [0, 5, 7, 0][bar]
        place(S, marimba(mtof(arp[i % 8] + shift), 0.5), at, 0.13, 0.35 if i % 2 else -0.35)
    for b in range(4):
        place(S, pad([mtof(m) for m in prog_[b]], 2.1, 1, 0.4, 0.5, 1800), 17.0 + b * 2, 0.07)
    # --- 24–34 s: the transformation (warm, full)
    chords = [[50, 54, 57, 62], [43, 55, 59, 62], [47, 54, 59, 62], [45, 52, 57, 61], [50, 54, 57, 62]]
    for b, ch in enumerate(chords):
        at = 24.0 + b * 2
        place(S, pad([mtof(m) for m in ch], 2.3, 1, 0.3, 0.6, 2400), at, 0.12)
        place(S, pizz(mtof(ch[0] - 12), 0.9), at, 0.3)
        place(S, pizz(mtof(ch[0] - 12), 0.9), at + 1.0, 0.22)
        for k in range(16):
            n = ch[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]] + 12
            place(S, marimba(mtof(n), 0.45), at + k * BEAT / 4, 0.11, -0.4 if k % 2 else 0.4)
        for k in range(4):
            place(S, kick(), at + k * BEAT, 0.16)
            if k % 2 == 1:
                place(S, brush(d=0.12), at + k * BEAT, 0.07, 0.2)
    # --- 34–36.5 s: gentle hold
    place(S, pad([mtof(m) for m in (50, 57, 62, 66)], 2.8, 1, 0.5, 1.2, 2000), 34.0, 0.11)
    for at, m in [(34.4, 74), (34.9, 78), (35.4, 81), (35.9, 79)]:
        place(S, marimba(mtof(m), 0.8), at, 0.09, 0.2)
    # --- 36.5–40 s: end card sting
    place(S, kick(), 36.5, 0.35)
    place(S, pad([mtof(m) for m in (38, 50, 57, 62, 66, 69)], 3.5, 1, 0.05, 2.2, 2600), 36.5, 0.16)
    for k, m in enumerate((74, 78, 81, 86)):
        place(S, bell(mtof(m), 3.0), 37.87 + k * 0.05, 0.08, -0.3 + k * 0.2)
    # master: gentle glue + fade
    S[:, 0] = reverb(S[:, 0], 1.6, 0.18)
    S[:, 1] = reverb(S[:, 1], 1.7, 0.18)
    fade = np.ones(N)
    fade[-int(0.8 * SR):] = np.linspace(1, 0, int(0.8 * SR))
    S *= fade[:, None]
    return norm(S, 0.8)


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
    }
    # crowd stems, timed from the same formulas the scenes use
    # Scene 02 ripple: same formula as tPop() in Scene02Resignation.tsx (relative to scene start)
    stuck = {(1, -2.5), (2, -2.5), (-2, 1.5), (-2, 2.5), (2, 2.5), (0, -2.5)}
    pops = sorted(
        (3 + np.hypot(x, zc + 2.5) * 4.5) / FPS
        for zc in np.arange(-2.5, 3.0, 1.0)
        for x in range(-2, 3)
        if (x, float(zc)) not in stuck
    )
    sfx["floor-ripple"] = sfx_ripple(pops, max(pops) + 0.4)
    sfx["march"] = sfx_march(4.6)
    sfx["flip-cascade"] = sfx_ripple([k * 1.6 / FPS + 0.33 for k in range(16)], 1.4)
    sfx["ripple-long"] = sfx_ripple(sorted(rng.uniform(0, 1.3, 40)), 1.8)
    sfx["steps-hero"] = sfx_steps([k * 0.16 for k in range(7)], 1.3)
    for name, y in sfx.items():
        write(os.path.join(SFX, f"{name}.wav"), y)
    print("wrote", len(sfx), "sfx + score + placeholder")


if __name__ == "__main__":
    main()
