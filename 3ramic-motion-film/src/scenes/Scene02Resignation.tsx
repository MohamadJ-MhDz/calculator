import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { blink, clamp, E, kv, lerp, prog, shake, V3 } from "../anim";
import { Cam, StudioEnv, DPR } from "../three/kit";
import { ApartmentSet, buildFloor, FloorTile, NightLights } from "../three/Apartment";
import { TileCharacter, TileCharProps, TILE_T } from "../three/TileCharacter";
import { ChapterTag, FilmGrain, Vignette } from "../ui/Overlays";
import { Stamp } from "../ui/Stamp";
import { MONO } from "../fonts";

/**
 * SCENE 02 — THE RESIGNATION (5–11 s)
 * The whole floor pops up in a ripple, turns its back on the room and queues
 * for the door like exhausted office workers. Three shots with story-time
 * ellipsis between them; ends on the last tile's awkward look back + door slam.
 */

const V = 0.1; // column speed (units / story frame)
const GAP = 0.75; // spacing in the queue
const T_GO = 25; // hero starts walking

const D = (T: number) => {
  const t = T - T_GO;
  if (t <= 0) return 0;
  if (t < 8) return (V * t * t) / 16;
  return V * (t - 4);
};

/** Shot A: T = f · Shot B: +40 · Shot C: +170 (ellipsis across cuts — the column is gone by C). */
const storyT = (f: number) => (f < 80 ? f : f < 122 ? f + 40 : f + 170);

const smooth = (t: number) => t * t * (3 - 2 * t);
const lane = (s: number): V3 => [-0.7 * smooth(clamp((s - 3.3) / 2.2)), 0, -s];

const tPop = (t: FloorTile) => (t.hero ? -100 : 3 + Math.hypot(t.x, t.zc + 2.5) * 4.5);

const moodFace = (t: FloorTile, f: number) => {
  if (t.hero) return { brow: 0.85, mouth: -0.85, eyes: blink(f, [40, 118]), lean: 0.02, look: [0, 0] as [number, number] };
  if (t.mood === "angry") return { brow: 0.85, mouth: -0.75, eyes: blink(f, [t.id * 7 + 20, t.id * 5 + 95]), lean: -0.02, look: [0, 0] as [number, number] };
  if (t.mood === "tired") return { brow: -0.45, mouth: -0.35, eyes: 0.42, lean: 0.2, look: [0, -0.4] as [number, number] };
  return { brow: 0.45, mouth: -1, eyes: blink(f, [t.id * 3 + 30]), lean: 0.05, look: [0.4, 0.85] as [number, number] }; // huffy: eye-roll
};

type Pose = TileCharProps & { hidden?: boolean };

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
  const mood = moodFace(t, f);
  const base: Pose = {
    tex: t.tex,
    faceRot: t.faceRot,
    scale: t.scale,
    luggage: t.luggage,
    shoes: t.hero ? COLORS.orange : "#151B23",
  };
  if (d < 0) {
    return { ...base, position: [t.x, 0, t.zc + 0.5], tilt: 1, lift: -TILE_T / 2, legs: 0, arms: 0, face: 0 };
  }
  // pop + hinge + legs (compressed version of the hero's move)
  const pop = E.outBack(prog(d, 0, 5), 2.2);
  const hinge = E.settle(prog(d, 5, 14), 2.6, 5);
  const lift = d < 5 ? lerp(-TILE_T / 2, 0.26, pop) : lerp(0.26, 0, E.outCubic(prog(d, 5, 9)));
  const legs = E.outElastic(prog(d, 8, 12));
  const land = prog(d, 14, 9);
  const squash = d >= 14 ? Math.sin(land * Math.PI) * 0.7 * (1 - land) : 0;

  const { pos, u, slot } = positionAt(t, T);
  const next = positionAt(t, T + 0.5).pos;
  const dx = next[0] - pos[0];
  const dz = next[2] - pos[2];
  const moving = Math.hypot(dx, dz) > 1e-4;
  let dir = Math.atan2(dx, dz);
  if (dir < 0) dir += Math.PI * 2;
  const turn = t.hero ? Math.PI * E.inOutCubic(prog(T, 4, 12)) : Math.PI * E.inOutCubic(prog(d, 20, 10));
  const facing = moving ? lerp(turn, dir, clamp(u * 5)) : turn;
  const walked = Math.max(0, slot - (t.s0 - 0.3));
  const tempo = t.mood === "angry" ? 12.5 : t.mood === "tired" ? 8.5 : 10.5;
  const stride = moving ? clamp(u * 6) * (t.mood === "angry" ? 1.15 : t.mood === "tired" ? 0.75 : 1) : 0;
  const impatience = !moving && d > 30 && t.mood === "angry" ? Math.max(0, Math.sin(f * 0.9 + t.id)) * 0.03 : 0;

  return {
    ...base,
    position: pos,
    facing,
    tilt: d < 5 ? 1 : 1 - hinge,
    lift: lift + impatience,
    legs: d < 8 ? 0 : legs,
    arms: E.outBack(prog(d, 13, 8)),
    face: E.outBack(prog(d, 9, 8), 2.4),
    eyes: mood.eyes,
    look: moving ? mood.look : ([Math.sin(f * 0.07 + t.id) * 0.6, 0.1] as [number, number]),
    brow: mood.brow,
    mouth: mood.mouth,
    lean: mood.lean * stride,
    squash,
    walk: walked * tempo + t.id,
    stride,
    carry: t.carry,
    hidden: slot > 10.5,
  };
};

