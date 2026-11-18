#!/usr/bin/env python3
"""
3RAMIC — score, sound design and final mix (numpy only, deterministic).

    node scripts/audio/export_cues.mjs        # cue frames from src/cues.ts
    python scripts/audio/build_audio.py       # -> public/audio/mix.wav (+ report)
    python scripts/audio/build_audio.py --stems

Inputs: src/data/timeline.json (where every line is), production/cues.json (every action
beat, exported from src/cues.ts) and the dialogue WAVs in public/audio/voice/.

Output: one stereo 48 kHz master that the film plays, mixed to about −14.5 LUFS
integrated with true peaks at or below −1.5 dBTP, plus production/qa/audio-report.json.

Everything audible except the voices is synthesised here (sounds.py): the music is an
original composition written for this timeline and the effects are generated, so there
is nothing to license. The score is built around the dialogue — its melodic notes are
only placed in the gaps between lines, and every line ducks it.
"""
import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dsp  # noqa: E402
import sounds as S  # noqa: E402
from dsp import SR  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
TARGET_LUFS = -14.5
CEILING_DBTP = -1.5

ap = argparse.ArgumentParser()
ap.add_argument("--stems", action="store_true", help="also write dialogue/music/sfx/ambience stems")
args = ap.parse_args()

TL = json.load(open(os.path.join(ROOT, "src", "data", "timeline.json"), encoding="utf-8"))
CUES = json.load(open(os.path.join(ROOT, "production", "cues.json"), encoding="utf-8"))
FPS = TL["fps"]
N = int(round(TL["durationInFrames"] / FPS * SR))
LINES = {l["id"]: l for l in TL["lines"]}
SC = {s["id"]: s for s in TL["scenes"]}
HOLD = TL["holds"]
H, SU, M, P, B = CUES["HOOK"], CUES["SUSPECTS"], CUES["MAKEOVER"], CUES["PAYOFF"], CUES["BRAND_CUES"]


def s_of(frame):
    return int(round(max(0, frame) / FPS * SR))  # cues before the first frame sound on frame 0


def db(g):
    return 10 ** (g / 20)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, sig, frame=None, t=None, gain_db=0.0, pan=0.0):
        """Mono sig is panned; stereo sig is added as is. Position by film frame or seconds."""
        start = s_of(frame) if frame is not None else int(round(t * SR))
        if sig.ndim == 1:
            sig = dsp.pan(sig, pan)
        if start >= N:
            return
        a, b = max(0, start), min(N, start + len(sig))
        self.x[a:b] += sig[a - start:b - start] * db(gain_db)


dialogue, music, sfx, amb = Bus(), Bus(), Bus(), Bus()

# ============================================================================ dialogue
VOICE_FX = {
    # speaker: (eq bands, compressor threshold, room wet)
    "tile": ([("hp", 110), ("peak", 3200, 1.0, 2.0), ("highshelf", 9000, 0.7, -1.5)], -26, 0.10),
    "detective": ([("hp", 75), ("peak", 320, 1.0, -2.0), ("peak", 2600, 1.0, 1.5)], -26, 0.09),
    "pattern": ([("hp", 100), ("peak", 4200, 1.0, 2.5)], -26, 0.12),
    "vanity": ([("hp", 55), ("lowshelf", 160, 0.7, 2.5), ("peak", 2400, 1.0, -1.0)], -24, 0.15),
    "narrator": ([("hp", 70), ("lowshelf", 130, 0.7, 1.0), ("peak", 3000, 1.0, 1.5)], -24, 0.0),
}
ROOM = dsp.room_ir(rt60=0.32, size=0.8, seed=5)
voiced = np.zeros(N)
for l in TL["lines"]:
    path = os.path.join(ROOT, "public", l["file"])
    if not os.path.exists(path):
        print("  ! missing voice:", l["file"], "(run voice_select.py)")
        continue
    x, sr = dsp.read_wav(path)
    x = x.mean(axis=1)
    if sr != SR:
        x = dsp.resample(x, sr, SR)
    bands, thr, wet = VOICE_FX[l["speaker"]]
    if l["id"] == "L09":
        # spoken while squashed flat against the lens: muffled, close
        bands = [("hp", 320), ("lp", 2600), ("peak", 1200, 1.2, 4.0)]
        wet = 0.02
        x = x * db(3.5)
    if l["id"] == "L12":
        # said from the inlay, far back in the shower
        bands = bands + [("lp", 7000)]
        wet = 0.24
    y = dsp.eq(x, *bands)
    y = dsp.compress(y, threshold_db=thr, ratio=2.6, attack=0.004, release=0.09, makeup_db=2.0)
    st = dsp.reverb(y, ROOM, wet) if wet > 0 else np.stack([y, y], axis=1)
    dialogue.add(st, frame=l["from"], gain_db=4.0)
    a = s_of(l["from"])
    voiced[a:a + len(x)] = np.maximum(voiced[a:a + len(x)], np.abs(x[: max(0, min(len(x), N - a))]))
    if s_of(l["from"]) + len(x) > N:
        print("  ! line", l["id"], "runs past the end of the film")

