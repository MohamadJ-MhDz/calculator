import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { blink, clamp, E, kf, lerp, prog, V3 } from "../anim";
import { Cam, flat, KeyLight, plane, StudioEnv, DPR } from "../three/kit";
import { FlipTile, RoomModel } from "../three/RoomModel";
import { TileCharacter, TileCharProps, TILE_T } from "../three/TileCharacter";
import { TexKey } from "../three/textures";
import { project } from "../three/project";
import { ChapterTag, FilmGrain, SlamWord, Vignette } from "../ui/Overlays";
import { MONO, SERIF } from "../fonts";
import { DOOR, DOOR_Z, HANDOFF_CAM, HOLES, holeWorld, JOINED, PLAN, ROOM_SLOTS, STUDIO_FLOOR_Y } from "./sceneShared";

/**
 * SCENE 05 — THE TRANSFORMATION (24–34 s)
 *   0–45    the three rooms re-join into one apartment while a re-tiling ripple runs through it
 *   45–90   macro montage — three one-beat cuts on real tile bodies flipping from the wrong
 *           material to the right one: MATTE (porcelain) · GLOSS (marble-look) · DEPTH (travertine)
 *   90–190  the tiles come home in triumph: they charge in through their own doors, arms up
 *   190–260 low in the kitchen; slow-motion macro on the last tile clicking into its slot (f 240)
 *   260–300 pull back over the finished home
 */

const KINDS = ["kitchen", "living", "bathroom"] as const;

export const MACRO_FROM = 45;
export const MACRO_LEN = 15; // one beat at 120 bpm
export const RETURN_FROM = MACRO_FROM + MACRO_LEN * 3; // 90

/* ---------------- the re-assembled apartment (shared with Scene 06) ---------------- */

export const Apartment3: React.FC<{
  merge?: number;
  ripple?: (world: V3) => number;
  filled: (holeIndex: number) => boolean;
  sideRows?: number;
  ground?: number;
}> = ({ merge = 1, ripple, filled, sideRows = 99, ground = 1 }) => {
  const groundMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#EADFD1", roughness: 0.9, transparent: true }), []);
  groundMat.opacity = ground;
  return (
    <group>
      {ground > 0.01 ? (
        <mesh geometry={plane(80, 80)} material={groundMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, STUDIO_FLOOR_Y, 0]} receiveShadow />
      ) : null}
      {KINDS.map((kind, idx) => {
        const slot = ROOM_SLOTS.find((r) => r.kind === kind)!;
        const t = E.inOutCubic(clamp(merge * 1.25 - idx * 0.125));
        const p: V3 = [lerp(slot.pos[0], JOINED[kind][0], t), lerp(slot.pos[1], JOINED[kind][1], t), lerp(slot.pos[2], JOINED[kind][2], t)];
        const rot = lerp(slot.rotY, 0, t);
        const plan = PLAN[kind];
        return (
          <RoomModel
            key={kind}
            kind={kind}
            position={p}
            rotation={[0, rot, 0]}
            counter={plan.counter}
            floor={(i, j) => {
              const hi = HOLES.findIndex((h) => h.kind === kind && h.ij[0] === i && h.ij[1] === j);
              if (hi >= 0 && !filled(hi)) return { a: plan.floor, hidden: true };
              const w: V3 = [JOINED[kind][0] - 1.5 + i, 0, JOINED[kind][2] - 1.5 + j];
              const r = ripple ? ripple(w) : 0;
              return { a: plan.floor, b: plan.floor, flip: r };
            }}
            backWall={plan.wall}
            sideWall={kind === "bathroom" ? "marble" : kind === "kitchen" ? "porcelain" : null}
            wallRows={kind === "kitchen" ? sideRows : 99}
            wallTile={kind === "living" ? 0.7 : 0.5}
            plaster="plasterStone"
            plinth
            sideDoor={{ z: DOOR_Z[kind], w: DOOR.w, h: DOOR.h }}
          />
        );
      })}
    </group>
  );
};

/* ---------------- macro montage: real tile bodies changing material ---------------- */

type Macro = { a: TexKey; b: TexKey; word: string; chip: string; cam0: V3; cam1: V3; target: V3; fov: number };

