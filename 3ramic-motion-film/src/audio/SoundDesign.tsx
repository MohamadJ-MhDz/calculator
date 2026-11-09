import React from "react";
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import { SCENES, END_CARD_AT } from "../brand";
import { LAND_AT, PLAN } from "../scenes/sceneShared";
import { buildPlans } from "../scenes/Scene05Transformation";

/**
 * Sound design — every effect is original, synthesised by scripts/make-audio.py.
 * Cue frames are global (30 fps). Choreography-driven cues are computed from the
 * same functions the scenes use, so clicks land exactly when tiles do.
 */

type Cue = { at: number; sfx: string; vol?: number; label: string };

const S2 = SCENES.resignation.from;
const S4 = SCENES.system.from;
const S5 = SCENES.transformation.from;

const plans = buildPlans();
const S5_LANDINGS: Cue[] = plans.map((p, i) => ({
  at: S5 + Math.round(p.fallAt + p.fallDur),
  sfx: i === plans.length - 1 ? "tile-click-big" : "tile-click",
  vol: i === plans.length - 1 ? 0.95 : 0.6,
  label: `Tile ${i + 1} back in its slot`,
}));
const S5_HOPS: Cue[] = plans.map((p, i) => ({ at: S5 + Math.round(p.hopAt), sfx: "boing", vol: 0.16, label: `Tile ${i + 1} hops in` }));

const END_ORDER = [0, 3, 5, 2, 8, 6, 4, 7, 1];
const END_LANDINGS: Cue[] = END_ORDER.map((order) => ({
  at: END_CARD_AT + Math.round(4 + order * 3.4 + 10),
  sfx: order === 8 ? "tile-click-big" : "tile-click",
  vol: order === 8 ? 1 : 0.5,
  label: order === 8 ? "Hero tile lands (centre)" : `End-card tile ${order + 1}`,
}));

