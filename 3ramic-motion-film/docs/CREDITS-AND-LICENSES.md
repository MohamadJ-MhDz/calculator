# Credits and licences

## Voices (synthetic, open models — no voice cloning)

Every voice is a pretrained voice exactly as its authors published it. No real person's voice was
cloned or imitated, no paid service or API was used, and nothing was sent to a third party: the
models run locally with onnxruntime (`scripts/audio/voice_synthesize.py`).

| Character | Voice | Source | Licence |
|---|---|---|---|
| The tile («سرامیک») | khadijah (Matcha-TTS) | huggingface.co/mah92/Khadijah-FA_EN-Matcha-TTS-Model | CC0-1.0 |
| The detective («کارآگاه») | musa (Matcha-TTS) | huggingface.co/mah92/Musa-FA_EN-Matcha-TTS-Model | CC0-1.0 |
| The patterned tile («کاشیِ طرح‌دار») | fa_IR-amir-medium (Piper/VITS) | huggingface.co/rhasspy/piper-voices | model MIT · dataset CC0 |
| The vanity («روشویی») | fa_IR-reza_ibrahim-medium (Piper/VITS) | huggingface.co/rhasspy/piper-voices | model MIT · dataset CC0 |
| The narrator («گوینده») | fa_IR-ganji-medium (Piper/VITS) | huggingface.co/rhasspy/piper-voices | model MIT · dataset CC0 |
| Vocoder for the Matcha voices | Vocos mel 22 kHz | huggingface.co/BSC-LT/vocos-mel-22khz | Apache-2.0 |

Auditioned but not used: fa_IR-mana-medium (MahtaFetrat/Mana-Persian-Piper, MIT; unstable on
short lines). Rejected for licence reasons before auditioning: models whose weights or base
models are non-commercial (CC-BY-NC), and online TTS services.
An experimental runner for the Apache-2.0 "Aava" Persian model is kept in
`scripts/audio/voice_generate.py`; it is not used because its output was not reliably intelligible.

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
| numpy | BSD-3-Clause |

## Brand

«3ramic» and 3ramic.ir belong to their owner. No official logo or colour was available; see
`docs/BRAND-VERIFICATION.md`.