export const MACROS: Macro[] = [
  // grazing light across a matte surface: no glare, just a soft falloff
  { a: "pool", b: "porcelain", word: "MATTE.", chip: "01 · MATTE PORCELAIN", cam0: [2.9, 0.66, 2.3], cam1: [2.3, 0.52, 1.9], target: [0.1, 0.02, 0.1], fov: 30 },
  // a hard light sliding over a polished glaze
  { a: "checker", b: "marble", word: "GLOSS.", chip: "02 · POLISHED MARBLE-LOOK", cam0: [-2.2, 1.5, 2.6], cam1: [-1.6, 1.25, 2.2], target: [0.2, 0, 0], fov: 32 },
  // down at grout level: body thickness, bevelled edges, the gap between tiles
  { a: "terracotta", b: "stone", word: "DEPTH.", chip: "03 · NATURAL STONE · EDGE & BODY", cam0: [2.0, 0.42, 2.1], cam1: [1.6, 0.3, 1.7], target: [0.2, 0.05, 0], fov: 28 },
];

const MacroStage: React.FC<{ shot: number; t: number }> = ({ shot, t }) => {
  const m = MACROS[shot];
  const tiles: React.ReactNode[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      // the change sweeps from the far corner toward the lens
      // …and is finished by two-thirds of the shot, so the new surface gets a clean beat under the light
      const start = (i + 2 + (j + 2)) * 0.55 - 1;
      tiles.push(
        <FlipTile key={`${i}:${j}`} a={m.a} b={m.b} flip={E.inOutCubic(clamp((t - start) / 6))} position={[i, 0, j]} faceRot={((i * 7 + j * 3 + 20) % 4) * (Math.PI / 2)} />,
      );
    }
  }
  return (
    <group>
      {/* grout bed */}
      <mesh geometry={plane(12, 12)} material={flat("#BDB5A8", 0.95)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
      {tiles}
      <pointLight position={[lerp(-2.2, 2.2, t / MACRO_LEN), 0.55, 0.9]} intensity={3.2} distance={4.5} decay={2} color="#FFF6EC" />
    </group>
  );
};

/* ---------------- returning characters ---------------- */

type Plan = {
  e: number;
  z: number;
  startX: number;
  edgeX: number;
  hopAt: number;
  walkEnd: number;
  fallAt: number;
  fallDur: number;
  tex: TileCharProps["tex"];
};

const V = 0.18; // they come back at a run
const HOP_DUR = 8;
const OUT_X = -2.62; // behind the side wall, on the studio floor
const IN_X = -1.72; // just inside the door
/** Frame each tile bursts through its room's door (three per room: bathroom, living room, kitchen). */
const HOP = [88, 92, 96, 130, 134, 138, 172, 178, 186];

export const buildPlans = (): Plan[] => {
  const plans = HOLES.map((h, n) => {
    const c = holeWorld(h.kind, h.ij);
    const hopAt = HOP[n];
    const startX = OUT_X - 1.9;
    const edgeX = c[0] + 0.5;
    const walkEnd = hopAt + HOP_DUR + (edgeX - IN_X) / V;
    return { e: hopAt - (OUT_X - startX) / V, z: c[2], startX, edgeX, hopAt, walkEnd, fallAt: 0, fallDur: 10, tex: PLAN[h.kind].floor };
  });
  plans.forEach((p, n) => {
    const last = n === plans.length - 1;
    const group = plans.slice(n - (n % 3), n - (n % 3) + 3);
    const arrive = Math.max(...group.map((g) => g.walkEnd));
    // a beat of cheering together, then they lie back into their slots one after another
    p.fallAt = last ? Math.max(arrive + 8, 214) : arrive + 5 + (n % 3) * 3;
    p.fallDur = last ? 26 : 10; // the last one is the slow-motion macro
  });
  return plans;
};