/** The last, smallest tile: hesitates at the door and looks back at us. */
const lastTilePose = (t: FloorTile, f: number): Pose => {
  const walkIn = E.inOutSine(prog(f, 122, 18));
  const walkOut = E.inCubic(prog(f, 169, 9));
  const s = lerp(0.6, 2.72, walkIn) + walkOut * 1.2;
  const turnBack = E.inOutCubic(prog(f, 141, 8));
  const turnAway = E.inOutCubic(prog(f, 164, 5));
  const facing = Math.PI + turnBack * Math.PI - turnAway * Math.PI;
  const shrug = Math.sin(prog(f, 156, 8) * Math.PI);
  const moving = (f >= 122 && f < 140) || f >= 169;
  return {
    tex: t.tex,
    scale: t.scale,
    position: [0, 0, -s],
    facing,
    carry: "box",
    walk: s * 10.5,
    stride: moving ? 0.9 : 0,
    eyes: Math.min(1, blink(f, [153])),
    look: f >= 148 && f < 164 ? [0, 0.1] : [0, 0],
    brow: f >= 148 ? -0.35 : 0.4,
    browLift: shrug * 0.07,
    mouth: f >= 148 ? 0 : -0.6,
    lift: shrug * 0.05,
    hidden: f >= 176,
  };
};

export const Scene02Resignation: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const floor = useMemo(() => buildFloor(), []);
  const T = storyT(f);
  const lastRank = Math.max(...floor.map((t) => t.rank));

  // door: opens as the hero turns, slams at the end
  const doorOpen = f < 172 ? E.outCubic(prog(T, 8, 16)) : 1 - E.inExpo(prog(f, 172, 4)) + Math.sin(prog(f, 176, 6) * Math.PI) * 0.04;
  const hall = clamp(doorOpen * 1.2);

  // cameras
  let pos: V3;
  let target: V3;
  let fov: number;
  if (f < 80) {
    // faces first (they stand up facing us), then rise to watch the queue snake to the door
    pos = kv(f, [0, 34, 80], [[2.7, 3.3, 4.8], [2.3, 3.5, 4.4], [1.5, 6.0, 2.6]], E.inOutSine);
    target = kv(f, [0, 34, 80], [[-0.1, 0.4, -0.6], [0, 0.45, -0.9], [0, 0, -2.2]], E.inOutSine);
    fov = lerp(44, 40, f / 80);
  } else if (f < 122) {
    pos = kv(f, [80, 122], [[0.8, 0.62, -6.6], [0.62, 0.72, -7.7]], E.outCubic);
    target = [-0.15, 0.6, -2.4];
    fov = 36;
  } else {
    pos = kv(f, [122, 180], [[1.0, 0.62, 3.4], [0.62, 0.66, 2.3]], E.inOutSine);
    target = [0.0, 0.85, -3.0];
    fov = 38;
  }
  const [sx, sy] = shake(f, 172, 14, 0.07);
  pos = [pos[0] + sx, pos[1] + sy, pos[2]];

  const leftCount = floor.filter((t) => t.rank >= 0 && 2 + D(T) - t.rank * GAP > 3.1).length;

  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      <AbsoluteFill style={{ filter: "saturate(0.95) contrast(1.06)" }}>
        <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true }}>
          <color attach="background" args={[COLORS.night]} />
          <fog attach="fog" args={[COLORS.night, 10, 24]} />
          <StudioEnv intensity={0.14} />
          <NightLights hall={hall} clockGlow={1} moon={1} />
          <Cam pos={pos} target={target} fov={fov} />
          <ApartmentSet doorOpen={doorOpen} clockText="03:17" colon={Math.floor((f + 150) / 15) % 2 === 0} />
          {floor.map((t) => {
            if (t.stuck) {
              return (
                <TileCharacter key={t.id} position={[t.x, 0, t.zc + 0.5]} tex={t.tex} faceRot={t.faceRot} tilt={1} lift={-TILE_T / 2} legs={0} arms={0} face={0} />
              );
            }
            const p = t.rank === lastRank && f >= 122 ? lastTilePose(t, f) : tilePose(t, T, f);
            const { hidden, ...props } = p;
            if (hidden) return null;
            return <TileCharacter key={t.id} {...props} />;
          })}
        </ThreeCanvas>
      </AbsoluteFill>

      <ChapterTag n="02" title="The Resignation" start={4} dur={72} />
      <Stamp text="RESIGNED." start={30} dur={46} top={300} rotate={-7} />
      {f >= 80 && f < 122 ? (
        <div
          style={{
            position: "absolute",
            top: 140,
            right: 72,
            fontFamily: MONO,
            color: COLORS.ivory,
            textAlign: "right",
            letterSpacing: "0.12em",
            opacity: E.outCubic(prog(f, 80, 8)),
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.75 }}>TILES THAT LEFT THE BUILDING</div>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1, color: COLORS.orange }}>
            {String(leftCount).padStart(2, "0")}
            <span style={{ fontSize: 40, color: COLORS.ivory, opacity: 0.6 }}>/{String(lastRank + 1).padStart(2, "0")}</span>
          </div>
        </div>
      ) : null}
      <Vignette strength={0.62} />
      <FilmGrain opacity={0.08} />
    </AbsoluteFill>
  );
};
