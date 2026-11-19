# Changelog

## 2.0.0 — Release master: «پروندهٔ استعفای سرامیک‌ها» (The Tiles That Quit)

A rebuild of the film around one story and real Persian dialogue.

### Story and picture
- New single idea: the tiles of a badly coordinated 6 m² bathroom resign; a rubber-duck detective
  names three suspects (busy pattern, black grout, oversized vanity); the same room is re-done with
  coordinated choices on one locked camera; same-camera before/after wipe («همون ۶ متر»); payoff
  «با پاداش!»; the tile drops back into its own place on «جای خودش».
- Five scenes (`src/scenes/`), a new bathroom set with real tile thickness and grout, the duck
  detective, the vanity with a face, the patterned tile that becomes a framed accent.
- First frame already shows the tile springing out of the floor (stronger Reels hook).
- Removed the old English editorial graphics (THE FLOOR THAT QUIT, WRONG MATERIAL, percentages,
  HUD counters), the old apartment set, and every use of the rejected orange `#FF703D`.

### Dialogue and sound (previously: no speech at all)
- 16 Persian lines, five characters, five different open voice models (CC0/MIT/Apache), synthesised
  from hand-checked phonemes; brand always spoken «سه‌رامیک» /serˈɑmik/, written `3ramic`.
- Takes chosen per line by Whisper intelligibility (mean 0.984); 0.96 through the final mix.
- Audio-first timeline: recordings decide every shot length; subtitles and mouth shapes come from
  the per-phoneme timing of each take.
- Original score and effects generated in code; numpy-only master at −14.5 LUFS, −1.5 dBTP,
  mono-safe; every line ≥ 9.9 LU over the music and ≥ 8.5 LU over the effects.
- Line changes during production, both because the free voices could not say them intelligibly:
  L12 «حالا شد!» → «این‌جا جای منه!», L15 «با اضافه‌حقوق!» → «با پاداش!».

### Brand
- `src/config/brand.ts`: name, pronunciation, tagline, website, logo slot, colour slots.
  The official site could not be reached, so no colour or logo is claimed (`status: "unverified"`).

### Tooling
- `npm run validate` (release checks), resumable `npm run render`, `npm run stills` (+ contact
  sheet), `npm run cover`, `npm run timeline`, `npm run audio`, voice pipeline scripts, Windows-
  friendly Python launcher. Persian README with Windows instructions.

### Known limitations
- Voice acting is synthetic and not verified by a human listener.
- Official logo and colours not verified.
- 39.7 s, 1.7 s over the 32–38 s creative target (dialogue not sped up).

## 1.x — earlier cuts
- 1.1 "viral-style commercial" revision of THE FLOOR THAT QUIT (no dialogue).
- 1.0 THE FLOOR THAT QUIT, 40 s brand film (no dialogue).
