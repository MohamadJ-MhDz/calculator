import React from "react";
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import { SCENES, END_CARD_AT } from "../brand";
import { LAND_AT, SAMPLES } from "../scenes/sceneShared";
import { S1_CUT } from "../scenes/Scene01Incident";
import { rollerDist, SHOT_B, SHOT_C } from "../scenes/Scene02Resignation";
import { CUT_A, CUT_B, CUT_C, ZOOM_A, ZOOM_B } from "../scenes/Scene03Investigation";
import { buildPlans, MACRO_FROM, MACRO_LEN, RETURN_FROM } from "../scenes/Scene05Transformation";
import { NOD_AT } from "../scenes/Scene06Ending";

/**
 * Sound design — every effect is original, synthesised by scripts/make-audio.py.
 * Cue frames are global (30 fps). Choreography-driven cues are computed from the
 * same functions the scenes use, so clicks land exactly when tiles do.
 */

type Cue = { at: number; sfx: string; vol?: number; label: string };

const S2 = SCENES.resignation.from;
const S3 = SCENES.investigation.from;
const S4 = SCENES.system.from;
const S5 = SCENES.transformation.from;
const S6 = SCENES.ending.from;

/* --- Scene 02: every corner of the rolling tile that hits the floor --- */
const ROLLER_SCALE = 0.94;
const ROLLER_CLACKS: Cue[] = [];
for (let f = 1; f < SHOT_C; f++) {
  if (f === SHOT_B) continue; // the cut jumps the roller down the hallway
  if (Math.floor(rollerDist(f) / ROLLER_SCALE) > Math.floor(rollerDist(f - 1) / ROLLER_SCALE)) {
    ROLLER_CLACKS.push({ at: S2 + f, sfx: "clack", vol: f < SHOT_B ? 0.5 : 0.75, label: "Rolling tile — corner hits the floor" });
  }
}

/* --- Scene 04: each sample snapping into its room --- */
const S4_SNAPS: Cue[] = SAMPLES.flatMap((s) => {
  const land = S4 + LAND_AT[s.key];
  const cues: Cue[] = [
    { at: land - 9, sfx: "whoosh-short", vol: 0.22, label: `${s.name} hovers over the ${s.room}` },
    { at: land, sfx: "snap", vol: 0.85, label: `${s.name} snaps into the ${s.room} ${s.surface}` },
  ];
  if (s.surface === "floor") cues.push({ at: land + 2, sfx: "flip-cascade", vol: 0.5, label: `${s.room} floor follows` });
  else cues.push({ at: land + 6, sfx: "ding", vol: 0.25, label: `${s.room} match` });
  return cues;
});

/* --- Scene 05: the return --- */
const plans = buildPlans();
const lastPlan = plans[plans.length - 1];
const CLICK = S5 + Math.round(lastPlan.fallAt + lastPlan.fallDur);
const S5_HOPS: Cue[] = plans.map((p, i) => ({ at: S5 + Math.round(p.hopAt), sfx: "boing", vol: 0.2, label: `Tile ${i + 1} bursts through its door` }));
const S5_LANDINGS: Cue[] = plans.slice(0, -1).map((p, i) => ({
  at: S5 + Math.round(p.fallAt + p.fallDur),
  sfx: "tile-click",
  vol: 0.65,
  label: `Tile ${i + 1} back in its slot`,
}));

