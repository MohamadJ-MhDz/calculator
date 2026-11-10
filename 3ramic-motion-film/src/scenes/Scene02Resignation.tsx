import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SCENES } from "../brand";
import { blink, clamp, E, kf, kv, lerp, prog, shake, V3 } from "../anim";
import { Cam, StudioEnv, DPR } from "../three/kit";
import { ApartmentSet, buildFloor, FloorTile, NightLights } from "../three/Apartment";
import { TileCharacter, TileCharProps, TILE_T } from "../three/TileCharacter";
import { ChapterTag, FilmGrain, Vignette } from "../ui/Overlays";
import { Stamp } from "../ui/Stamp";
import { MONO } from "../fonts";
import { wakeAt } from "./Scene01Incident";

/**
 * SCENE 02 — THE RESIGNATION (5–11 s)
 * The whole floor stands up and queues for the door like exhausted office workers.
 * One tile is too angry to queue: it tucks its legs in and ROLLS out. Another waits by the
 * door with a tiny briefcase, checking its watch.
 *   Shot A  (0–80)    the floor rises, the queue forms, the roller storms off
 *   Shot B  (80–122)  hallway tracking shot with a speed ramp (fast → slow-motion → fast)
 *   Shot C  (122–180) the comedic pause at the door, then the slam
 */

const V = 0.1; // column speed (units / story frame)
const GAP = 0.75; // spacing in the queue
const T_GO = 25; // hero starts walking
export const SHOT_B = 80;
export const SHOT_C = 122;

