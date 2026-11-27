# QA report — «پروندهٔ استعفای سرامیک‌ها» release 2.1

Everything below was measured or looked at in the build environment. Nobody has *listened*
to the film here: where a check needs ears (acting, comic timing, music taste) it is marked
**unverified**. No listening test is claimed.

## Inputs

- No attachment was present (no reference MP4, no `3ramic-case06-*` source ZIP); the repository's
  own `3ramic-motion-film` project was rebuilt.
- The official brand site was unreachable (see `BRAND-VERIFICATION.md`).

## The 25 issues from the audit of release 2.0 — status

| # | Issue | Status | How it was checked |
|---|---|---|---|
| 1 | Foreign accent on 4 lines (heard as English/Turkish) | ✔ fixed | Persian-only voices; Whisper language ID ≥ 0.98 Persian on every multi-word line (one-word «چرا؟!» is too short for language ID; its transcript is exact) |
| 2 | Wrong verb stress | ✔ fixed | natural stress used where it measured clearer (L01, L10); others kept where the model's own convention was clearer |
| 3 | Mis-heard words | ✔ improved | every line ≥ 0.94 transcript match after shaping (was down to 0.71) |
| 4 | Questions fell like statements | ✔ fixed | final-word pitch now rises: «استعفاتو پس می‌گیری؟» 105 → 145 Hz, «هزار تیکه؟!» → 153 Hz, «چرا؟!» → 189 Hz |
| 5 | Flat emotion | ◐ improved | wider pitch range on emotional lines; real acting still needs actors (**unverified by ear**) |
| 6 | Detective pitch 72–129 Hz | ✔ fixed | now 106–117 Hz on all his lines |
| 7 | Uneven pace | ✔ improved | detective 10 % quicker; slowest lines lifted |
| 8 | Music/effects quality | **unverified by ear** | levels, masking and loudness measured |
| 9 | «کارِ 3ramic ه!» looked like a typo | ✔ fixed | line is now «باید بریم سراغِ 3ramic!» |
| 10 | «اینجا»/«این‌جا» | ✔ fixed | one spelling |
| 11 | Stamp faint, ~3 frames | ✔ fixed | lands in the pause after «خب…», held ~1 s, solid ink |
| 12 | Subtitles over mouths | ✔ fixed | duck close-ups and vanity re-framed; mouths above the subtitle lane (stills) |
| 13 | Empty brand card | ✔ fixed | card grows with its content |
| 14 | CTA without "where" | ✔ fixed | «مدل‌های هماهنگ رو توی سایت ببین» + `3ramic.ir` |
| 15 | L13 text mismatch | ✔ fixed | display and speech text identical |
| 16 | Tiny shouting mouth | ✔ fixed | larger mouth geometry |
| 17 | Hat hid the duck's face; twitch invisible | ✔ fixed | frontal camera; tiles visibly lift and tilt |
| 18 | Flash looked like a glitch | ✔ fixed | 3 frames, 22 % |
| 19 | Unclear who says «اینجا جای منه!» | ✔ fixed | close-up on the framed inlay |
| 20 | Main tile seen from behind | ✔ fixed | characters face the camera in wide shots |
| 21 | Samples looked like paper | ✔ fixed | greige, oak, grout and pattern samples with darker edges |
| 22 | Payoff opened on the tile's back | ✔ fixed | starts facing us |
| 23 | Duck cut off in the two-shot | ✔ fixed | re-framed |
| 24 | Final image too small | ✔ fixed | brand camera pushes in on the slot |
| 25 | Towel snap, jagged wall strip | ✔ fixed | colours blend; right wall leaves with the others |

## Audio (measured)

| Measure | Result | Target |
|---|---|---|
| Integrated loudness (mix.wav) | −14.52 LUFS | −16 … −14 |
| True peak | −1.50 dBTP | ≤ −1 |
| Mono fold-down | −0.09 LU | small |
| Every line over the music | ≥ 10.3 LU | clear on a phone |
| Every line over the effects | ≥ 9.0 LU | clear on a phone |
| Clarity per line after shaping (Whisper) | mean 0.987, every line ≥ 0.94 | — |
| Clarity through the finished mix | mean 0.973 (hook 0.95, suspects 0.98, makeover 0.98, payoff 0.96, brand 1.00) | — |
| Delivered MP4 audio (AAC decoded) | −14.55 LUFS, −1.29 dBTP, mono −0.09 LU | same targets |
| Clarity in the delivered MP4 | mean 0.969 (hook 0.95, suspects 0.97, makeover 0.97, payoff 0.96, brand 1.00 — «سرامیک هر سرامیکی جای خودش») | — |

Files: `production/qa/audio-report.json`, `production/qa/dialogue-in-mix.json`,
`production/voice/VOICE-REPORT.md`, `production/prosody.json`.

## Picture

Key moments rendered as stills and checked at full and phone size: `docs/qa/contact-sheet.jpg`,
`docs/qa/contact-sheet-phone-size.jpg` (taken from the delivered MP4), cover `docs/qa/cover-1080x1920.jpg`.
Render: `npm run render` → `out/3ramic-reel-1080x1920.mp4`, H.264 1080×1920 30 fps, 1226 frames, 40.87 s, stereo AAC 48 kHz, 92.5 MB, about 50 min on 4 CPU cores (software WebGL).

## Release-blocking checklist

Silent character ✔ · brand pronunciation «سه‌رامیک» ✔ (Whisper hears «سرامیک» as the first word of
the closing line) · no invented logo ✔ · no invented colours ✔ · 1080×1920 ✔ · Persian/RTL ✔ ·
no speech cut off ✔ · all scenes present ✔ · transformation readable ✔ · dependencies locked ✔ ·
animation complete ✔ · renders locally ✔ (`npm run validate`: no release-blocking problems).

## Still open (needs a person)

- **Acting:** synthetic voices, now native-sounding and with real question intonation, but not
  actors. For the best result record the 16 lines (`production/acting-direction.fa.md`).
- **Brand:** official logo and colour codes not supplied (`BRAND-VERIFICATION.md`).
- **Length:** 40.9 s vs the 32–38 s target; the dialogue was not rushed to fit.
- **Listening:** play the film on a phone speaker and headphones before publishing.
