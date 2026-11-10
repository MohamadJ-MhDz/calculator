# THE FLOOR THAT QUIT — 3ramic

A 40-second, 9:16 surreal 3D animated commercial for **3ramic**, built entirely in code with
Remotion, React Three Fiber and Three.js. At 03:17 a.m. the floor tiles of an apartment resign,
because they were chosen for the wrong rooms. An investigation follows, a (fictional) 3ramic
material-selection interface re-plans the rooms, and the tiles come home in triumph.

> **هر سرامیکی، جای خودش.**

| | |
|---|---|
| Composition ID | `ThreeRamicFilm` |
| Format | 1080 × 1920 (9:16) · 30 fps · 1200 frames · 40 s |
| Final render | `out/3ramic-final.mp4` |
| Preview render | `out/3ramic-preview.mp4` (540 × 960) · `out/3ramic-preview-short.mp4` (10 s teaser) |

## Before you publish: the logo

**No logo asset was supplied with the brief, so none was invented.** The end card is a clean dark
plate with a logo slot; until an asset is set, the slot shows the brand name as plain neutral text.

To insert the official logo:

1. Copy the supplied asset into `public/` (SVG, or PNG with transparency; the light version, for a dark background).
2. In `src/brand.ts` set `LOGO.file` to its file name, for example `file: "3ramic-logo.svg"`, and adjust `LOGO.width` if needed.
3. Render again.

Every brand-mark placement goes through `src/ui/Wordmark.tsx`, which shows the asset untouched:
no recolouring and no distortion, only a fade-and-settle reveal.

## Commands

```bash
npm install            # Node 20.19+ / 22.13+ / 24+
npm run dev            # Remotion Studio → open http://localhost:3000/ThreeRamicFilm
npm run render         # full quality in one pass → out/3ramic-final.mp4
npm run render:chunks  # the same, in resumable chunks, plus the preview and teaser
npm run render:preview # low-res, low-DPR preview → out/3ramic-preview.mp4
npm run render:stills  # 15 reference stills → out/stills/
npm run audio          # re-synthesise score + SFX + VO placeholder (python3 + numpy)
npm run fonts          # re-download the OFL fonts into public/fonts
npm run lint           # eslint + tsc
```

Single frames or ranges can be rendered from any scene's own composition, for example:
`npx remotion render S03-Investigation out/s3 --sequence --frames=0-179 --image-format=jpeg`.

### How the delivered files were produced

On a CPU-only machine WebGL runs in software, so the delivered files were rendered with
`npm run render:chunks` (`scripts/render-chunks.sh`). It bundles once, renders eight muted
150-frame chunks to `out/parts/`, renders the audio mix, then calls `scripts/assemble-final.sh`.
Finished chunks are marked, so a stopped run resumes where it left off; delete `out/parts` and
`out/bundle` after changing the source.

`assemble-final.sh` concatenates the chunks, encodes H.264 High at CRF 19 capped at 10 Mbps,
loudness-normalises the mix to −15 LUFS / −1.5 dBTP and writes three files:

* `out/3ramic-final.mp4`: 1080×1920, 30 fps, H.264 + AAC
* `out/3ramic-preview.mp4`: 540×960 preview of the whole film
* `out/3ramic-preview-short.mp4`: a 10 s teaser (the 03:17 hook and the drop, plus the end card)

## The film, scene by scene