const charPose = (pl: Plan, f: number, n: number): (TileCharProps & { done: boolean }) | null => {
  if (f < pl.e) return null;
  const done = f >= pl.fallAt + pl.fallDur + 4;
  let pos: V3;
  let stride = 0;
  if (f < pl.hopAt) {
    pos = [pl.startX + (f - pl.e) * V, STUDIO_FLOOR_Y, pl.z];
    stride = 1;
  } else if (f < pl.hopAt + HOP_DUR) {
    const t = prog(f, pl.hopAt, HOP_DUR);
    pos = [lerp(OUT_X, IN_X, t), lerp(STUDIO_FLOOR_Y, 0, E.outCubic(t)) + Math.sin(t * Math.PI) * 0.42, pl.z];
  } else if (f < pl.walkEnd) {
    pos = [IN_X + (f - pl.hopAt - HOP_DUR) * V, 0, pl.z];
    stride = 1;
  } else {
    pos = [pl.edgeX, 0, pl.z];
  }
  const fall = E.inCubic(prog(f, pl.fallAt, pl.fallDur));
  const settle = prog(f, pl.fallAt + pl.fallDur, 8);
  const arrived = f >= pl.walkEnd;
  // victory bounce on the spot until it is their turn to lie down
  const cheerHop = arrived && f < pl.fallAt - 3 ? Math.abs(Math.sin((f - pl.walkEnd) * 0.75)) * 0.16 : 0;
  const preHop = Math.sin(prog(f, pl.fallAt - 6, 6) * Math.PI) * 0.16;
  const legs = 1 - E.inOutCubic(prog(f, pl.fallAt + pl.fallDur * 0.25, pl.fallDur * 0.75));
  const squash = f >= pl.fallAt + pl.fallDur ? Math.sin(settle * Math.PI) * 0.45 * (1 - settle) : 0;
  return {
    position: pos,
    facing: Math.PI / 2, // facing +X — toward camera, so the happy face reads
    tex: pl.tex,
    faceRot: ((n * 3) % 4) * (Math.PI / 2),
    walk: f * 1.25 + n,
    stride: stride * 1.1,
    lean: stride * 0.14,
    lift: preHop + cheerHop - (TILE_T / 2) * fall,
    tilt: fall,
    legs: Math.max(0, legs),
    arms: 1 - E.inCubic(prog(f, pl.fallAt, pl.fallDur * 0.6)),
    face: 1 - E.inCubic(prog(f, pl.fallAt + pl.fallDur * 0.55, pl.fallDur * 0.5 + 4)),
    happy: f >= pl.hopAt ? 1 : 0,
    mouth: 1,
    eyes: blink(f, [pl.e + 30]),
    brow: -0.15,
    browLift: 0.04,
    // arms thrown up in a V the moment they are through the door; a third of them hold their luggage aloft
    cheer: f >= pl.hopAt ? 1 : 0.35,
    wave: f * 0.9 + n,
    carry: n % 3 === 1 ? "hand" : "none",
    luggage: n === 4 ? "#F2EDE4" : COLORS.orange,
    squash,
    done,
  };
};

/* ---------------- camera ---------------- */

type Key = { at: number; pos: V3; target: V3; fov: number };
const mix = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const WIDE: Key = { at: MACRO_FROM, pos: [12.5, 10.5, 12.5], target: [0, 0.2, 0], fov: 40 };
const KEYS: Key[] = [
  { at: RETURN_FROM, pos: [8.8, 4.2, 7.8], target: [-0.6, 0.45, 4.6], fov: 40 }, // bathroom
  { at: 138, pos: [8.5, 4.0, 6.9], target: [-0.6, 0.45, 4.4], fov: 40 },
  { at: 148, pos: [8.8, 4.0, 3.4], target: [-0.6, 0.45, 0.8], fov: 40 }, // whip → living room
  { at: 180, pos: [8.6, 3.9, 2.6], target: [-0.6, 0.45, 0.6], fov: 40 },
  { at: 190, pos: [6.4, 2.5, -3.0], target: [0.3, 0.5, -4.95], fov: 36 }, // whip → the kitchen
  { at: 214, pos: [5.7, 2.1, -3.5], target: [0.0, 0.4, -4.95], fov: 35 },
  { at: 238, pos: [1.55, 0.3, -5.55], target: [-0.45, 0.02, -4.95], fov: 32 }, // slow-motion push into the last slot
  { at: 260, pos: [1.25, 0.24, -5.42], target: [-0.45, 0.02, -4.95], fov: 30 },
  { at: 300, pos: [11.6, 8.3, 3.4], target: [0, 0.4, -2.5], fov: 40 }, // pull back
];

