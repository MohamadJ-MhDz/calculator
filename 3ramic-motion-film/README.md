# THE FLOOR THAT QUIT — 3ramic

A 40-second, 9:16 surreal 3D motion brand film for **3ramic**, built entirely in code with
Remotion, React Three Fiber and Three.js. At exactly 03:17 a.m. the floor tiles of an apartment
resign, because they were selected for the wrong rooms. An investigation follows, then a
(fictional) 3ramic material-matching system re-plans the rooms, and the tiles come home.

> **هر سرامیکی، جای خودش.**

| | |
|---|---|
| Composition ID | `ThreeRamicFilm` |
| Format | 1080 × 1920 (9:16, Instagram Reels) · 30 fps · 1200 frames · 40 s |
| Final render | `out/3ramic-final.mp4` |
| Preview render | `out/3ramic-preview.mp4` (540 × 960, fast low-res pass) |

## Commands

```bash
npm install            # Node 20.19+ / 22.13+ / 24+
npm run dev            # Remotion Studio → open http://localhost:3000/ThreeRamicFilm
npm run render         # full quality → out/3ramic-final.mp4
npm run render:preview # low-res, low-DPR preview → out/3ramic-preview.mp4
npm run render:stills  # 12 reference stills → out/stills/
npm run audio          # re-synthesise score + SFX + VO placeholder (python3 + numpy)
npm run fonts          # re-download the OFL fonts into public/fonts
npm run lint           # eslint + tsc
```

Single frames or ranges can be rendered from any scene's composition, for example:
`npx remotion render S03-Investigation out/s3 --sequence --frames=0-179 --image-format=jpeg`.

## The film, scene by scene

| # | Time | Component | What happens |
|---|---|---|---|
| 01 | 0–5 s | `Scene01Incident` | Overhead CCTV at night (REC / timestamp HUD). The clock flips to **03:17**. At 0.7 s eyes open *in the floor*. At 1.2 s the tile pops out with a crack, and by 1.9 s it has hinged upright on springing legs. A suitcase pops out of its hole like toast. Dramatic push-in; the CCTV grade bleeds into colour. |
| 02 | 5–11 s | `Scene02Resignation` | The whole floor ripples up, stands, glares at camera, turns its back and queues for the door like exhausted office workers. Some are angry, some tired, some eye-rolling, dragging trolleys or carrying "I quit" boxes. Shot A rises over the queue; Shot B tracks the column through the hallway with a *TILES THAT LEFT THE BUILDING* counter. Shot C is the funny pause: the smallest tile looks back, crickets play, it shrugs, and the door slams. **Title card.** |
| 03 | 11–17 s | `Scene03Investigation` | Tile-flip transition. The apartment plan splits into three floating rooms on a blueprint field. Exhibit A, WRONG MATERIAL: a pool-mosaic kitchen with a swim ring and a rubber duck. Exhibit B, CLASHING TEXTURES: checker, floral and stripes vibrating. Exhibit C, ZERO COORDINATION: ✕ connectors and a coordination score dropping to 12 %. The tiles protest with picket signs. Scan planes, 3D-anchored callouts, slam typography. |
| 04 | 17–24 s | `Scene04System` | A scan wipe into an ivory "lab". The **3ramic MATERIAL MATCH** concept interface (clearly labelled as a creative visualisation). Six procedural samples fly in: natural stone, travertine, terrazzo, matte porcelain, marble-look and modern neutral. Grazing macro on terrazzo. Then a swoop: each sample dives into its room, floors flip tile by tile, walls tile row by row, and match scores tick up. *MATERIAL. PATTERN. PERSONALITY.* |
| 05 | 24–34 s | `Scene05Transformation` | The rooms re-join into one apartment, the reverse of the split. A tile-placement ripple runs through every floor. The tiles come home happily through their own doors and lie back into their exact slots (*TILES RETURNED* counter). A slow-motion macro follows the final terrazzo tile clicking in: dust puff, glint and a 2 mm grout callout. Then a pull-back to a dawn-lit wide shot. |
| 06 | 34–40 s | `Scene06Ending` + `EndCard` | Morning (the clock now reads 07:30). The hero tile walks into the foreground, sets its suitcase down, and on the reverse angle looks over the room and nods twice. A tile-flip leads to the end card: nine real ceramic tiles click into a grid, the hero lands last in the centre, then the **3ramic** wordmark, the Persian tagline, and a final wink. |

## Editing brand colours and text

* **`src/brand.ts`** holds the palette (`#121820` charcoal, `#FF703D` orange, `#F2EDE4` ivory, cool gray and stone), the brand name, the Persian tagline, the film title and the scene timings.
* **`src/ui/Wordmark.tsx`** is a *typographic placeholder*. It sets the exact name "3ramic" in Bricolage Grotesque and is **not** a logo. To use the official logo, put the file in `public/` and replace the component body with `<Img src={staticFile("logo.svg")} />`. Every placement in the film uses this component.
* **`public/subtitles/narration-fa.json`** is the frame-accurate Persian cue sheet: the single source of truth for on-screen subtitles. It is also exported as `narration-fa.srt`.
* Composition props, editable in Studio: `showSubtitles`, `musicVolume`, `sfxVolume`, `narrationVolume`.