# sidechain: ducking gain from the dialogue itself (fast attack, slower release)
env = dsp.envelope(voiced, attack=0.03, release=0.28)
env = env / (np.max(env) + 1e-9)
speech = np.clip((20 * np.log10(env + 1e-6) + 38) / 18, 0, 1)  # 0 = silence, 1 = speaking
# look-ahead: the timeline knows when each line starts, so the bed is already down 120 ms
# before the first syllable (and comes back up 100 ms after the last), like a fader ride
ride = np.zeros(N)
ramp = int(0.08 * SR)
for l in TL["lines"]:
    a, b = max(0, s_of(l["from"]) - int(0.12 * SR)), min(N, s_of(l["to"]) + int(0.10 * SR))
    ride[a:b] = 1.0
    r0 = max(0, a - ramp)
    ride[r0:a] = np.maximum(ride[r0:a], np.linspace(0, 1, a - r0) if a > r0 else 0)
    r1 = min(N, b + ramp)
    ride[b:r1] = np.maximum(ride[b:r1], np.linspace(1, 0, r1 - b) if r1 > b else 0)
speech = np.maximum(speech, ride * 0.85)
duck_music = db(-15.0 * speech)
duck_sfx = db(-4.0 * speech)
duck_amb = db(-4.0 * speech)

# ============================================================================ score
BPM = 100
BEAT = 60 / BPM  # 0.6 s = 18 frames


def beats(start_frame, end_frame):
    t0 = start_frame / FPS
    t1 = end_frame / FPS
    k = 0
    while t0 + k * BEAT < t1 - 1e-6:
        yield k, t0 + k * BEAT
        k += 1


def speech_free(t, dur=0.35):
    """True if no line is being spoken in [t, t + dur] (melody goes in the gaps)."""
    a, b = int(t * SR), int(min(N, (t + dur) * SR))
    return a < N and (b <= a or speech[a:b].max() < 0.3)


# chord tables: (bass walk, chord tones for stabs/pads)
MINOR_PROG = [
    (["D2", "F2", "A2", "C3"], ["D3", "F3", "A3", "C4"]),
    (["A#1", "D2", "F2", "A2"], ["A#2", "D3", "F3", "A3"]),
    (["G1", "A#1", "D2", "F2"], ["G2", "A#2", "D3", "F3"]),
    (["A1", "C#2", "E2", "G2"], ["A2", "C#3", "E3", "G3"]),
]
MAJOR_PROG = [
    (["D2", "A2"], ["D3", "F#3", "A3", "D4"], ["D4", "F#4", "A4", "D5"]),
    (["G1", "D2"], ["G2", "B2", "D3", "G3"], ["G4", "B4", "D5", "G5"]),
    (["B1", "F#2"], ["B2", "D3", "F#3", "B3"], ["B4", "D5", "F#5", "B5"]),
    (["A1", "E2"], ["A2", "C#3", "E3", "A3"], ["A4", "C#5", "E5", "A5"]),
]
MOTIF_MINOR = [("D5", 0.0), ("F5", 0.75), ("E5", 1.0), ("D5", 1.5), ("A4", 2.0)]
MOTIF_MAJOR = [("D5", 0.0), ("F#5", 0.75), ("E5", 1.0), ("D5", 1.5), ("A5", 2.0)]

