# Credits and licences

## Voices (synthetic, open models — no voice cloning)

Every voice is a pretrained voice exactly as its authors published it. No real person's voice was
cloned or imitated, no paid service or API was used, and nothing was sent to a third party: the
models run locally with onnxruntime (`scripts/audio/voice_synthesize.py`).

| Character | Voice | Source | Licence |
|---|---|---|---|
| The tile («سرامیک») | fa_IR-mana-medium (Piper/VITS) | huggingface.co/MahtaFetrat/Mana-Persian-Piper | model MIT · dataset CC0 (Mana-TTS) |
| The detective («کارآگاه»), also the closing brand line | fa_IR-ganji_adabi-medium (Piper/VITS) | huggingface.co/rhasspy/piper-voices | model MIT · dataset CC0 (tts.datacula.com) |
| The patterned tile («کاشیِ طرح‌دار») | fa_IR-amir-medium (Piper/VITS) | huggingface.co/rhasspy/piper-voices | model MIT · dataset CC0 |
| The vanity («روشویی») | fa_IR-reza_ibrahim-medium (Piper/VITS) | huggingface.co/rhasspy/piper-voices | model MIT · dataset CC0 |

All four are Persian-only voices. The first release used two bilingual Persian/English models
(khadijah, musa — mah92, CC0) for the tile and the detective; speech recognition heard parts of
their lines as English or Turkish, so they were replaced. Intonation (rising questions, livelier
range, one steady pitch per character) is shaped afterwards with the WORLD vocoder
(`pyworld`, MIT) — `scripts/audio/voice_prosody.py`, settings in `production/prosody.json`.

Auditioned but not used: fa_IR-ganji-medium (its timbre is the base of ganji_adabi, too close to
the detective). Excluded for licence reasons: fa_IR-magnoliasis (dataset has no licence),
fa_IR-gyro (dataset licence unclear), and models with non-commercial weights or base models.
Audio8-TTS-Persian (Apache-2.0) was evaluated from its published samples but not run: it needs
its own model code to be executed, which was not permitted in this build environment.
An experimental runner for the Apache-2.0 "Aava" model is kept in `scripts/audio/voice_generate.py`;
it is not used because its output was not reliably intelligible.

The models are not shipped in this ZIP; `npm run voices:setup` downloads them from the sources above.

## Quality-control model (not part of the film)

- OpenAI Whisper large-v3-turbo (MIT) — used locally only to measure whether the generated Persian
  speech is intelligible (`scripts/audio/voice_analyze.py`, `scripts/qa/dialogue_in_mix.py`).

## Music and sound effects

Original. Every note and every effect is synthesised by code in this project
(`scripts/audio/sounds.py`, `scripts/audio/build_audio.py`): no samples, loops, stock music or
third-party recordings. The rubber-duck squeak, tile clicks, paper, wood creak, grout trowel,
glass, room tone, the pizzicato bass, vibraphone, marimba, celesta, pads and percussion are all
generated from oscillators, noise and physical-model synthesis.

## Fonts

Vazirmatn and Lalezar, both SIL Open Font License 1.1 — see `public/fonts/LICENSES.md`.

## Software

| Package | Licence |
|---|---|
| Remotion (`remotion`, `@remotion/*`) | Remotion License — free for individuals, non-profits and companies with up to 3 employees; larger companies need a company licence: https://www.remotion.dev/license |
| React, React DOM | MIT |
| Three.js | MIT |
| @react-three/fiber | MIT |
| onnxruntime, onnx (Python, voice synthesis) | MIT / Apache-2.0 |
| pyworld (WORLD vocoder, intonation shaping) | MIT |
| numpy | BSD-3-Clause |

## Brand

«3ramic» and 3ramic.ir belong to their owner. No official logo or colour was available; see
`docs/BRAND-VERIFICATION.md`.