## Persian / RTL text

* The font is Vazirmatn (Arabic + Latin subsets), with Lalezar for display. Shaping is done by Chrome's HarfBuzz engine with a real Arabic-script OpenType font. There is no manual glyph shaping, and no Persian text is ever drawn into WebGL or canvas.
* Every Persian block sets `dir="rtl"` and `lang="fa"`. Subtitles animate **word by word, never per letter**, so letters stay joined.
* ZWNJ (U+200C) is preserved inside words such as سرامیک‌ها, می‌خواد, نمی‌خوان and تری‌رامیک (8 occurrences, written as exact code points).
* The tiles' own line ("ما رو برای جای اشتباهی انتخاب کردین!") gets an orange speech-bubble style. Cues 11–12 are shown by the end-card typography itself, so the brand line isn't duplicated on screen.

## Sound

Every sound is **original and synthesised** by `scripts/make-audio.py` (numpy only, no samples, no third-party recordings):

* `public/audio/score.wav` is an original 40 s score: a suspense drone with pizzicato, a comic D-minor march that stops dead for the pause, an investigation pulse, a bright D-major system arpeggio, a warm transformation progression, and an FM-bell end-card sting.
* `public/audio/sfx/*.wav` holds 31 effects: clock tick and beep, eyes-open bloop, ceramic crack, spring "boing", toast-pop, footsteps and suitcase-wheel patter, door creak and slam, crickets, scans, UI blips and typing, stamps, tile clicks and cascades, chimes.
* `src/audio/SoundDesign.tsx` is the cue sheet. Choreography-driven cues (each tile landing, end-card clicks) are computed from the same functions the scenes use, so they stay in sync if timings change.

### Narration: placeholder

No narration recording was supplied and none was invented. **`public/audio/narration-PLACEHOLDER.wav` is 40 s of silence**, labelled as a placeholder on the Studio timeline. To add the real Persian VO, record against `public/subtitles/narration-fa.srt` and overwrite that file, or point the `<Audio>` in `src/Film.tsx` at your recording.

## Project structure

```
src/
  Root.tsx              compositions (ThreeRamicFilm + per-scene + dev lab)
  Film.tsx              master timeline: scenes, transitions, title card, subtitles, audio
  brand.ts  fonts.ts  anim.ts
  scenes/               Scene01Incident … Scene06Ending, EndCard, sceneShared (room/camera continuity)
  three/
    textures.ts         seeded procedural ceramic textures (marble, travertine, terrazzo, stone, …)
    kit.tsx             PBR ceramic materials, studio environment, deterministic camera, lights, Slab
    TileCharacter.tsx   the tile character (legs, arms, face, suitcase / trolley / box / sign)
    Apartment.tsx       night apartment set, seven-segment clock, furniture, lighting
    RoomModel.tsx       miniature room dioramas (kitchen / bathroom / living) with flip-tiles
    project.ts          3D → screen projection for anchored callouts
  ui/                   overlays (CCTV HUD, tile-flip transition, grain, stamps), callouts, subtitles, wordmark
  audio/SoundDesign.tsx
scripts/make-audio.py   score + SFX + VO placeholder synthesis
scripts/vendor-fonts.mjs
public/fonts            OFL fonts (see LICENSES.md)   public/audio   public/subtitles   public/textures
```

## How it is built

* All 3D is procedural. Every object is built from Three.js primitives and rounded boxes, and every ceramic surface is a seeded canvas texture with a physical clearcoat material lit by a PMREM `RoomEnvironment`. There is no stock footage and no AI-generated imagery.
* Animation is deterministic. Everything derives from `useCurrentFrame()`; there is no `useFrame`, no CSS animation, and no unseeded randomness. The camera is set in a layout effect so it lands before `@remotion/three` advances R3F.
* Rendering uses WebGL through ANGLE/SwiftShader (`Config.setChromiumOpenGlRenderer("swangle")`), so it works on CPU-only machines. Expect about 2–4 s per frame on 4 cores. Pass `--props='{"dpr":0.5}'` to render the 3D at half resolution for quick previews.
* `remotion.config.ts` falls back to a pre-installed Chrome Headless Shell when one exists at `/opt/pw-browsers/...`. The cloud sandbox this was produced in could not reach Remotion's browser download host; on a normal machine that block is skipped.

## Credits and licences

* Fonts: SIL Open Font License 1.1 (see `public/fonts/LICENSES.md`).
* Music, SFX, 3D models and textures: original, generated by this project's code.
* "3ramic Material Match" is a fictional interface made for this film and is not a real software product.
* Remotion is free for individuals and teams of up to 3; larger companies need a company licence (https://remotion.pro/license).