| # | Time | Component | What happens |
|---|---|---|---|
| 01 | 0–5 s | `Scene01Incident` | Overhead CCTV at night; the clock flips to **03:17**. Eyes open *in the floor* inside the first second. One tile slowly lifts itself out, hinges upright and grows two legs. A tiny suitcase pops out of its hole like toast and lands in front of it; it picks the suitcase up. Dramatic push-in while the CCTV grade bleeds into colour… then an **abrupt cut** back to the cold CCTV wide, music gone: the tile is walking to the door and the rest of the floor has opened its eyes and started to rattle. |
| 02 | 5–11 s | `Scene02Resignation` | Whip pan. The whole floor stands up and queues for the door like exhausted office workers: angry, tired, eye-rolling, with suitcases, trolleys and "I quit" boxes. **One tile is too angry to queue**: it stomps, tucks its legs in and rolls out on its edges. **Another waits by the door with a tiny briefcase**, tapping its foot and checking its watch. Shot B is a cutaway tracking shot down the hallway with a **speed ramp** (×1.3 → slow motion → ×1.5) as the roller overtakes the queue. Shot C is the pause: the smallest tile looks back, crickets, a shrug, the waiter gives up and follows, the door slams. **Title card.** |
| 03 | 11–17 s | `Scene03Investigation` | A dark midnight-blue investigation interface. The apartment plan splits into **three floating 3D cards**, each carrying a miniature room. Hard cuts and snap-zooms: Exhibit A, WRONG MATERIAL (a pool-mosaic kitchen, with a swim ring); Exhibit B, CLASHING TEXTURES (checker, floral and stripes); Exhibit C, ZERO COORDINATION (✕ connectors, a coordination score falling to 12 %). Orange markers pin the evidence and the tiles protest with picket signs. |
| 04 | 17–24 s | `Scene04System` | A scan wipe into a warm-cream "lab": the **3ramic MATERIAL MATCH** concept interface, labelled on screen as a creative visualisation. Six procedural samples float in as a 3D grid: natural stone, travertine, terrazzo, matte porcelain, marble-look and modern neutral. Grazing macro on terrazzo. Then each sample flies to its room, hovers for a beat and **snaps into a real tile position**; the rest of that floor or wall follows outward from it and a match score ticks up. *MATERIAL. PATTERN. PERSONALITY.* |
| 05 | 24–34 s | `Scene05Transformation` | The rooms re-join into one apartment while a re-tiling ripple runs through it. **Macro montage**, one cut per beat, on real tile bodies flipping from the wrong material to the right one: MATTE (porcelain under grazing light), GLOSS (a hard light sliding over a polished marble-look), DEPTH (edges, body thickness and joints at grout level). Then the tiles **come home in triumph**: they burst through their own doors at a run, arms up, some holding their luggage aloft, and lie back into their exact slots. Slow-motion macro on the last tile clicking in, then a pull-back. *EVERYTHING in its PLACE.* |
| 06 | 34–40 s | `Scene06Ending` + `EndCard` | One continuous shot at dawn. The hero tile walks toward the camera and sets its suitcase down. Behind it the newly designed home lifts off the ground and tips up to face us, every room visible at once. A small approving nod. The frame re-tiles into a **clean dark end card**: the logo slot, a thin orange rule and the Persian tagline. Nothing else. |

## Editing brand colours, text and the cut

* **`src/brand.ts`** holds the palette (`#121820` charcoal, `#0D1730` midnight blue, `#FF703D` orange, `#F2EDE4` warm cream, cool gray and stone), the brand name, the Persian tagline, the film title, the logo slot and the scene timings.
* **`src/Film.tsx`** holds the edit: `WHIPS` (whip-pan transitions) and `GLITCHES` (RGB-split glitch hits) are plain lists of frames. The effects themselves are `EditFX` in `src/ui/Overlays.tsx`.
* The speed ramp is `speedB()` in `src/scenes/Scene02Resignation.tsx`; the abrupt cut is `S1_CUT` in `src/scenes/Scene01Incident.tsx`.
* **`public/subtitles/narration-fa.json`** is the frame-accurate Persian cue sheet: the single source of truth for on-screen subtitles. It is also exported as `narration-fa.srt`.
* Composition props, editable in Studio: `showSubtitles`, `musicVolume`, `sfxVolume`, `narrationVolume`.

All on-screen text is either one of these editable strings or a functional interface label (timecodes, counters, exhibit and material names). Text is set by the browser's text engine in real fonts, never generated as an image, so there are no distorted letters.

## Persian / RTL text and safe areas

* The font is Vazirmatn (Arabic + Latin subsets). Shaping is done by Chrome's HarfBuzz engine with a real Arabic-script OpenType font. There is no manual glyph shaping, and no Persian text is ever drawn into WebGL or canvas.
* Every Persian block sets `dir="rtl"` and `lang="fa"`. Subtitles animate **word by word, never per letter**, so letters stay joined.
* ZWNJ (U+200C) is preserved inside words such as سرامیک‌ها, می‌خواد, نمی‌خوان and تری‌رامیک (8 occurrences in the cue sheet, written as exact code points).
* Subtitles sit in a fixed band (about y = 1405–1560 px); kinetic type and interface graphics stay in the top third, and the close-ups are framed to keep the action between the two.
* The tiles' own line ("ما رو برای جای اشتباهی انتخاب کردین!") gets an orange speech-bubble style. Cues 11–12 are shown by the end-card typography itself, so the brand line isn't duplicated on screen.

## Sound

Every sound is **original and synthesised** by `scripts/make-audio.py` (numpy only, no samples, no third-party recordings):

