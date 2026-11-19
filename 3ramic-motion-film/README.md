# The Tiles That Quit — «پروندهٔ استعفای سرامیک‌ها» — 3ramic

**Main documentation is in Persian: [README.fa.md](README.fa.md).** This page is a short English summary.

A 39.7-second, 1080×1920 (9:16), 30 fps Instagram Reel in Persian, built entirely in code with
Remotion, React and Three.js and rendered locally (no paid services). The floor tiles of a badly
coordinated 6 m² bathroom resign; a rubber-duck detective finds three suspects (a loud pattern,
black grout, an oversized vanity); the same room is re-done with coordinated choices — same
camera, same 6 m² — and the tile takes its job back… with a bonus. Tagline: **«هر سرامیکی، جای خودش.»**

| | |
|---|---|
| Composition | `ThreeRamicFilm` (scenes in `Scenes/`, cover in `Instagram/Cover`, QA stills in `QA/QAFrames`) |
| Audio | 16 Persian lines, five different open-model voices, original score and effects, −14.5 LUFS / −1.5 dBTP |
| Brand rule | written `3ramic`, always spoken «سه‌رامیک» /serˈɑmik/ — never "three-ramic" |

```bash
npm ci                 # install the locked dependencies
npm run validate       # release checks
npm run studio         # Remotion Studio on http://localhost:3000
npm run render         # resumable 1080×1920 render -> out/3ramic-reel-1080x1920.mp4
npm run cover          # out/instagram/cover-1080x1920.jpg
npm run audio          # rebuild the mix (Python 3.9+ and numpy)
```

Honest status: the voices are synthetic and have **not been checked by a human listener**
(intelligibility was measured with Whisper: 0.98 per line, 0.96 through the final mix); the
official 3ramic colours and logo **could not be verified**, so the film uses neutral ink/paper
and a logo slot instead of inventing them. See `docs/QA-REPORT.md` and `docs/BRAND-VERIFICATION.md`.