export const CUE_SHEET: Cue[] = [
  // 01 — THE INCIDENT
  { at: 0, sfx: "glitch", vol: 0.25, label: "CCTV feed on" },
  { at: 2, sfx: "tick", vol: 0.35, label: "Clock tick" },
  { at: 16, sfx: "beep", vol: 0.45, label: "Clock flips to 03:17" },
  { at: 20, sfx: "eyes-open", vol: 0.55, label: "Eyes open in the floor" },
  { at: 26, sfx: "scrape", vol: 0.6, label: "Tile slowly lifts itself out" },
  { at: 46, sfx: "crack", vol: 0.5, label: "Hinges upright" },
  { at: 50, sfx: "boing", vol: 0.55, label: "Legs spring out" },
  { at: 56, sfx: "land", vol: 0.7, label: "Lands on its feet" },
  { at: 62, sfx: "toast-pop", vol: 0.7, label: "Suitcase pops out like toast" },
  { at: 70, sfx: "whoosh-short", vol: 0.4, label: "Suitcase sails over" },
  { at: 81, sfx: "suitcase-down", vol: 0.6, label: "Suitcase lands" },
  { at: 81, sfx: "tap", vol: 0.4, label: "Step" },
  { at: 85, sfx: "tap", vol: 0.4, label: "Step" },
  { at: 86, sfx: "whoosh", vol: 0.6, label: "Push-in" },
  { at: 88, sfx: "glitch", vol: 0.4, label: "HUD glitches out" },
  { at: 93, sfx: "catch", vol: 0.7, label: "Picks the suitcase up" },
  { at: 98, sfx: "impact", vol: 0.55, label: "03:17 slam" },
  { at: S1_CUT, sfx: "glitch", vol: 0.8, label: "THE CUT — back to the CCTV wide" },
  { at: S1_CUT + 3, sfx: "rattle", vol: 0.75, label: "The rest of the floor wakes up" },
  { at: S1_CUT + 5, sfx: "steps-hero", vol: 0.35, label: "Tiny footsteps to the door" },
  // 02 — THE RESIGNATION
  { at: S2, sfx: "whoosh-short", vol: 0.4, label: "Whip" },
  { at: S2, sfx: "floor-ripple", vol: 0.8, label: "The whole floor pops up" },
  { at: S2 + 8, sfx: "door-creak", vol: 0.5, label: "Door opens" },
  { at: S2 + 28, sfx: "slam-hit", vol: 0.6, label: "RESIGNED. stamp" },
  ...[34, 37, 41, 44, 47].map((f) => ({ at: S2 + f, sfx: "land", vol: 0.4, label: "Angry stomp" })),
  { at: S2 + 40, sfx: "suitcase-roll", vol: 0.4, label: "Rolling suitcases" },
  { at: S2 + 52, sfx: "tok", vol: 0.4, label: "Legs tucked in" },
  ...ROLLER_CLACKS,
  { at: S2 + SHOT_B, sfx: "whoosh", vol: 0.5, label: "Whip to the hallway" },
  { at: S2 + SHOT_B + 2, sfx: "typing", vol: 0.25, label: "Counter" },
  { at: S2 + 92, sfx: "slowmo", vol: 0.5, label: "Speed ramp — slow motion" },
  { at: S2 + SHOT_C, sfx: "glitch", vol: 0.4, label: "Cut to doorway" },
  ...[126, 133, 140, 147, 154].map((f) => ({ at: S2 + f, sfx: "tap", vol: 0.3, label: "Impatient foot tap" })),
  { at: S2 + 138, sfx: "crickets", vol: 0.5, label: "Awkward pause" },
  { at: S2 + 149, sfx: "tok", vol: 0.35, label: "Tiny shrug" },
  { at: S2 + 172, sfx: "door-slam", vol: 1.0, label: "Door slams" },
  { at: S2 + 172, sfx: "impact", vol: 0.6, label: "Title hit" },
  { at: 320, sfx: "ripple-long", vol: 0.45, label: "Tile-flip transition" },
  // 03 — THE INVESTIGATION
  { at: S3 + 6, sfx: "whoosh", vol: 0.5, label: "Apartment splits into cards" },
  ...[0, 1, 2].map((k) => ({ at: S3 + 32 + k * 2, sfx: "blip", vol: 0.3, label: `Card 0${k + 1} header` })),
  { at: S3 + 44, sfx: "scan", vol: 0.45, label: "Scan — kitchen" },
  { at: S3 + CUT_A, sfx: "slam-hit", vol: 0.6, label: "WRONG MATERIAL." },
  { at: S3 + CUT_A, sfx: "glitch", vol: 0.3, label: "Cut" },
  { at: S3 + 52, sfx: "blip", vol: 0.4, label: "Marker" },
  { at: S3 + 54, sfx: "typing", vol: 0.25, label: "Callout text" },
  { at: S3 + ZOOM_A, sfx: "whoosh-short", vol: 0.45, label: "Snap-zoom" },
  { at: S3 + ZOOM_A + 2, sfx: "select", vol: 0.4, label: "Evidence 02" },
  { at: S3 + CUT_B, sfx: "slam-hit", vol: 0.6, label: "CLASHING TEXTURES." },
  { at: S3 + CUT_B, sfx: "glitch", vol: 0.3, label: "Cut" },
  { at: S3 + 96, sfx: "scan", vol: 0.45, label: "Scan — bathroom" },
  { at: S3 + 100, sfx: "blip", vol: 0.35, label: "Marker" },
  { at: S3 + 105, sfx: "blip", vol: 0.35, label: "Marker" },
  { at: S3 + 110, sfx: "blip", vol: 0.35, label: "Marker" },
  { at: S3 + ZOOM_B, sfx: "whoosh-short", vol: 0.45, label: "Snap-zoom" },
  { at: S3 + CUT_C, sfx: "slam-hit", vol: 0.6, label: "ZERO COORDINATION." },
  { at: S3 + CUT_C, sfx: "glitch", vol: 0.3, label: "Cut" },
  { at: S3 + 142, sfx: "select", vol: 0.45, label: "✕ marks" },
  { at: S3 + 146, sfx: "typing", vol: 0.3, label: "Score counts down" },
  { at: S4 - 12, sfx: "scan", vol: 0.5, label: "Scan wipe to the system" },
  // 04 — THE 3RAMIC SYSTEM
  { at: S4 + 2, sfx: "select", vol: 0.5, label: "Interface boots" },
  { at: S4 + 6, sfx: "typing", vol: 0.3, label: "Header" },
  ...[0, 1, 2, 3, 4, 5].map((k) => ({ at: S4 + 14 + k * 5, sfx: "whoosh-short", vol: 0.3, label: `Sample ${k + 1} arrives` })),
  { at: S4 + 44, sfx: "select", vol: 0.5, label: "Sample selected" },
  { at: S4 + 62, sfx: "whoosh", vol: 0.55, label: "Macro dive" },
  { at: S4 + 74, sfx: "ding", vol: 0.3, label: "Glint" },
  { at: S4 + 100, sfx: "whoosh", vol: 0.55, label: "Swoop to the rooms" },
  { at: S4 + 112, sfx: "slam-hit", vol: 0.35, label: "MATERIAL." },
  { at: S4 + 140, sfx: "slam-hit", vol: 0.35, label: "PATTERN." },
  { at: S4 + 168, sfx: "slam-hit", vol: 0.4, label: "PERSONALITY." },
  ...S4_SNAPS,
  // 05 — THE TRANSFORMATION
  { at: S5 + 2, sfx: "whoosh", vol: 0.5, label: "Rooms merge" },
  { at: S5 + 12, sfx: "ripple-long", vol: 0.5, label: "Re-tiling ripple" },
  ...[0, 1, 2].flatMap((k) => [
    { at: S5 + MACRO_FROM + k * MACRO_LEN, sfx: "impact", vol: 0.5, label: `Macro cut ${k + 1}` },
    { at: S5 + MACRO_FROM + k * MACRO_LEN + 1, sfx: "flip-cascade", vol: 0.55, label: `Macro ${k + 1} — tiles change material` },
  ]),
  { at: S5 + RETURN_FROM, sfx: "whoosh-short", vol: 0.4, label: "Cut — they come home" },
  { at: S5 + RETURN_FROM + 2, sfx: "suitcase-roll", vol: 0.35, label: "Rolling suitcases" },
  ...S5_HOPS,
  ...S5_LANDINGS,
  { at: S5 + 138, sfx: "whoosh-short", vol: 0.4, label: "Whip to the living room" },
  { at: S5 + 180, sfx: "whoosh-short", vol: 0.4, label: "Whip to the kitchen" },
  { at: S5 + Math.round(lastPlan.fallAt) + 2, sfx: "slowmo", vol: 0.6, label: "Slow motion" },
  { at: CLICK, sfx: "tile-click-big", vol: 1.0, label: "THE CLICK — last tile home" },
  { at: CLICK, sfx: "impact", vol: 0.6, label: "Deep impact" },
  { at: CLICK + 4, sfx: "ding", vol: 0.35, label: "Perfect fit glint" },
  { at: S5 + 258, sfx: "whoosh", vol: 0.45, label: "Pull back" },
  { at: S5 + 266, sfx: "slam-hit", vol: 0.3, label: "EVERYTHING in its PLACE." },
  // 06 — THE ENDING
  { at: S6, sfx: "whoosh-short", vol: 0.4, label: "Whip" },
  { at: S6 + 2, sfx: "steps-hero", vol: 0.5, label: "Hero walks toward camera" },
  { at: S6 + 30, sfx: "whoosh", vol: 0.3, label: "Crane up — the home comes into view" },
  { at: S6 + 36, sfx: "suitcase-down", vol: 0.85, label: "Suitcase set down" },
  { at: S6 + NOD_AT + 3, sfx: "tok", vol: 0.45, label: "Approving nod" },
  { at: END_CARD_AT - 8, sfx: "ripple-long", vol: 0.45, label: "Frame re-tiles to the logo card" },
  { at: END_CARD_AT, sfx: "impact", vol: 0.65, label: "End card" },
  { at: END_CARD_AT + 12, sfx: "whoosh-short", vol: 0.3, label: "Logo" },
  { at: END_CARD_AT + 36, sfx: "chime", vol: 0.5, label: "Tagline" },
];

export const SoundDesign: React.FC<{ volume?: number }> = ({ volume = 1 }) => (
  <>
    {CUE_SHEET.map((c, i) => (
      <Audio key={i} name={`SFX · ${c.label}`} src={staticFile(`audio/sfx/${c.sfx}.wav`)} from={c.at} volume={(c.vol ?? 0.6) * volume} />
    ))}
    {/* the march: tiny footsteps + suitcase wheels (Shot A), then the speed-ramped hallway stem (Shot B) */}
    <Audio name="SFX · March of the tiles" src={staticFile("audio/sfx/march.wav")} from={S2 + 22} durationInFrames={SHOT_B - 22} volume={0.5 * volume} />
    <Audio name="SFX · Hallway — speed ramp" src={staticFile("audio/sfx/hall-ramp.wav")} from={S2 + SHOT_B} durationInFrames={SHOT_C - SHOT_B} volume={0.55 * volume} />
    {/* they run home */}
    <Audio name="SFX · The tiles run home" src={staticFile("audio/sfx/march.wav")} from={S5 + RETURN_FROM} durationInFrames={100} volume={0.4 * volume} />
  </>
);
