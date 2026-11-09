import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { blink, clamp, E, kf, lerp, prog, V3 } from "../anim";
import { Cam, KeyLight, plane, StudioEnv, DPR } from "../three/kit";
import { RoomModel } from "../three/RoomModel";
import { TileCharacter, TileCharProps, TILE_T } from "../three/TileCharacter";
import { project } from "../three/project";
import { ChapterTag, FilmGrain, SlamWord, Vignette } from "../ui/Overlays";
import { MONO, SERIF } from "../fonts";
import { DOOR, DOOR_Z, HANDOFF_CAM, HERO_HOLE, HOLES, holeWorld, JOINED, PLAN, ROOM_SLOTS, STUDIO_FLOOR_Y } from "./sceneShared";

/**
 * SCENE 05 — THE TRANSFORMATION (24–34 s)
 * The rooms re-join into one apartment (the reverse of the split), a tile-
 * placement ripple runs through every floor, and the tiles come home — each
 * hopping back into its own slot. Slow-motion macro on the final click.
 */

const KINDS = ["kitchen", "living", "bathroom"] as const;

/* ---------------- the re-assembled apartment (shared with Scene 06) ---------------- */

export const Apartment3: React.FC<{
  merge?: number;
  ripple?: (world: V3) => number;
  filled: (holeIndex: number) => boolean;
  heroFilled?: boolean;
  sideRows?: number;
  ground?: number;
}> = ({ merge = 1, ripple, filled, heroFilled = false, sideRows = 99, ground = 1 }) => {
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
              const isHero = kind === HERO_HOLE.kind && HERO_HOLE.ij[0] === i && HERO_HOLE.ij[1] === j;
              if ((hi >= 0 && !filled(hi)) || (isHero && !heroFilled)) return { a: plan.floor, hidden: true };
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

const V = 0.075;
const OUT_X = -2.62; // behind the side wall, on the studio floor
const IN_X = -1.72; // just inside the door
const ENTER = [46, 60, 74, 92, 106, 120, 128, 140, 150];

export const buildPlans = (): Plan[] =>
  HOLES.map((h, n) => {
    const c = holeWorld(h.kind, h.ij);
    const last = n === HOLES.length - 1;
    const e = ENTER[n];
    const startX = OUT_X - 1.9;
    const hopAt = e + (OUT_X - startX) / V;
    const edgeX = c[0] + 0.5;
    const walkEnd = hopAt + 10 + (edgeX - IN_X) / V;
    const fallAt = last ? Math.max(walkEnd + 8, 212) : walkEnd + 12;
    return { e, z: c[2], startX, edgeX, hopAt, walkEnd, fallAt, fallDur: last ? 26 : 12, tex: PLAN[h.kind].floor };
  });

const charPose = (pl: Plan, f: number, n: number): (TileCharProps & { done: boolean }) | null => {
  if (f < pl.e) return null;
  const done = f >= pl.fallAt + pl.fallDur + 4;
  let pos: V3;
  let stride = 0;
  if (f < pl.hopAt) {
    pos = [pl.startX + (f - pl.e) * V, STUDIO_FLOOR_Y, pl.z];
    stride = 1;
  } else if (f < pl.hopAt + 10) {
    const t = prog(f, pl.hopAt, 10);
    pos = [lerp(OUT_X, IN_X, t), lerp(STUDIO_FLOOR_Y, 0, E.outCubic(t)) + Math.sin(t * Math.PI) * 0.32, pl.z];
  } else if (f < pl.walkEnd) {
    pos = [IN_X + (f - pl.hopAt - 10) * V, 0, pl.z];
    stride = 1;
  } else {
    pos = [pl.edgeX, 0, pl.z];
  }
  const fall = E.inCubic(prog(f, pl.fallAt, pl.fallDur));
  const settle = prog(f, pl.fallAt + pl.fallDur, 8);
  const wiggle = f >= pl.walkEnd && f < pl.fallAt ? Math.sin((f - pl.walkEnd) * 0.9) * 0.06 : 0;
  const preHop = Math.sin(prog(f, pl.fallAt - 7, 7) * Math.PI) * 0.16;
  const legs = 1 - E.inOutCubic(prog(f, pl.fallAt + pl.fallDur * 0.25, pl.fallDur * 0.75));
  const squash = f >= pl.fallAt + pl.fallDur ? Math.sin(settle * Math.PI) * 0.45 * (1 - settle) : 0;
  const arrived = f >= pl.walkEnd;
  return {
    position: pos,
    facing: Math.PI / 2, // facing +X — toward camera, so the happy face reads
    tex: pl.tex,
    faceRot: ((n * 3) % 4) * (Math.PI / 2),
    walk: f * 0.95 + n,
    stride: stride * 0.95,
    lift: preHop - (TILE_T / 2) * fall,
    sway: wiggle,
    tilt: fall,
    legs: Math.max(0, legs),
    arms: 1 - E.inCubic(prog(f, pl.fallAt, pl.fallDur * 0.6)),
    face: 1 - E.inCubic(prog(f, pl.fallAt + pl.fallDur * 0.55, pl.fallDur * 0.5 + 4)),
    happy: arrived ? 1 : 0,
    mouth: 1,
    eyes: blink(f, [pl.e + 30]),
    brow: -0.15,
    browLift: 0.04,
    armRaise: arrived && f < pl.fallAt ? 0.85 : 0,
    wave: f * 0.7,
    squash,
    done,
  };
};

export const Scene05Transformation: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const plans = useMemo(buildPlans, []);
  const merge = prog(f, 0, 46);

  // camera
  const keys: { at: number; pos: V3; target: V3; fov: number }[] = [
    { at: 0, ...HANDOFF_CAM },
    { at: 46, pos: [12.5, 10.5, 12.5], target: [0, 0.2, 0], fov: 40 },
    { at: 68, pos: [8.8, 4.2, 7.8], target: [-0.6, 0.45, 4.6], fov: 40 },
    { at: 112, pos: [8.8, 4.0, 3.4], target: [-0.6, 0.45, 0.8], fov: 40 },
    { at: 156, pos: [8.6, 3.9, -2.0], target: [-0.6, 0.45, -4.4], fov: 40 },
    { at: 196, pos: [3.6, 1.15, -5.5], target: [-0.1, 0.6, -4.95], fov: 34 },
    { at: 212, pos: [3.2, 0.95, -5.45], target: [-0.15, 0.55, -4.95], fov: 34 },
    { at: 238, pos: [1.55, 0.3, -5.55], target: [-0.45, 0.02, -4.95], fov: 32 },
    { at: 260, pos: [1.25, 0.24, -5.42], target: [-0.45, 0.02, -4.95], fov: 30 },
    { at: 300, pos: [12.8, 9.8, 11.6], target: [0, 0.3, 0], fov: 40 },
  ];
  let cam = { pos: keys[0].pos, target: keys[0].target, fov: keys[0].fov };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f >= a.at && f <= b.at) {
      const ease = b.at - a.at <= 12 ? E.inOutExpo : i === keys.length - 2 ? E.inOutCubic : E.inOutSine;
      const t = ease((f - a.at) / (b.at - a.at));
      cam = {
        pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
        target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)],
        fov: lerp(a.fov, b.fov, t),
      };
    }
  }

  const ripple = (w: V3) => E.inOutCubic(prog(f, 44 + (w[0] + 2 + (w[2] + 7)) * 1.5, 14));
  const filled = (hi: number) => {
    const pl = plans[hi];
    return f >= pl.fallAt + pl.fallDur;
  };
  const returned = plans.filter((pl) => f >= pl.fallAt + pl.fallDur).length;
  const counter = Math.min(24, Math.round(kf(f, [60, 236], [0, 24], E.linear)));

  // macro: dust puff + glint after the last tile clicks in
  const last = plans[plans.length - 1];
  const clickAt = last.fallAt + last.fallDur;
  const lastHole = holeWorld(HOLES[HOLES.length - 1].kind, HOLES[HOLES.length - 1].ij);
  const dust = prog(f, clickAt, 18);
  const dustMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#F4EEE6", transparent: true, depthWrite: false }), []);
  dustMat.opacity = f >= clickAt ? 0.7 * (1 - dust) : 0;

  const warm = prog(f, 40, 200);
  const caliper = project(cam.pos, cam.target, cam.fov, [lastHole[0] - 0.5, 0.01, lastHole[2] - 0.5]);
  const caliper2 = project(cam.pos, cam.target, cam.fov, [lastHole[0] + 0.5, 0.01, lastHole[2] - 0.5]);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.ivory} 0%, #EFE3D4 55%, #EADFD1 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 40% at 80% 20%, rgba(255,190,140,0.35), rgba(0,0,0,0) 70%)", opacity: warm }} />
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95 }}>
        <fog attach="fog" args={["#EADFD1", 26, 60]} />
        <StudioEnv intensity={0.45} />
        <ambientLight intensity={0.12} color="#FFF1E2" />
        <KeyLight position={[14, 10, 9]} target={[0, 0, 0]} intensity={lerp(1.7, 2.3, warm)} color={warm > 0.5 ? "#FFD9B5" : "#FFE9D4"} extent={12} />
        <directionalLight position={[-9, 6, -4]} intensity={0.45} color="#C7D4E8" />
        <pointLight position={[lerp(lastHole[0] - 1.4, lastHole[0] + 1.6, E.inOutSine(prog(f, clickAt + 2, 24))), 0.3, lastHole[2] - 0.2]} intensity={f >= clickAt ? 2.4 : 0} distance={2.2} decay={2} />
        <Cam pos={cam.pos} target={cam.target} fov={cam.fov} />
        <Apartment3 merge={merge} ripple={ripple} filled={filled} sideRows={Math.floor(clamp((f - 60) / 3, 0, 9))} ground={E.outCubic(prog(f, 30, 24))} />
        {plans.map((pl, n) => {
          const p = charPose(pl, f, n);
          if (!p) return null;
          const { done, ...props } = p;
          if (done) return null;
          return <TileCharacter key={n} {...props} />;
        })}
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

      <ChapterTag n="05" title="The Transformation" start={4} dur={56} dark />
      <SlamWord text="EVERYTHING" start={30} dur={86} size={140} top={226} left={64} color={COLORS.charcoal} />
      <SlamWord text="in its" start={38} dur={78} size={110} top={360} left={70} color={COLORS.charcoal} font={SERIF} weight={400} italic letterSpacing="0" />
      <SlamWord text="PLACE." start={44} dur={72} size={140} top={350} left={330} color={COLORS.orange} />

      {f >= 120 && f < 200 ? (
        <div style={{ position: "absolute", top: 140, right: 72, fontFamily: MONO, color: COLORS.charcoal, textAlign: "right", letterSpacing: "0.12em", opacity: E.outCubic(prog(f, 120, 8)) * (1 - prog(f, 192, 8)) }}>
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
      <Vignette strength={0.25} />
      <FilmGrain opacity={0.05} />
    </AbsoluteFill>
  );
};