* `public/audio/score.wav` is an original 40 s electronic score at 120 bpm, so one beat is 15 frames and the cuts sit on the grid. A sneaking filtered bassline and a too-loud clock under the CCTV shot; dead silence on the abrupt cut; the drop on the resignation (confident saw bass, 808-style kick, claps, off-beat hats, a playful pluck hook, ceramic "tinks" as percussion); a tape-stop into the comedic pause; a dark half-time pulse with glitch bleeps for the investigation; the same groove turned major for the system; stop-time hits on the macro cuts; the music sinking under water for the slow-motion click; a bell-and-pad sting on the end card.
* `public/audio/sfx/*.wav` holds 39 effects: clock tick and beep, eyes-open bloop, the gritty scrape of a tile prising itself loose, ceramic crack and rattle, spring "boing", toast-pop, tiny footsteps and foot taps, rolling suitcase wheels, the clack of a rolling tile, door creak and slam, crickets, scans, UI blips and typing, deep cinematic impacts, snaps and tile clicks, a slow-motion sag, chimes.
* `src/audio/SoundDesign.tsx` is the cue sheet. Choreography-driven cues (every corner of the rolling tile hitting the floor, each sample snapping in, each tile landing) are computed from the same functions the scenes use, so they stay in sync if timings change.

### Narration: placeholder

No narration recording was supplied and none was invented. **`public/audio/narration-PLACEHOLDER.wav` is 40 s of silence**, labelled as a placeholder on the Studio timeline. To add the real Persian VO, record against `public/subtitles/narration-fa.srt` and overwrite that file, or point the `<Audio>` in `src/Film.tsx` at your recording.

## Project structure

```
src/
  Root.tsx              compositions (ThreeRamicFilm + per-scene + dev lab)
  Film.tsx              master timeline: scenes, whips/glitches, transitions, title card, subtitles, audio
  brand.ts  fonts.ts  anim.ts
  scenes/               Scene01Incident … Scene06Ending, EndCard, sceneShared (room/camera continuity)
  three/
    textures.ts         seeded procedural ceramic textures (marble, travertine, terrazzo, stone, …)
    kit.tsx             PBR ceramic materials, studio environment, deterministic camera, lights, Slab, interface cards
    TileCharacter.tsx   the tile character (legs, arms, face, roll, cheer; suitcase / briefcase / trolley / box / sign)
    Apartment.tsx       night apartment set and hallway, seven-segment clock, furniture, lighting
    RoomModel.tsx       miniature room dioramas (kitchen / bathroom / living) with flip-tiles
    project.ts          3D → screen projection for anchored callouts
  ui/                   overlays (CCTV HUD, EditFX, tile-flip transition, grain, stamps), callouts, subtitles, logo slot
  audio/SoundDesign.tsx
scripts/make-audio.py     score + SFX + VO placeholder synthesis
scripts/render-chunks.sh  resumable full render      scripts/assemble-final.sh  encode + preview + teaser
scripts/vendor-fonts.mjs
public/fonts            OFL fonts (see LICENSES.md)   public/audio   public/subtitles   public/textures
```

## How it is built

* All 3D is procedural. Every object is built from Three.js primitives and rounded boxes, and every ceramic surface is a seeded canvas texture with a physical clearcoat material lit by a PMREM `RoomEnvironment`. There is no stock footage and no AI-generated imagery.
* Animation is deterministic. Everything derives from `useCurrentFrame()`; there is no `useFrame`, no CSS animation, and no unseeded randomness. The camera is set in a layout effect so it lands before `@remotion/three` advances R3F. Speed ramps are a remapping of story time, not a retimed clip.
* Rendering uses WebGL through ANGLE/SwiftShader (`Config.setChromiumOpenGlRenderer("swangle")`), so it works on CPU-only machines. Expect about 2–4 s per frame on 4 cores. Pass `--props='{"dpr":0.5}'` to render the 3D at half resolution for quick previews.
* `remotion.config.ts` falls back to a pre-installed Chrome Headless Shell when one exists at `/opt/pw-browsers/...`. The cloud sandbox this was produced in could not reach Remotion's browser download host; on a normal machine that block is skipped.

## Credits and licences

* Fonts: SIL Open Font License 1.1 (see `public/fonts/LICENSES.md`).
* Music, SFX, 3D models and textures: original, generated by this project's code.
* "3ramic Material Match" is a fictional interface made for this film and is not a real software product.
* Remotion is free for individuals and teams of up to 3; larger companies need a company licence (https://remotion.pro/license).