const cameraAt = (f: number): { pos: V3; target: V3; fov: number } => {
  if (f < MACRO_FROM) {
    const t = E.inOutCubic(f / MACRO_FROM);
    return { pos: mix(HANDOFF_CAM.pos, WIDE.pos, t), target: mix(HANDOFF_CAM.target, WIDE.target, t), fov: lerp(HANDOFF_CAM.fov, WIDE.fov, t) };
  }
  if (f < RETURN_FROM) {
    const shot = Math.min(2, Math.floor((f - MACRO_FROM) / MACRO_LEN));
    const m = MACROS[shot];
    const t = (f - MACRO_FROM - shot * MACRO_LEN) / MACRO_LEN;
    return { pos: mix(m.cam0, m.cam1, t), target: m.target, fov: m.fov };
  }
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (f >= a.at && f <= b.at) {
      const ease = b.at - a.at <= 12 ? E.inOutExpo : i === KEYS.length - 2 ? E.inOutCubic : E.inOutSine;
      const t = ease((f - a.at) / (b.at - a.at));
      return { pos: mix(a.pos, b.pos, t), target: mix(a.target, b.target, t), fov: lerp(a.fov, b.fov, t) };
    }
  }
  const last = KEYS[KEYS.length - 1];
  return { pos: last.pos, target: last.target, fov: last.fov };
};