export const CUE_SHEET: Cue[] = [
  // 01 — THE INCIDENT
  { at: 0, sfx: "glitch", vol: 0.25, label: "CCTV feed on" },
  { at: 2, sfx: "tick", vol: 0.35, label: "Clock tick" },
  { at: 16, sfx: "beep", vol: 0.45, label: "Clock flips to 03:17" },
  { at: 22, sfx: "eyes-open", vol: 0.55, label: "Eyes open in the floor" },
  { at: 36, sfx: "crack", vol: 0.9, label: "Tile pops out" },
  { at: 46, sfx: "boing", vol: 0.55, label: "Legs spring out" },
  { at: 52, sfx: "land", vol: 0.7, label: "Lands on its feet" },
  { at: 72, sfx: "toast-pop", vol: 0.7, label: "Suitcase pops out like toast" },
  { at: 84, sfx: "whoosh-short", vol: 0.45, label: "Suitcase flies" },
  { at: 92, sfx: "catch", vol: 0.7, label: "Catch" },
  { at: 92, sfx: "glitch", vol: 0.45, label: "HUD glitches out" },
  { at: 94, sfx: "whoosh", vol: 0.6, label: "Push-in" },
  { at: 104, sfx: "impact", vol: 0.55, label: "03:17 slam" },
  // 02 — THE RESIGNATION
  { at: S2, sfx: "whoosh-short", vol: 0.35, label: "Cut" },
  { at: S2, sfx: "floor-ripple", vol: 0.8, label: "The whole floor pops up" },
  { at: S2 + 8, sfx: "door-creak", vol: 0.5, label: "Door opens" },
  { at: S2 + 30, sfx: "slam-hit", vol: 0.6, label: "RESIGNED. stamp" },
  { at: S2 + 80, sfx: "whoosh-short", vol: 0.35, label: "Cut to hallway" },
  { at: S2 + 82, sfx: "typing", vol: 0.25, label: "Counter" },
  { at: S2 + 122, sfx: "whoosh-short", vol: 0.3, label: "Cut to doorway" },
  { at: S2 + 141, sfx: "crickets", vol: 0.5, label: "Awkward pause" },
  { at: S2 + 156, sfx: "tok", vol: 0.35, label: "Tiny shrug" },
  { at: S2 + 172, sfx: "door-slam", vol: 1.0, label: "Door slams" },
  { at: S2 + 172, sfx: "impact", vol: 0.6, label: "Title hit" },
  { at: 316, sfx: "ripple-long", vol: 0.45, label: "Tile-flip transition" },
  // 03 — THE INVESTIGATION
  { at: 336, sfx: "whoosh", vol: 0.5, label: "Apartment splits" },
  { at: 374, sfx: "scan", vol: 0.45, label: "Scan — kitchen" },
  { at: 378, sfx: "slam-hit", vol: 0.55, label: "WRONG MATERIAL." },
  { at: 382, sfx: "blip", vol: 0.4, label: "Callout" },
  { at: 384, sfx: "typing", vol: 0.25, label: "Callout text" },
  { at: 392, sfx: "blip", vol: 0.4, label: "Callout" },
  { at: 422, sfx: "slam-hit", vol: 0.55, label: "CLASHING TEXTURES." },
  { at: 426, sfx: "scan", vol: 0.45, label: "Scan — bathroom" },
  { at: 426, sfx: "glitch", vol: 0.3, label: "Textures vibrate" },
  { at: 430, sfx: "blip", vol: 0.35, label: "Callout" },
  { at: 435, sfx: "blip", vol: 0.35, label: "Callout" },
  { at: 440, sfx: "blip", vol: 0.35, label: "Callout" },
  { at: 470, sfx: "slam-hit", vol: 0.55, label: "ZERO COORDINATION." },
  { at: 472, sfx: "select", vol: 0.45, label: "✕ marks" },
  { at: 476, sfx: "typing", vol: 0.3, label: "Score counts down" },
  { at: 498, sfx: "scan", vol: 0.5, label: "Scan wipe to the system" },
  // 04 — THE 3RAMIC SYSTEM
  { at: S4 + 2, sfx: "select", vol: 0.5, label: "Interface boots" },
  { at: S4 + 6, sfx: "typing", vol: 0.3, label: "Header" },
  ...[0, 1, 2, 3, 4, 5].map((k) => ({ at: S4 + 14 + k * 5, sfx: "whoosh-short", vol: 0.3, label: `Sample ${k + 1} arrives` })),
  { at: S4 + 44, sfx: "select", vol: 0.5, label: "Sample selected" },
  { at: S4 + 62, sfx: "whoosh", vol: 0.55, label: "Macro dive" },
  { at: S4 + 74, sfx: "ding", vol: 0.3, label: "Glint" },
  { at: S4 + 100, sfx: "whoosh", vol: 0.55, label: "Swoop to the rooms" },
  { at: S4 + 112, sfx: "slam-hit", vol: 0.4, label: "MATERIAL." },
  { at: S4 + 140, sfx: "slam-hit", vol: 0.4, label: "PATTERN." },
  { at: S4 + 168, sfx: "slam-hit", vol: 0.45, label: "PERSONALITY." },
  ...(["kitchen", "bathroom", "living"] as const).flatMap((room) => [
    { at: S4 + LAND_AT[PLAN[room].floor], sfx: "flip-cascade", vol: 0.55, label: `${room} floor re-tiled` },
    { at: S4 + LAND_AT[PLAN[room].wall], sfx: "tile-click", vol: 0.5, label: `${room} wall material lands` },
    { at: S4 + LAND_AT[PLAN[room].wall] + 6, sfx: "ding", vol: 0.25, label: `${room} match` },
  ]),
  // 05 — THE TRANSFORMATION
  { at: S5 + 2, sfx: "whoosh", vol: 0.5, label: "Rooms merge" },
  { at: S5 + 44, sfx: "slam-hit", vol: 0.4, label: "Apartment locks together" },
  { at: S5 + 44, sfx: "ripple-long", vol: 0.55, label: "Tile placement ripple" },
  ...S5_HOPS,
  ...S5_LANDINGS,
  { at: S5 + Math.round(plans[plans.length - 1].fallAt + plans[plans.length - 1].fallDur) + 4, sfx: "ding", vol: 0.35, label: "Perfect fit glint" },
  { at: S5 + 258, sfx: "whoosh", vol: 0.45, label: "Pull back" },
  // 06 — THE ENDING
  { at: SCENES.ending.from + 2, sfx: "steps-hero", vol: 0.45, label: "Hero walks home" },
  { at: SCENES.ending.from + 44, sfx: "suitcase-down", vol: 0.75, label: "Suitcase set down" },
  { at: SCENES.ending.from + 45, sfx: "whoosh-short", vol: 0.25, label: "Reverse angle" },
  { at: SCENES.ending.from + 62, sfx: "tok", vol: 0.45, label: "Nod" },
  { at: SCENES.ending.from + 70, sfx: "tok", vol: 0.45, label: "Nod" },
  { at: END_CARD_AT - 12, sfx: "ripple-long", vol: 0.45, label: "Tile-flip to end card" },
  ...END_LANDINGS,
  { at: END_CARD_AT + 8, sfx: "whoosh-short", vol: 0.35, label: "Wordmark" },
  { at: END_CARD_AT + 42, sfx: "chime", vol: 0.55, label: "Brand chime" },
  { at: END_CARD_AT + 88, sfx: "ding", vol: 0.3, label: "Wink" },
];

export const SoundDesign: React.FC<{ volume?: number }> = ({ volume = 1 }) => (
  <>
    {CUE_SHEET.map((c, i) => (
      <Audio key={i} name={`SFX · ${c.label}`} src={staticFile(`audio/sfx/${c.sfx}.wav`)} from={c.at} volume={(c.vol ?? 0.6) * volume} />
    ))}
    {/* the march: tiny footsteps + suitcase wheels; stops dead for the comedic pause */}
    <Audio name="SFX · March of the tiles" src={staticFile("audio/sfx/march.wav")} from={S2 + 22} durationInFrames={118} volume={0.5 * volume} />
  </>
);