# ---- 1 · hook sting: the tile pops out shouting
music.add(S.stab([S.hz("D3"), S.hz("F3"), S.hz("A3"), S.hz("D4")], 0.55), frame=H["pop"], gain_db=-15)
music.add(S.pluck_bass(S.hz("D2"), 1.0, seed=3), frame=H["pop"], gain_db=-8)
music.add(S.rim(vel=0.8), frame=H["pop"], gain_db=-14)
# letter splats the lens: low "uh-oh" and silence of music until the detective appears
music.add(S.pluck_bass(S.hz("A1"), 1.2, seed=4, bright=0.3), frame=H["hit"] + 3, gain_db=-9)
# the detective is revealed: a three-note vibes "reveal"
for k, n in enumerate(("D5", "F5", "A5")):
    music.add(S.vibes(S.hz(n), 2.0, 0.8), frame=H["clear"] + k * 4, gain_db=-17, pan=-0.2 + 0.2 * k)

# ---- 2 · the mystery groove, from the reveal until the solution is named
g_from, g_to = H["clear"] + 12, M["brandCut"]
thin_from = SC["makeover"]["from"]  # under the explanation the groove thins out
bar_of = lambda k: (k // 4) % 4
for k, t in beats(g_from, g_to):
    bass_walk, chord = MINOR_PROG[bar_of(k)]
    frame = t * FPS
    thin = frame >= thin_from
    note = bass_walk[k % 4] if not thin else bass_walk[0]
    if not thin or k % 4 == 0:
        music.add(S.pluck_bass(S.hz(note), 0.95 if not thin else 2.2, seed=10 + k, bright=0.55), t=t, gain_db=-9 if not thin else -11)
    if not thin:
        if k % 2 == 1:
            music.add(S.brush(0.24, seed=20 + k, vel=0.8), t=t, gain_db=-21, pan=0.25)
        if frame >= SC["suspects"]["from"] and k % 2 == 1:
            music.add(S.snap(seed=30 + k), t=t + 0.01, gain_db=-22, pan=-0.35)
        if k % 4 == 3:
            music.add(S.rim(seed=40 + k, vel=0.6), t=t + BEAT / 2, gain_db=-24, pan=0.3)
    # the detective's motif, only in gaps between lines, every second bar
    if not thin and k % 8 == 0:
        for n, off in MOTIF_MINOR:
            tt = t + off * BEAT
            if tt < g_to / FPS and speech_free(tt, 0.3):
                music.add(S.vibes(S.hz(n), 1.6, 0.7), t=tt, gain_db=-19, pan=0.2)
# thin section: a held pad under the diagnosis, rising Dm -> Bb -> C
seg = (M["brandCut"] - thin_from) / FPS
for i, chord in enumerate((["D3", "F3", "A3"], ["A#2", "D3", "F3"], ["C3", "E3", "G3"])):
    music.add(S.pad([S.hz(n) for n in chord], seg / 3 + 0.8, attack=0.4, release=0.8, bright=0.25, seed=50 + i), frame=thin_from + i * seg / 3 * FPS, gain_db=-16)

# mugshot stabs on the three suspect tags, a bonk when the detective hits the lens
for tag, root in ((SU["tag1"], "D3"), (SU["tag2"], "F3"), (SU["tag3"], "A2")):
    r = S.hz(root)
    music.add(S.stab([r, r * 6 / 5, r * 3 / 2, r * 9 / 5], 0.5), frame=tag, gain_db=-14)
    music.add(S.cymbal(0.5, seed=tag, vel=0.4), frame=tag, gain_db=-22)
music.add(S.stab([S.hz("C#3"), S.hz("G3"), S.hz("A#3")], 0.35, 0.4), frame=SU["smack"], gain_db=-15)

# ---- 3 · «کارِ سه‌رامیکه!»: minor turns major
L11 = LINES["L11"]
eureka = L11["to"] + 1  # after «سه‌رامیکه», never on top of the brand word
for k, n in enumerate(("D5", "F#5", "A5", "D6")):
    music.add(S.celesta(S.hz(n), 1.6, 0.9), frame=eureka + k * 3, gain_db=-14, pan=-0.3 + 0.2 * k)
music.add(S.pad([S.hz(n) for n in ("D3", "F#3", "A3", "D4")], (M["T0"] - eureka) / FPS + 0.6, attack=0.25, release=0.6, bright=0.45, seed=60), frame=eureka, gain_db=-15)
music.add(S.cymbal(1.2, seed=61, vel=0.5, swell=True), frame=M["T0"] - 36, gain_db=-18)

# ---- 4 · the box opens: riser and sparkle into the transformation
music.add(S.riser((M["T0"] - M["boxOpen"]) / FPS + 0.2, vel=0.7), frame=M["boxOpen"], gain_db=-17)
music.add(S.shimmer(1.4, S.hz("A5"), 0.8), frame=M["boxOpen"], gain_db=-15)

# ---- 5 · transformation: bright I–IV–vi–V groove that builds to the reveal
T0, T1 = M["T0"], HOLD["transform"]["to"]
C0, C1 = HOLD["compare"]["from"], HOLD["compare"]["to"]
for k, t in beats(T0, C1):
    bassn, chord, arp = MAJOR_PROG[(k // 4) % 4]
    frame = t * FPS
    build = min(1.0, (frame - T0) / max(1.0, M["warm"][0] - T0))
    climax = frame >= M["warm"][0]
    in_fill = M["leap"][0] <= frame < M["leap"][1]
    L12 = LINES["L12"]
    stop = L12["from"] - 3 <= frame < L12["to"] + 2  # the groove stops for «این‌جا جای منه!»
    music.add(S.pluck_bass(S.hz(bassn[0] if k % 2 == 0 else bassn[1]), 0.8, seed=100 + k, bright=0.6), t=t, gain_db=-9)
    for e in range(2 if not stop else 0):  # marimba eighths climbing the chord
        n = arp[(k * 2 + e) % 4]
        music.add(S.marimba(S.hz(n), 0.5, 0.75 + 0.25 * build), t=t + e * BEAT / 2, gain_db=-17 + 3 * build, pan=-0.3 if e == 0 else 0.3)
    if frame >= M["walls"][0] and k % 2 == 1 and not in_fill and not stop:
        music.add(S.clap(seed=110 + k), t=t, gain_db=-20, pan=0.1)
    if climax and k % 2 == 0 and not in_fill and not stop:
        music.add(S.kick(0.9), t=t, gain_db=-12)
    if k % 4 == 0:
        bar = BEAT * 4
        music.add(S.pad([S.hz(n) for n in chord], bar + 0.5, attack=0.25, release=0.5, bright=0.35 + 0.35 * build, seed=120 + k), t=t, gain_db=-17 + 2 * build)
# fill into the patterned tile's leap, and the big landing
music.add(S.snare_roll((M["leap"][1] - M["leap"][0]) / FPS), frame=M["leap"][0], gain_db=-15)
music.add(S.cymbal(1.1, seed=130, vel=0.9), frame=M["leap"][1], gain_db=-17)
music.add(S.stab([S.hz(n) for n in ("D3", "A3", "D4", "F#4", "A4")], 0.6, 0.8), frame=M["leap"][1], gain_db=-13)
music.add(S.kick(1.0), frame=M["leap"][1], gain_db=-9)
music.add(S.shimmer(1.6, S.hz("D6"), 0.8), frame=M["done"], gain_db=-16)
# compare ends on a soft cadence: G -> D
music.add(S.pad([S.hz(n) for n in ("G2", "B2", "D3", "G3")], 1.0, 0.1, 0.6, 0.4, 140), frame=C1 - 30, gain_db=-17)

# ---- 6 · payoff: warm and quiet, then STOP for the punchline, then the button
pay_from, cross = SC["payoff"]["from"], P["cross"]
music.add(S.pad([S.hz(n) for n in ("D3", "F#3", "A3", "C#4")], (cross - 2 - pay_from) / FPS, attack=0.3, release=0.25, bright=0.3, seed=150), frame=pay_from, gain_db=-17)
for k, t in beats(pay_from, cross - 4):
    if k % 2 == 0:
        music.add(S.pluck_bass(S.hz("D2" if (k // 4) % 2 == 0 else "B1"), 0.9, seed=160 + k, bright=0.4), t=t, gain_db=-12)
    if k % 4 == 2 and speech_free(t, 0.4):
        music.add(S.vibes(S.hz("F#5" if k % 8 == 2 else "A5"), 1.4, 0.6), t=t, gain_db=-21, pan=0.25)
# (silence from the cross-arms to the squeak: no music at all — the joke lands dry)
music.add(S.pluck_bass(S.hz("D2"), 0.6, seed=170, bright=0.7), frame=P["squeak"] + 4, gain_db=-11)
music.add(S.rim(vel=0.9), frame=P["squeak"] + 4, gain_db=-15)
music.add(S.vibes(S.hz("A4"), 0.8, 0.8), frame=P["squeak"] + 10, gain_db=-17)
music.add(S.vibes(S.hz("D5"), 1.4, 0.8), frame=P["squeak"] + 16, gain_db=-17)

# ---- 7 · brand sting: the detective's motif in major, the final chord on the click
br_from, end = SC["brand"]["from"], TL["durationInFrames"]
music.add(S.pad([S.hz(n) for n in ("D3", "A3", "D4", "F#4")], (end - br_from) / FPS + 0.2, attack=0.5, release=1.2, bright=0.4, seed=180), frame=br_from, gain_db=-17)
tt = br_from / FPS + 0.15
for n, off in MOTIF_MAJOR:
    if speech_free(tt + off * BEAT * 0.8, 0.25):
        music.add(S.vibes(S.hz(n), 1.8, 0.7), t=tt + off * BEAT * 0.8, gain_db=-19, pan=0.15)
music.add(S.stab([S.hz(n) for n in ("D3", "A3", "D4", "F#4")], 1.2, 0.5), frame=B["click"], gain_db=-15)
music.add(S.pluck_bass(S.hz("D2"), 1.6, seed=190, bright=0.5), frame=B["click"], gain_db=-9)
music.add(S.celesta(S.hz("D6"), 1.8, 0.7), frame=B["click"] + 2, gain_db=-17)
music.add(S.celesta(S.hz("A6"), 1.6, 0.5), frame=B["click"] + 8, gain_db=-20)

# ============================================================================ sound effects
def clack(pitch=1.0, vel=1.0, seed=41):
    return S.tile_clack(vel, seed, pitch)


# 1 · hook
sfx.add(clack(1.1), frame=H["pop"], gain_db=-6)
sfx.add(S.whoosh(0.25, 400, 2600, seed=200, vel=0.7), frame=H["pop"], gain_db=-14)
sfx.add(S.paper(0.3, seed=201), frame=H["letterOut"], gain_db=-16, pan=0.3)
sfx.add(S.whoosh(0.22, 600, 3400, seed=202), frame=H["throwAt"] + 2, gain_db=-13, pan=0.25)
sfx.add(S.thud(0.2, 150, 1.0, seed=203), frame=H["hit"], gain_db=-8)
sfx.add(S.paper(0.14, seed=204, vel=1.4), frame=H["hit"], gain_db=-9)
sfx.add(S.paper(0.6, seed=205, vel=0.6), frame=H["peel"], gain_db=-17)
sfx.add(S.whoosh(0.32, 250, 1800, seed=206, vel=0.8), frame=H["reveal"], gain_db=-15)
sfx.add(S.stamp(), frame=H["stamp"], gain_db=-7)
# 2 · suspects
sfx.add(clack(1.35, seed=210), frame=SU["patternPop"], gain_db=-9, pan=-0.5)
sfx.add(S.whoosh(0.3, 500, 2400, seed=211, vel=0.6), frame=SU["patternPop"] + 2, gain_db=-16, pan=-0.4)
sfx.add(clack(1.2, seed=212), frame=SU["patternPop"] + 11, gain_db=-14, pan=-0.4)
for k in ("tag1", "tag2", "tag3"):
    sfx.add(S.shutter(), frame=SU[k], gain_db=-13)
sfx.add(S.light_switch(0.8), frame=SU["shades"] + 4, gain_db=-13, pan=0.1)
sfx.add(S.cloth(0.15, seed=213), frame=SU["shades"], gain_db=-18)
rng = np.random.default_rng(214)
for i in range(18):  # «هزار تیکه»: the floor ticks piece by piece
    sfx.add(S.ceramic_tick(rng.uniform(2200, 3600), rng.uniform(0.4, 0.8), seed=300 + i, dur=0.08), frame=SU["twitch"] + i * 1.1 + rng.uniform(0, 0.8), gain_db=-17, pan=rng.uniform(-0.6, 0.6))
sfx.add(S.creak(0.9, 90, seed=215), frame=SU["vanityCut"] + 2, gain_db=-11)
sfx.add(S.whoosh(0.2, 180, 900, seed=216), frame=SU["bump"], gain_db=-10)
sfx.add(S.thud(0.18, 110, 1.0, seed=217), frame=SU["bump"] + 4, gain_db=-9)
sfx.add(S.squeak(0.24, 1300, 1900, seed=218), frame=SU["smack"], gain_db=-10)
sfx.add(S.thud(0.2, 130, 0.9, seed=219), frame=SU["smack"], gain_db=-10)
sfx.add(S.squeak_slide(0.55), frame=SU["peel"], gain_db=-12)
# 3 · makeover
sfx.add(S.shimmer(0.5, S.hz("E6"), 0.5, seed=220), frame=M["brandCut"] + 4, gain_db=-22)
sfx.add(S.whoosh(0.35, 150, 700, seed=221, vel=0.8), frame=M["boxIn"], gain_db=-15, pan=-0.5)
sfx.add(S.thud(0.16, 115, 0.8, seed=222), frame=M["boxLand"], gain_db=-11, pan=-0.4)
sfx.add(S.cloth(0.18, seed=223, vel=1.2), frame=M["boxOpen"], gain_db=-14, pan=-0.4)
sfx.add(S.whoosh(0.6, 300, 2200, seed=224, vel=0.5), frame=M["samplesUp"][0], gain_db=-19, pan=-0.3)
sfx.add(S.creak(0.6, 110, seed=225), frame=M["vanityOut"][0], gain_db=-11, pan=-0.2)
sfx.add(S.whoosh(0.9, 180, 1300, seed=226, vel=0.7), frame=M["vanityOut"][0] + 5, gain_db=-15, pan=-0.2)
sfx.add(S.trowel((M["grout"][1] - M["grout"][0]) / FPS, seed=227), frame=M["grout"][0], gain_db=-14)
rng = np.random.default_rng(228)
w0, w1 = M["walls"]
for i in range(26):  # old wall tiles leaving in a wave
    sfx.add(S.ceramic_tick(rng.uniform(2600, 3900), rng.uniform(0.4, 0.7), seed=400 + i, dur=0.06), frame=w0 + i * (w1 - w0) * 0.55 / 26, gain_db=-23, pan=rng.uniform(-0.8, 0.8))
for i in range(10):  # large calm tiles setting in place
    sfx.add(clack(0.72, 0.7, seed=430 + i), frame=w0 + 8 + i * (w1 - w0 - 8) / 10, gain_db=-17, pan=rng.uniform(-0.7, 0.7))
sfx.add(S.glass_slide((M["glass"][1] - M["glass"][0]) / FPS + 0.1), frame=M["glass"][0], gain_db=-13, pan=0.45)
sfx.add(S.whoosh(0.4, 1400, 250, seed=231, vel=0.8), frame=M["vanityIn"][0], gain_db=-15, pan=-0.3)
sfx.add(S.thud(0.2, 92, 1.0, seed=232), frame=M["vanityIn"][0] + 11, gain_db=-9, pan=-0.3)
sfx.add(S.light_switch(), frame=M["warm"][0], gain_db=-12, pan=0.2)
for i, f in enumerate((520, 660, 780)):
    sfx.add(S.pop(0.9, f, seed=240 + i), frame=M["fixtures"][0] + i * 4, gain_db=-15, pan=-0.3 + 0.3 * i)
sfx.add(S.celesta(S.hz("A6"), 0.6, 0.6), frame=M["nicheTrim"], gain_db=-20, pan=0.5)
for i, n in enumerate(("D6", "F#6", "A6")):
    sfx.add(S.ceramic_tick(S.hz(n), 0.9, seed=250 + i, dur=0.3), frame=M["nicheTiles"][i], gain_db=-13, pan=0.5)
sfx.add(S.whoosh(0.55, 300, 3000, seed=253), frame=M["leap"][0], gain_db=-11, pan=0.2)
sfx.add(S.tile_place(0.9, seed=254), frame=M["leap"][1], gain_db=-9, pan=0.45)
sfx.add(S.whoosh(0.45, 400, 1800, seed=255, vel=0.6), frame=M["wipeIn"][0], gain_db=-15)
sfx.add(S.whoosh(0.45, 1800, 400, seed=256, vel=0.5), frame=M["wipeOut"][0], gain_db=-17)
# 4 · payoff
sfx.add(S.paper(0.25, seed=260), frame=P["letterUp"], gain_db=-16, pan=-0.3)
sfx.add(S.cloth(0.2, seed=261, vel=1.2), frame=P["cross"], gain_db=-13, pan=0.2)
sfx.add(S.squeak(0.34, 1150, 1650, seed=262), frame=P["squeak"], gain_db=-7, pan=-0.3)
# 5 · brand
sfx.add(S.footstep(seed=270), frame=B["walk"][0] + 6, gain_db=-18, pan=0.1)
sfx.add(S.footstep(seed=271), frame=B["walk"][0] + 16, gain_db=-18, pan=0.1)
sfx.add(S.whoosh(0.3, 900, 250, seed=272, vel=0.6), frame=B["lieDown"][0], gain_db=-17)
sfx.add(S.tile_place(1.0, seed=273), frame=B["click"], gain_db=-5)
sfx.add(S.cloth(0.2, seed=274), frame=B["hatTip"], gain_db=-18, pan=-0.3)

# ============================================================================ ambience
warm0, warm1 = M["warm"][0], M["warm"][1]
t = np.arange(N) / SR
w = np.clip((t * FPS - warm0) / max(1, warm1 - warm0), 0, 1)  # 0 cold .. 1 warm
fit = lambda a: np.concatenate([a, np.zeros((N - len(a),) + a.shape[1:])]) if len(a) < N else a[:N]
cold = fit(S.room_tone(N / SR + 0.01, seed=500, bright=0.7))
warmt = fit(S.room_tone(N / SR + 0.01, seed=510, bright=0.2))
amb.x += cold * db(-44) * (1 - w)[:, None] + warmt * db(-47) * w[:, None]
amb.x += dsp.pan(fit(S.hum(N / SR + 0.01, 100.0)), 0.1) * db(-60) * (1 - w)[:, None]
for fr in (H["clear"] + 30, SC["suspects"]["from"] + 140):
    amb.add(S.drip(0.8), frame=fr, gain_db=-30, pan=0.55)

# ============================================================================ mix + master
music.x *= duck_music[:, None]
sfx.x *= duck_sfx[:, None]
amb.x *= duck_amb[:, None]
fade = np.ones(N)
fl = int(0.5 * SR)
fade[-fl:] = np.linspace(1, 0, fl) ** 2  # last half-second rings out
mix = (dialogue.x + music.x + sfx.x + amb.x) * fade[:, None]
mix = dsp.compress(mix, threshold_db=-14, ratio=1.8, attack=0.02, release=0.25)
for it in range(4):
    lufs, _, _ = dsp.loudness(mix)
    mix *= db(TARGET_LUFS - lufs)
    mix = dsp.limit(mix, CEILING_DBTP + 0.2 if it < 3 else CEILING_DBTP)
lufs, lra, stmax = dsp.loudness(mix)
tp = dsp.true_peak_db(mix)

out_dir = os.path.join(ROOT, "public", "audio")
os.makedirs(out_dir, exist_ok=True)
dsp.write_wav(os.path.join(out_dir, "mix.wav"), mix)
gain_total = TARGET_LUFS - dsp.loudness((dialogue.x + music.x + sfx.x + amb.x) * fade[:, None])[0]
if args.stems:
    sd = os.path.join(ROOT, "production", "audio", "stems")
    os.makedirs(sd, exist_ok=True)
    for name, bus in (("dialogue", dialogue), ("music", music), ("sfx", sfx), ("ambience", amb)):
        dsp.write_wav(os.path.join(sd, f"{name}.wav"), np.clip(bus.x * fade[:, None] * db(gain_total), -1, 1))
# the score on its own (un-ducked levels are not kept: this is the music as it plays in the film)
os.makedirs(os.path.join(out_dir, "music"), exist_ok=True)
dsp.write_wav(os.path.join(out_dir, "music", "score.wav"), np.clip(music.x * fade[:, None] * db(gain_total), -1, 1))
# a small library of the generated effects, for anyone re-editing the film
lib = os.path.join(out_dir, "sfx")
os.makedirs(lib, exist_ok=True)
for name, sig in (
    ("tile-click-into-place", S.tile_place(1.0, seed=273)), ("tile-pop", clack(1.1)), ("rubber-duck-squeak", S.squeak(0.34, 1150, 1650, seed=262)),
    ("rubber-squeak-slide", S.squeak_slide(0.55)), ("paper-splat", S.paper(0.14, seed=204, vel=1.4) + S.pad_len(S.thud(0.2, 150, 1.0, seed=203), int(0.14 * SR))),
    ("rubber-stamp", S.stamp()), ("mugshot-shutter", S.shutter()), ("wood-creak", S.creak(0.9, 90, seed=215)), ("grout-trowel", S.trowel(1.3, seed=227)),
    ("glass-slide", S.glass_slide(0.8)), ("whoosh", S.whoosh(0.45, 300, 2600, seed=253)), ("sparkle", S.shimmer(1.2, S.hz("A5"), 0.8)), ("drip", S.drip(0.8)),
):
    pk = np.max(np.abs(sig)) + 1e-9
    dsp.write_wav(os.path.join(lib, name + ".wav"), sig / pk * db(-3))

# ============================================================================ report
per_line = []
for l in TL["lines"]:
    a, b = s_of(l["from"]), min(N, max(s_of(l["to"]), s_of(l["from"]) + int(0.45 * SR)))
    d = dsp.loudness(dialogue.x[a:b])[0]
    per_line.append({"id": l["id"], "dialogueLUFS": round(d, 1), "overMusicLU": round(d - dsp.loudness(music.x[a:b])[0], 1), "overSfxLU": round(d - dsp.loudness(sfx.x[a:b])[0], 1)})
report = {
    "file": "public/audio/mix.wav",
    "seconds": round(N / SR, 3),
    "sampleRate": SR,
    "channels": 2,
    "integratedLUFS": round(lufs, 2),
    "loudnessRangeLU": round(lra, 2),
    "maxShortTermLUFS": round(stmax, 2),
    "truePeakDBTP": round(tp, 2),
    "targets": {"integratedLUFS": [-16, -14], "truePeakDBTP_max": -1.0},
    "pass": {"loudness": bool(-16 <= lufs <= -14), "truePeak": bool(tp <= -1.0)},
    "mono": dsp.mono_report(mix),
    "dialogueClarity": {"note": "Loudness of each spoken line minus the music / effects playing under it (LU). 10+ is comfortably clear on phone speakers.",
                        "minOverMusicLU": min(p["overMusicLU"] for p in per_line), "minOverSfxLU": min(p["overSfxLU"] for p in per_line), "lines": per_line},
    "lines": [{"id": l["id"], "from": l["from"], "to": l["to"], "endsBeforeFilmEnd": bool(l["to"] <= TL["durationInFrames"])} for l in TL["lines"]],
}
os.makedirs(os.path.join(ROOT, "production", "qa"), exist_ok=True)
json.dump(report, open(os.path.join(ROOT, "production", "qa", "audio-report.json"), "w", encoding="utf-8"), indent=1)
c = report["dialogueClarity"]
print(f"mix: {N / SR:.2f} s  {lufs:.2f} LUFS  LRA {lra:.1f} LU  TP {tp:.2f} dBTP  mono drop {report['mono']['monoDropLU']} LU  every line ≥ {c['minOverMusicLU']} LU over music, ≥ {c['minOverSfxLU']} LU over effects")
