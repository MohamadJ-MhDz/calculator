# QA report — «پروندهٔ استعفای سرامیک‌ها» release master

Everything below was measured or looked at in the build environment. Where a check needs a human
(listening, brand approval), it is marked **unverified** — nothing here is a fabricated listening
test.

## Inputs

- **No attachment** was present in the session: neither the reference video `3ramic-final(4).mp4`
  nor any `3ramic-case06-*` source ZIP. The only editable source was the repository's own
  `3ramic-motion-film` project (the film the reference describes), which was rebuilt here.
- Official brand site unreachable (see `BRAND-VERIFICATION.md`).

## Release-blocking checklist (from the brief)

| Blocker | Status | Evidence |
|---|---|---|
| Silent character | ✔ resolved | 16 lines, every character speaks; recordings in `public/audio/voice/` |
| Wrong brand pronunciation | ✔ | phonemes `serˈɑmik` in L11/L16; Whisper heard «سرامیک» in both (match 1.00); `npm run validate` blocks "three/tri/sri" |
| Inaccurate logo | ✔ (none invented) | logo slot shows the plain name until the official file is supplied |
| Invented colours | ✔ (none claimed) | `colors.*` are `null`, status `unverified`; validator blocks colours while unverified; `#FF703D` removed |
| Low resolution | ✔ | native 1080×1920, 30 fps; the delivered MP4 is 1080×1920, 30/1 fps, 1191 frames |
| Broken Persian | ✔ | Vazirmatn/Lalezar, `dir="rtl"`; brand/suffix bidi checked («کارِ 3ramic ه!»); see stills |
| Audio cut-off | ✔ | no line overlaps another or the film's end (validator) |
| Missing scene | ✔ | five scenes cover frames 0–1190 without gaps |
| Confusing transformation | ✔ (see visual QA) | one locked camera, changes in a readable order, same-camera before/after wipe |
| Missing dependencies | ✔ | `package-lock.json`, fonts vendored, mix and voices included; `npm ci` |
| Unfinished animation | ✔ | all scenes animated end to end (contact sheet) |
| Project cannot render locally | ✔ | full render completed here with `npm run render`: `out/3ramic-reel-1080x1920.mp4`, H.264 1080×1920 30 fps, 1191 frames, 39.70 s, stereo AAC 48 kHz, 91.6 MB; about 45 min on 4 CPU cores with software WebGL, resumed twice after interruptions |

## Audio QA (measured)

| Measure | Result | Target |
|---|---|---|
| Integrated loudness (mix.wav) | −14.52 LUFS | −16 … −14 |
| True peak (4× oversampled) | −1.50 dBTP | ≤ −1 |
| Loudness range | 5.6 LU | — |
| Mono fold-down | −0.1 LU, L/R correlation 0.96 | small loss |
| Dialogue over music, every line | ≥ 9.9 LU | comfortably clear |
| Dialogue over effects, every line | ≥ 8.5 LU | comfortably clear |
| Intelligibility of chosen takes (Whisper large-v3-turbo) | mean 0.984 (every line ≥ 0.90) | — |
| Intelligibility through the finished mix | mean 0.96 (hook 1.00, suspects 0.94, makeover 0.97, payoff 0.88, brand 1.00) | — |
| Delivered MP4 audio (AAC decoded) | −14.54 LUFS, −1.34 dBTP, mono −0.1 LU | same targets |
| Intelligibility in the delivered MP4 | mean 0.968 (hook 1.00, suspects 0.98, makeover 0.97, payoff 0.88, brand 1.00 — «سرامیک هر سرامیکی جای خودش») | — |

Files: `production/qa/audio-report.json`, `production/qa/dialogue-in-mix.json`,
`production/voice/VOICE-REPORT.md`, `production/voice/audition.json`.

**Unverified:** emotional delivery and comic timing of the synthetic voices. They are neutral
reading voices; rate, pauses and the models' intonation variability were tuned per line and the
clearest take was chosen, but no one has listened to judge whether the lines are funny. Music
taste and effect quality were checked only by measurement (levels, spectrum, masking), not by ear.

## Visual QA

Key moments were rendered as stills (`QAFrames` composition) and checked; the final evidence was
extracted from the delivered MP4 itself: `docs/qa/contact-sheet.jpg` (44 moments) and
`docs/qa/contact-sheet-phone-size.jpg` (the same at phone-thumbnail size); the cover is
`docs/qa/cover-1080x1920.jpg`. Fixes made after the first pass:

- Suspect 1 re-framed on the speaking patterned tile; the hole it leaves now reads as a missing tile.
- The diagnosis is played on the speaker (the detective faced away from camera before), followed
  by a punch-in for «کارِ 3ramic ه!».
- Brand card: tagline on one line, CTA on its own line, all inside the Instagram safe area; the
  detective fully in frame for the final hat-tip.
- Finished room: greige wall tiles and a bright mirror (it read white-on-white and grey before).
- First frame: the tile is already springing out of the floor.
- Compare labels follow Persian reading order («قبل» right, «بعد» left).

Silent viewing: the story reads without sound — burned-in subtitles timed from the recorded
speech, the «استعفانامه» letter, numbered suspect tags, «قبل/بعد», «همون ۶ متر», the brand card.

## Scores (honest, 1–10)

| Area | Score | Why |
|---|---|---|
| Story clarity | 8 | one cause-and-effect chain; every scene serves it |
| Character readability | 8 | clear faces and silhouettes at phone size; the duck can dominate close shots |
| Transformation (hero shot) | 7 | readable and same-camera, but dense at 4.2 s |
| Persian text and RTL | 9 | checked in stills; native-speaker proofreading still recommended |
| Dialogue intelligibility | 8 | measured, not listened to |
| Voice acting | unverified (likely 4–5) | synthetic neutral voices; record actors for release |
| Music and effects | unverified by ear (technically 8) | levels, masking and loudness measured |
| Brand identity | unverified | no official logo/colours available |
| Technical delivery | 9 | 1080×1920/30, loudness, true peak, validation, resumable render |
| Length | 7 | 39.7 s vs 32–38 s target |

## Recommended before publishing

1. Record the 16 lines with actors (`production/acting-direction.fa.md`), drop them in, run
   `npm run timeline && npm run audio && npm run validate`, render.
2. Supply the official logo and colour codes (`docs/BRAND-VERIFICATION.md`).
3. One native-speaker read of all on-screen Persian.
4. Listen to the whole film on a phone speaker and on headphones.