export const Scene05Transformation: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const plans = useMemo(buildPlans, []);
  const merge = prog(f, 0, MACRO_FROM);
  const cam = cameraAt(f);
  const inMacro = f >= MACRO_FROM && f < RETURN_FROM;
  const shot = inMacro ? Math.min(2, Math.floor((f - MACRO_FROM) / MACRO_LEN)) : -1;
  const shotStart = MACRO_FROM + shot * MACRO_LEN;

  const ripple = (w: V3) => E.inOutCubic(prog(f, 12 + (w[0] + 2 + (w[2] + 7)) * 1.1, 12));
  const filled = (hi: number) => {
    const pl = plans[hi];
    return f >= pl.fallAt + pl.fallDur;
  };
  const returned = plans.filter((pl) => f >= pl.fallAt + pl.fallDur).length;

  // macro: dust puff + glint after the last tile clicks in
  const last = plans[plans.length - 1];
  const clickAt = last.fallAt + last.fallDur;
  const counter = f >= clickAt ? 25 : Math.min(24, Math.round(kf(f, [RETURN_FROM + 6, clickAt - 4], [0, 24], E.linear)));
  const lastHole = holeWorld(HOLES[HOLES.length - 1].kind, HOLES[HOLES.length - 1].ij);
  const dust = prog(f, clickAt, 18);
  const dustMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#F4EEE6", transparent: true, depthWrite: false }), []);
  dustMat.opacity = f >= clickAt ? 0.7 * (1 - dust) : 0;

  const warm = prog(f, 45, 195);
  const caliper = project(cam.pos, cam.target, cam.fov, [lastHole[0] - 0.5, 0.01, lastHole[2] - 0.5]);
  const caliper2 = project(cam.pos, cam.target, cam.fov, [lastHole[0] + 0.5, 0.01, lastHole[2] - 0.5]);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.ivory} 0%, #EFE3D4 55%, #EADFD1 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 40% at 80% 20%, rgba(255,190,140,0.35), rgba(0,0,0,0) 70%)", opacity: warm }} />
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95 }}>
        <fog attach="fog" args={["#EADFD1", 26, 60]} />
        <StudioEnv intensity={inMacro ? 0.6 : 0.45} />
        <ambientLight intensity={0.12} color="#FFF1E2" />
        <KeyLight position={inMacro ? [9, 4.5, 3] : [14, 10, 9]} target={[0, 0, 0]} intensity={lerp(1.7, 2.3, warm)} color={warm > 0.5 ? "#FFD9B5" : "#FFE9D4"} extent={inMacro ? 5 : 12} />
        <directionalLight position={[-9, 6, -4]} intensity={0.45} color="#C7D4E8" />
        <pointLight position={[lerp(lastHole[0] - 1.4, lastHole[0] + 1.6, E.inOutSine(prog(f, clickAt + 2, 24))), 0.3, lastHole[2] - 0.2]} intensity={f >= clickAt ? 2.4 : 0} distance={2.2} decay={2} />
        <Cam pos={cam.pos} target={cam.target} fov={cam.fov} />
        {inMacro ? (
          <MacroStage shot={shot} t={f - shotStart} />
        ) : (
          <>
            <Apartment3 merge={merge} ripple={ripple} filled={filled} sideRows={Math.floor(clamp((f - 8) / 3, 0, 9))} ground={E.outCubic(prog(f, 24, 16))} />
            {plans.map((pl, n) => {
              const p = charPose(pl, f, n);
              if (!p) return null;
              const { done, ...props } = p;
              if (done) return null;
              return <TileCharacter key={n} {...props} />;
            })}
          </>
        )}
        {f >= clickAt && f < clickAt + 18
          ? Array.from({ length: 10 }).map((_, k) => {
              const a = (k / 10) * Math.PI * 2;
              const r = 0.5 + dust * 0.45;
              return (
                <mesh
                  key={k}
                  material={dustMat}
                  position={[lastHole[0] + Math.cos(a) * r * 0.9, 0.03 + dust * 0.06 * (k % 3), lastHole[2] + Math.sin(a) * r * 0.9]}
                  scale={0.035 * (1 + dust)}
                >
                  <sphereGeometry args={[1, 8, 6]} />
                </mesh>
              );
            })
          : null}
      </ThreeCanvas>

      <ChapterTag n="05" title="The Transformation" start={4} dur={36} dark />

      {/* macro montage: one word per cut */}
      {inMacro ? (
        <>
          <SlamWord text={MACROS[shot].word} start={shotStart} dur={MACRO_LEN} size={170} top={214} left={64} color={shot === 1 ? COLORS.orange : COLORS.charcoal} exit={false} />
          <div style={{ position: "absolute", top: 404, left: 72, fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: "0.14em", color: COLORS.ivory, background: COLORS.charcoal, padding: "7px 14px" }}>
            {MACROS[shot].chip}
          </div>
          <div style={{ position: "absolute", top: 140, right: 72, fontFamily: MONO, fontSize: 22, letterSpacing: "0.14em", color: COLORS.charcoal, opacity: 0.7 }}>
            MACRO {shot + 1}/3
          </div>
        </>
      ) : null}

      {f >= RETURN_FROM + 4 && f < 206 ? (
        <div style={{ position: "absolute", top: 140, right: 72, fontFamily: MONO, color: COLORS.charcoal, textAlign: "right", letterSpacing: "0.12em", opacity: E.outCubic(prog(f, RETURN_FROM + 4, 8)) * (1 - prog(f, 198, 8)) }}>
          <div style={{ fontSize: 22, opacity: 0.7 }}>TILES RETURNED</div>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1, color: COLORS.orange }}>
            {String(counter).padStart(2, "0")}
            <span style={{ fontSize: 40, color: COLORS.charcoal, opacity: 0.5 }}>/25</span>
          </div>
          <div style={{ fontSize: 16, opacity: 0.5 }}>{returned} ON CAMERA</div>
        </div>
      ) : null}

      {/* macro precision callout */}
      {f >= clickAt + 4 && f < 262 ? (
        <>
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: E.outCubic(prog(f, clickAt + 4, 8)) }}>
            <line x1={caliper[0]} y1={caliper[1] - 60} x2={caliper2[0]} y2={caliper2[1] - 60} stroke={COLORS.charcoal} strokeWidth={3} />
            <line x1={caliper[0]} y1={caliper[1] - 80} x2={caliper[0]} y2={caliper[1] - 20} stroke={COLORS.charcoal} strokeWidth={3} />
            <line x1={caliper2[0]} y1={caliper2[1] - 80} x2={caliper2[0]} y2={caliper2[1] - 20} stroke={COLORS.charcoal} strokeWidth={3} />
          </svg>
          <div style={{ position: "absolute", left: 72, top: 300, fontFamily: MONO, color: COLORS.charcoal, opacity: E.outCubic(prog(f, clickAt + 6, 8)) }}>
            <div style={{ display: "inline-block", background: COLORS.charcoal, color: COLORS.ivory, padding: "8px 14px", fontSize: 20, letterSpacing: "0.16em" }}>MACRO · TERRAZZO</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 92, lineHeight: 1.05, marginTop: 16 }}>a perfect fit.</div>
            <div style={{ fontSize: 22, letterSpacing: "0.14em", marginTop: 8, opacity: 0.7 }}>GROUT 2.0 MM · LEVEL 0.0°</div>
          </div>
        </>
      ) : null}

      {/* the pull-back */}
      <SlamWord text="EVERYTHING" start={266} dur={40} size={140} top={226} left={64} color={COLORS.charcoal} exit={false} />
      <SlamWord text="in its" start={271} dur={40} size={110} top={360} left={70} color={COLORS.charcoal} font={SERIF} weight={400} italic letterSpacing="0" exit={false} />
      <SlamWord text="PLACE." start={275} dur={40} size={140} top={350} left={330} color={COLORS.orange} exit={false} />
      <Vignette strength={0.25} />
      <FilmGrain opacity={0.05} />
    </AbsoluteFill>
  );
};