const D = (T: number) => {
  const t = T - T_GO;
  if (t <= 0) return 0;
  if (t < 8) return (V * t * t) / 16;
  return V * (t - 4);
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Playback speed of story time during Shot B: 1.3× → 0.22× (slow motion) → 1.5×. */
export const speedB = (f: number) => lerp(lerp(1.3, 0.22, smooth(clamp((f - 92) / 4))), 1.5, smooth(clamp((f - 104) / 4)));

/** Story time elapsed since the start of Shot B (integral of the speed ramp). */
export const tauB = (f: number) => {
  let tau = 0;
  const end = Math.min(f, SHOT_C);
  for (let x = SHOT_B; x < end; x += 0.25) tau += speedB(x + 0.125) * Math.min(0.25, end - x);
  return tau;
};

/** Shot A: T = f · Shot B: 120 + ramped time · Shot C: +170 (ellipsis across cuts — the column is gone by C). */
const storyT = (f: number) => (f < SHOT_B ? f : f < SHOT_C ? 120 + tauB(f) : f + 170);

const lane = (s: number): V3 => [-0.7 * smooth(clamp((s - 3.3) / 2.2)), 0, -s];

const tPop = (t: FloorTile) => (t.hero ? -100 : 3 + Math.hypot(t.x, t.zc + 2.5) * 4.5);

const moodFace = (t: FloorTile, f: number) => {
  if (t.hero) return { brow: 0.85, mouth: -0.85, eyes: blink(f, [40, 118]), lean: 0.02, look: [0, 0] as [number, number] };
  if (t.mood === "angry") return { brow: 0.85, mouth: -0.75, eyes: blink(f, [t.id * 7 + 20, t.id * 5 + 95]), lean: -0.02, look: [0, 0] as [number, number] };
  if (t.mood === "tired") return { brow: -0.45, mouth: -0.35, eyes: 0.42, lean: 0.2, look: [0, -0.4] as [number, number] };
  return { brow: 0.45, mouth: -1, eyes: blink(f, [t.id * 3 + 30]), lean: 0.05, look: [0.4, 0.85] as [number, number] }; // huffy: eye-roll
};

type Pose = TileCharProps & { hidden?: boolean };

/** Still lying in the floor, but already awake and rattling (continues the last beat of Scene 01). */
const flatPose = (t: FloorTile, f: number): Pose => {
  const d = SCENES.incident.dur + f - wakeAt(t);
  return {
    tex: t.tex,
    faceRot: t.faceRot,
    position: [t.x, 0, t.zc + 0.5],
    tilt: 1,
    lift: -TILE_T / 2 + Math.max(0, Math.sin(d * 1.5 + t.id * 2.1)) * 0.045,
    sway: Math.sin(d * 1.5 + t.id) * 0.035,
    legs: 0,
    arms: 0,
    face: 1,
    eyes: 1,
    look: [Math.sin((f + 150) * 0.22 + t.id) * 0.7, 0.25],
    brow: t.mood === "angry" ? 0.7 : t.mood === "tired" ? -0.4 : 0.3,
    mouth: -0.5,
  };
};

/** Pop out of the floor, hinge upright, grow legs (compressed version of the hero's move). */
const standUp = (d: number) => {
  const pop = E.outBack(prog(d, 0, 5), 2.2);
  const hinge = E.settle(prog(d, 5, 14), 2.6, 5);
  const land = prog(d, 14, 9);
  return {
    tilt: d < 5 ? 1 : 1 - hinge,
    lift: d < 5 ? lerp(-TILE_T / 2, 0.26, pop) : lerp(0.26, 0, E.outCubic(prog(d, 5, 9))),
    legs: d < 8 ? 0 : E.outElastic(prog(d, 8, 12)),
    arms: E.outBack(prog(d, 13, 8)),
    face: 1,
    squash: d >= 14 ? Math.sin(land * Math.PI) * 0.7 * (1 - land) : 0,
  };
};

const positionAt = (t: FloorTile, T: number): { pos: V3; u: number; slot: number } => {
  const slot = 2 + D(T) - t.rank * GAP;
  const u = clamp((slot - (t.s0 - 0.3)) / 1.5);
  const us = smooth(u);
  const L = lane(slot);
  const spot: V3 = [t.x, 0, -t.s0];
  return { pos: [lerp(spot[0], L[0], us), 0, lerp(spot[2], L[2], us)], u, slot };
};

const tilePose = (t: FloorTile, T: number, f: number): Pose => {
  const d = T - tPop(t);
  if (d < 0) return flatPose(t, f);
  const mood = moodFace(t, f);
  const up = standUp(d);
  const { pos, u, slot } = positionAt(t, T);
  const next = positionAt(t, T + 0.5).pos;
  const dx = next[0] - pos[0];
  const dz = next[2] - pos[2];
  const moving = Math.hypot(dx, dz) > 1e-4;
  let dir = Math.atan2(dx, dz);
  if (dir < 0) dir += Math.PI * 2;
  // the hero already turned its back on the room at the end of Scene 01
  const turn = t.hero ? Math.PI : Math.PI * E.inOutCubic(prog(d, 20, 10));
  const facing = moving ? lerp(turn, dir, clamp(u * 5)) : turn;
  const walked = Math.max(0, slot - (t.s0 - 0.3));
  const tempo = t.mood === "angry" ? 12.5 : t.mood === "tired" ? 8.5 : 10.5;
  const stride = moving ? clamp(u * 6) * (t.mood === "angry" ? 1.15 : t.mood === "tired" ? 0.75 : 1) : 0;
  const impatience = !moving && d > 30 && t.mood === "angry" ? Math.max(0, Math.sin(f * 0.9 + t.id)) * 0.03 : 0;

  return {
    tex: t.tex,
    faceRot: t.faceRot,
    scale: t.scale,
    luggage: t.luggage,
    shoes: t.hero ? COLORS.orange : "#151B23",
    position: pos,
    facing,
    ...up,
    lift: up.lift + impatience,
    eyes: mood.eyes,
    look: moving ? mood.look : ([Math.sin(f * 0.07 + t.id) * 0.6, 0.1] as [number, number]),
    brow: mood.brow,
    mouth: mood.mouth,
    lean: mood.lean * stride,
    walk: walked * tempo + t.id,
    stride,
    carry: t.carry,
    hidden: slot > 13.2,
  };
};

/* ---------------- the roller: too angry to queue ---------------- */

const ROLL_START = 58;

/** Distance the roller has rolled along the floor (Shot A: from its own spot · Shot B: hallway position). */
export const rollerDist = (f: number) => {
  if (f < SHOT_B) {
    const t = f - ROLL_START;
    if (t <= 0) return 0;
    return t < 14 ? 0.006 * t * t : 1.176 + 0.17 * (t - 14);
  }
  return 4.6 + 0.16 * tauB(f); // already clear of the open door leaf when the hallway shot starts
};

const rollerPose = (t: FloorTile, f: number): Pose => {
  const base: Pose = { tex: t.tex, faceRot: 0, scale: t.scale, brow: 0.95, mouth: -1, eyes: 1 };
  if (f >= SHOT_C) return { ...base, hidden: true };
  const dist = rollerDist(f);
  const roll = (-Math.PI / 2) * (dist / t.scale);
  if (f >= SHOT_B) {
    return { ...base, position: [lerp(0.5, 0.08, smooth(clamp((dist - 4.6) / 1.2))), 0, -dist], facing: Math.PI / 2, legs: 0, arms: 0, roll, look: [0.5, 0.2] };
  }
  const d = f - tPop(t);
  if (d < 0) return flatPose(t, f);
  const up = standUp(d);
  const stomp = f >= 34 && f < 50 ? Math.abs(Math.sin((f - 34) * 0.95)) * 0.1 : 0;
  const tuck = E.inOutCubic(prog(f, 51, 7));
  return {
    ...base,
    ...up,
    position: [lerp(t.x, 0.66, smooth(clamp(dist / 2))), 0, -t.s0 - dist],
    facing: (Math.PI / 2) * E.inOutCubic(prog(f, 44, 9)),
    lift: up.lift + stomp * (1 - tuck),
    legs: up.legs * (1 - tuck),
    arms: up.arms * (1 - tuck),
    sway: stomp > 0 ? Math.sin(f * 1.9) * 0.07 : 0,
    armRaise: stomp > 0 ? 0.8 : 0,
    wave: f * 1.4,
    look: [Math.sin(f * 0.3) * 0.5, 0.1],
    roll,
  };
};

/* ---------------- the waiter: by the door, tiny briefcase, checking the time ---------------- */

const WAIT: V3 = [-1.05, 0, -2.45];

const waiterPose = (t: FloorTile, f: number, T: number): Pose => {
  const base: Pose = { tex: t.tex, faceRot: t.faceRot, scale: t.scale, luggage: t.luggage, carry: "briefcase" };
  const d = T - tPop(t);
  if (d < 0) return flatPose(t, f);
  const up = standUp(d);
  const shuffle = E.inOutSine(prog(d, 20, 12));
  const tapping = f < 158 && d > 34;
  const check = f >= SHOT_C ? E.inOutCubic(prog(f, 128, 6)) * (1 - E.inOutCubic(prog(f, 145, 6))) : 0;
  // leaves last: sidesteps into the doorway, then hurries out before the slam
  const side = E.inOutSine(prog(f, 160, 6));
  const exit = E.inCubic(prog(f, 166, 7));
  const x = lerp(lerp(t.x, WAIT[0], shuffle), -0.25, side);
  const z = lerp(lerp(-t.s0, WAIT[2], shuffle), -2.55, side) - exit * 1.9;
  const facing = lerp(lerp(0.6 * shuffle, Math.PI / 2, side), Math.PI, E.inOutCubic(prog(f, 165, 4)));
  const moving = (d >= 20 && d < 32) || f >= 160;
  return {
    ...base,
    ...up,
    position: [x, 0, z],
    facing,
    walk: (x + z) * 12,
    stride: moving ? 0.9 : 0,
    tap: tapping ? Math.max(0, Math.sin(f * 0.9)) * 0.55 : 0,
    watch: check,
    eyes: blink(f, [44, 126, 152]),
    look: check > 0.5 ? [-0.5, -0.8] : f >= 146 && f < 160 ? [0.9, -0.1] : [0.8, 0.05],
    brow: 0.5,
    browLift: check * 0.05,
    mouth: -0.55,
    lean: check * 0.12,
    hidden: f >= 176,
  };
};

/** The last, smallest tile: hesitates at the door and looks back at us. */
const lastTilePose = (t: FloorTile, f: number): Pose => {
  const walkIn = E.inOutSine(prog(f, 122, 16));
  const walkOut = E.inCubic(prog(f, 160, 8));
  const s = lerp(0.6, 2.72, walkIn) + walkOut * 1.2;
  const turnBack = E.inOutCubic(prog(f, 138, 8));
  const turnAway = E.inOutCubic(prog(f, 156, 5));
  const facing = Math.PI + turnBack * Math.PI - turnAway * Math.PI;
  const shrug = Math.sin(prog(f, 149, 8) * Math.PI);
  const moving = (f >= 122 && f < 138) || f >= 160;
  return {
    tex: t.tex,
    scale: t.scale,
    position: [0, 0, -s],
    facing,
    carry: "box",
    walk: s * 10.5,
    stride: moving ? 0.9 : 0,
    eyes: Math.min(1, blink(f, [147])),
    look: f >= 144 && f < 157 ? [0, 0.1] : [0, 0],
    brow: f >= 144 ? -0.35 : 0.4,
    browLift: shrug * 0.07,
    mouth: f >= 144 ? 0 : -0.6,
    lift: shrug * 0.05,
    hidden: f >= 172,
  };
};

export const Scene02Resignation: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const floor = useMemo(() => buildFloor(), []);
  const T = storyT(f);
  const lastRank = Math.max(...floor.map((t) => t.rank));

  // door: opens as the hero reaches it, slams at the end
  const doorOpen = f < 172 ? E.outCubic(prog(T, 8, 16)) : 1 - E.inExpo(prog(f, 172, 4)) + Math.sin(prog(f, 176, 6) * Math.PI) * 0.04;
  const hall = clamp(doorOpen * 1.2);

  // cameras
  let pos: V3;
  let target: V3;
  let fov: number;
  let roll = 0;
  if (f < SHOT_B) {
    // faces first (they stand up facing us), then rise to watch the queue snake to the door
    pos = kv(f, [0, 34, 80], [[2.7, 3.3, 4.8], [2.3, 3.5, 4.4], [1.5, 6.0, 2.6]], E.inOutSine);
    target = kv(f, [0, 34, 80], [[-0.1, 0.4, -0.6], [0, 0.45, -0.9], [0, 0, -2.2]], E.inOutSine);
    fov = lerp(44, 40, f / 80);
  } else if (f < SHOT_C) {
    // leading tracking shot through a dollhouse cutaway of the hallway: we fly backwards,
    // high and just ahead of the roller, so its face and the queue's faces both read
    const s = rollerDist(f);
    const k = (f - SHOT_B) / (SHOT_C - SHOT_B);
    pos = [lerp(3.3, 2.7, k), lerp(2.9, 2.5, k), -(s + 2.6)];
    target = [-0.15, 0.5, -(s - 0.35)];
    fov = 38;
    roll = Math.sin((f - SHOT_B) * 0.5) * 0.012 * speedB(f);
  } else {
    pos = kv(f, [122, 180], [[0.7, 0.62, 3.6], [0.35, 0.66, 2.9]], E.inOutSine);
    target = [-0.5, 0.85, -3.0];
    fov = 40;
  }
  const [sx, sy] = shake(f, 172, 14, 0.07);
  pos = [pos[0] + sx, pos[1] + sy, pos[2]];

  const leftCount = floor.filter((t) => t.rank >= 0 && 2 + D(T) - t.rank * GAP > 3.1).length + (f >= SHOT_B ? 1 : 0);
  const total = floor.filter((t) => !t.stuck).length;
  const slowmo = f >= SHOT_B && f < SHOT_C ? 1 - clamp((speedB(f) - 0.22) / 0.6) : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      <AbsoluteFill style={{ filter: "saturate(0.95) contrast(1.06)" }}>
        <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true }}>
          <color attach="background" args={[COLORS.night]} />
          <fog attach="fog" args={[COLORS.night, 10, 24]} />
          <StudioEnv intensity={0.14} />
          <NightLights hall={hall} clockGlow={1} moon={1} />
          <Cam pos={pos} target={target} fov={fov} roll={roll} />
          <ApartmentSet doorOpen={doorOpen} clockText="03:17" colon={Math.floor((f + 150) / 15) % 2 === 0} hallCutaway={f >= SHOT_B && f < SHOT_C} />
          {floor.map((t) => {
            if (t.stuck) {
              return (
                <TileCharacter key={t.id} position={[t.x, 0, t.zc + 0.5]} tex={t.tex} faceRot={t.faceRot} tilt={1} lift={-TILE_T / 2} legs={0} arms={0} face={0} />
              );
            }
            const p =
              t.role === "roller"
                ? rollerPose(t, f)
                : t.role === "waiter"
                  ? waiterPose(t, f, T)
                  : t.rank === lastRank && f >= SHOT_C
                    ? lastTilePose(t, f)
                    : tilePose(t, T, f);
            const { hidden, ...props } = p;
            if (hidden) return null;
            return <TileCharacter key={t.id} {...props} />;
          })}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* slow-motion grade: the ramp desaturates slightly and the speed chip appears */}
      {slowmo > 0.01 ? <AbsoluteFill style={{ background: COLORS.midnight, mixBlendMode: "soft-light", opacity: slowmo * 0.55 }} /> : null}

      <ChapterTag n="02" title="The Resignation" start={4} dur={72} />
      <Stamp text="RESIGNED." start={28} dur={30} top={300} rotate={-7} />
      {f >= SHOT_B && f < SHOT_C ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 140,
              right: 72,
              fontFamily: MONO,
              color: COLORS.ivory,
              textAlign: "right",
              letterSpacing: "0.12em",
              opacity: E.outCubic(prog(f, SHOT_B, 8)),
            }}
          >
            <div style={{ fontSize: 22, opacity: 0.75 }}>TILES THAT LEFT THE BUILDING</div>
            <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1, color: COLORS.orange }}>
              {String(leftCount).padStart(2, "0")}
              <span style={{ fontSize: 40, color: COLORS.ivory, opacity: 0.6 }}>/{String(total).padStart(2, "0")}</span>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: 140,
              left: 72,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: MONO,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: COLORS.charcoal,
              background: slowmo > 0.5 ? COLORS.orange : COLORS.ivory,
              padding: "6px 14px",
              opacity: E.outCubic(prog(f, SHOT_B + 2, 6)),
            }}
          >
            <span>{slowmo > 0.5 ? "SLOW-MO" : "SPEED"}</span>
            <span>×{kf(speedB(f), [0, 2], [0, 2], E.linear).toFixed(1)}</span>
          </div>
        </>
      ) : null}
      <Vignette strength={0.62} />
      <FilmGrain opacity={0.08} />
    </AbsoluteFill>
  );
};
