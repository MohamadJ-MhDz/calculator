import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ceramic, flat, glow, plane, roundedBox } from "./kit";
import { mulberry32 } from "./textures";
import { ART } from "../config/art";
import { clamp, E, lerp, V3 } from "../anim";

/**
 * THE BATHROOM — one room, two states, the same four walls.
 *
 * Scale: 1 unit = 25 cm. The room is 8 × 12 units = 2 m × 3 m = 6 m², 2.5 m high.
 * It never changes size. What changes between "before" and "after" is only what was
 * chosen for it:
 *
 *   before  loud patterned wall tiles + a second clashing wall, thick black grout that
 *           cuts the floor into a grid, and a vanity so wide the shower is 40 cm.
 *   after   one calm large-format wall tile, grout matched to the floor tile, a slim
 *           wall-hung vanity, and the pattern kept as a small framed accent.
 *
 * The white floor tiles are the same tiles in both states — nothing was wrong with them.
 */

export const ROOM = { w: 8, d: 12, h: 10, x0: -4, x1: 4, z0: -6, z1: 6 } as const;
export const TILE = 0.94; // visible tile size; the rest of each unit is grout
export const TILE_H = 0.07;
/** The main character's own place in the floor (column, row). */
export const SLOT = { i: 4, j: 9 } as const;
export const cellPos = (i: number, j: number): V3 => [i - 3.5, 0, j - 5.5];
export const SLOT_POS = cellPos(SLOT.i, SLOT.j);
/** Accent inlay on the back wall, inside the shower: 2 × 2 pattern tiles. */
export const NICHE: V3[] = [
  [2.1, 4.5, -5.9],
  [3.1, 4.5, -5.9],
  [2.1, 5.5, -5.9],
  [3.1, 5.5, -5.9],
];
/** Where the old vanity's face is (for cameras and anchored graphics). */
export const VANITY_FACE: V3 = [-0.8, 2.0, -3.6];

/* ------------------------------------------------------------------ */
/* Instancing: hundreds of tiles in one draw call each, posed per frame */
/* ------------------------------------------------------------------ */

type Inst = { p: V3; r?: V3; s?: number | V3 } | null;

const Instances: React.FC<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  count: number;
  at: (i: number) => Inst;
  castShadow?: boolean;
}> = ({ geometry, material, count, at, castShadow = false }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // No dependency list on purpose: every frame is a new pose.
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      const t = at(i);
      if (!t) {
        dummy.position.set(0, -500, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        dummy.position.set(t.p[0], t.p[1], t.p[2]);
        dummy.rotation.set(t.r ? t.r[0] : 0, t.r ? t.r[1] : 0, t.r ? t.r[2] : 0);
        if (typeof t.s === "number") dummy.scale.setScalar(t.s);
        else if (t.s) dummy.scale.set(t.s[0], t.s[1], t.s[2]);
        else dummy.scale.setScalar(1);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, count]} castShadow={castShadow} receiveShadow frustumCulled={false} />;
};

/* ------------------------------------------------------------------ */
/* Small props                                                          */
/* ------------------------------------------------------------------ */

export const Plant: React.FC<{ position: V3; scale?: number; pot?: string }> = ({ position, scale = 1, pot = "#E4DDD1" }) => {
  const leaves = useMemo(() => {
    const rng = mulberry32(77);
    return new Array(11).fill(0).map((_, i) => ({
      a: (i / 11) * Math.PI * 2 + rng() * 0.4,
      tilt: 0.35 + rng() * 0.5,
      len: 0.32 + rng() * 0.22,
      c: rng() > 0.5 ? "#3F6B4A" : "#507F59",
    }));
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh geometry={roundedBox(0.36, 0.38, 0.36, 0.06)} material={flat(pot, 0.7)} position={[0, 0.19, 0]} castShadow receiveShadow />
      {leaves.map((l, i) => (
        <group key={i} position={[0, 0.36, 0]} rotation={[0, l.a, l.tilt]}>
          <mesh position={[0, l.len / 2 + 0.05, 0]} scale={[0.07, l.len / 2, 0.025]} castShadow material={flat(l.c, 0.65)}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

let glassMat: THREE.MeshPhysicalMaterial | null = null;
const glass = () => {
  if (!glassMat) {
    glassMat = new THREE.MeshPhysicalMaterial({ color: "#D6ECEF", transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false });
  }
  return glassMat;
};
let mirrorMat: THREE.MeshStandardMaterial | null = null;
const mirror = () => {
  if (!mirrorMat) mirrorMat = new THREE.MeshStandardMaterial({ color: "#DDE6EA", roughness: 0.06, metalness: 1 });
  return mirrorMat;
};

/** The new round mirror: a bright, stylised reflection (soft gradient + two light streaks). */
let mirrorFaceMat: THREE.MeshBasicMaterial | null = null;
const mirrorFace = () => {
  if (mirrorFaceMat) return mirrorFaceMat;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, "#F4F1EC");
  grad.addColorStop(0.55, "#DCE1E2");
  grad.addColorStop(1, "#C3CBCE");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.55;
  g.fillStyle = "#FFFFFF";
  g.save();
  g.translate(128, 128);
  g.rotate(-Math.PI / 4);
  g.fillRect(-120, -70, 240, 26);
  g.fillRect(-120, -30, 240, 9);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  mirrorFaceMat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  return mirrorFaceMat;
};

/* ------------------------------------------------------------------ */
/* Suspect 3 — the oversized vanity (it has a face; its drawer talks)   */
/* ------------------------------------------------------------------ */

export type VanityFace = {
  /** 0..1 how awake it is (eyes pop in). */
  on: number;
  /** jaw opening from the lip-sync track. */
  open: number;
  /** 0..1 how far the big drawer is shoved out. */
  drawer: number;
  /** eyebrow tilt: >0 haughty/angry. */
  brow: number;
  look: [number, number];
  /** 0 closed .. 1 open. */
  eyes: number;
};

const OldVanity: React.FC<{ face: VanityFace; exit: number; f: number }> = ({ face, exit, f }) => {
  if (exit >= 1) return null;
  const cherry = flat(ART.before.vanity, 0.22, 0.05);
  const gold = flat(ART.before.vanityTrim, 0.3, 0.85);
  const ink = flat("#0E1014", 0.4);
  const white = flat("#FBFAF6", 0.25);
  const W = 6.4;
  const Hc = 3.4;
  const Dc = 2.4;
  // hoisted out on a rope: a jolt as the rope takes the weight, then up and out of frame,
  // swinging a little like anything heavy on a hook
  const z = -6 + Dc / 2;
  const jolt = exit > 0 ? Math.sin(clamp(exit / 0.12) * Math.PI) * 0.25 : 0;
  const up = E.inCubic(clamp((exit - 0.1) / 0.9)) * 18 + jolt;
  const rock = exit > 0 ? Math.sin(exit * 19) * 0.05 * (0.4 + exit) : 0;
  const talk = face.open * 0.34;
  const drawerZ = face.drawer * 1.7 + talk;
  const huff = face.on > 0.5 ? Math.sin(f * 0.21) * 0.012 : 0;
  return (
    <group position={[-0.8, up, z]} rotation={[0, 0, rock]} scale={[1, 1 + huff, 1]}>
      {exit > 0 ? (
        <>
          {/* rope and hook */}
          <mesh material={flat("#3A3530", 0.9)} position={[0, Hc + 0.6 + 15, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 30, 8]} />
          </mesh>
          <mesh material={flat("#9A9FA6", 0.3, 0.9)} position={[0, Hc + 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.05, 8, 20]} />
          </mesh>
        </>
      ) : null}
      {/* cabinet */}
      <mesh geometry={roundedBox(W, Hc - 0.3, Dc, 0.06)} material={cherry} position={[0, 0.3 + (Hc - 0.3) / 2, 0]} castShadow receiveShadow />
      <mesh geometry={roundedBox(W - 0.3, 0.3, Dc - 0.3, 0.02)} material={flat("#2A0E10", 0.6)} position={[0, 0.15, -0.05]} />
      {/* countertop + basin + ornate tap */}
      <mesh geometry={roundedBox(W + 0.2, 0.2, Dc + 0.2, 0.04)} material={ceramic("veinBrown")} position={[0, Hc + 0.1, 0.05]} castShadow receiveShadow />
      <mesh material={white} position={[1.4, Hc + 0.42, 0.1]} scale={[0.95, 0.3, 0.7]} castShadow>
        <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh geometry={roundedBox(0.14, 0.9, 0.14, 0.05)} material={gold} position={[1.4, Hc + 0.6, -0.75]} castShadow />
      <mesh geometry={roundedBox(0.12, 0.12, 0.6, 0.05)} material={gold} position={[1.4, Hc + 1.0, -0.5]} />
      {/* door panels with mouldings */}
      {[-2.15, 2.15].map((x) => (
        <group key={x} position={[x, 1.85, Dc / 2]}>
          <mesh geometry={roundedBox(1.7, 2.7, 0.06, 0.03)} material={cherry} position={[0, 0, 0.02]} />
          <mesh geometry={roundedBox(1.3, 2.2, 0.04, 0.02)} material={flat("#6E262B", 0.2)} position={[0, 0, 0.06]} />
          <mesh geometry={roundedBox(0.09, 0.5, 0.09, 0.03)} material={gold} position={[x > 0 ? -0.68 : 0.68, 0, 0.12]} />
        </group>
      ))}
      {/* the big centre drawer = its mouth */}
      <mesh geometry={roundedBox(2.5, 0.72, 0.1, 0.02)} material={ink} position={[0, 1.05, Dc / 2 - 0.03]} />
      <group position={[0, 1.05, Dc / 2 - 0.6 + drawerZ]}>
        <mesh geometry={roundedBox(2.42, 0.62, 1.3, 0.03)} material={flat("#3A1417", 0.5)} castShadow />
        <mesh geometry={roundedBox(2.66, 0.84, 0.1, 0.03)} material={cherry} position={[0, 0, 0.68]} castShadow />
        <mesh geometry={roundedBox(1.3, 0.1, 0.12, 0.04)} material={gold} position={[0, 0.05, 0.78]} />
      </group>
      {/* eyes on the upper rail */}
      {face.on > 0.02
        ? [-1, 1].map((side) => {
            const x = side * 0.95;
            const s = E.outBack(clamp(face.on), 2);
            return (
              <group key={side} position={[x, 2.45, Dc / 2 + 0.07]} scale={s}>
                <mesh material={ink} scale={[0.36, 0.38 * Math.max(0.08, face.eyes), 0.05]}>
                  <sphereGeometry args={[1, 24, 16]} />
                </mesh>
                <mesh material={white} position={[0, 0, 0.02]} scale={[0.31, 0.33 * Math.max(0.06, face.eyes), 0.07]}>
                  <sphereGeometry args={[1, 24, 16]} />
                </mesh>
                {face.eyes > 0.15 ? (
                  <mesh material={ink} position={[face.look[0] * 0.11, face.look[1] * 0.1 * face.eyes, 0.08]} scale={[0.15, 0.16 * face.eyes, 0.05]}>
                    <sphereGeometry args={[1, 18, 12]} />
                  </mesh>
                ) : null}
                <mesh geometry={roundedBox(0.62, 0.11, 0.08, 0.03)} material={gold} position={[0, 0.5, 0.05]} rotation={[0, 0, side * face.brow * 0.5]} />
              </group>
            );
          })
        : null}
      {/* the mirror cabinet: as overbearing as the rest */}
      <group position={[0, 6.6, -Dc / 2 + 0.36]}>
        <mesh geometry={roundedBox(W, 4.0, 0.6, 0.05)} material={cherry} castShadow />
        <mesh geometry={plane(W - 0.7, 3.3)} material={mirror()} position={[0, 0, 0.31]} />
        <mesh geometry={roundedBox(W + 0.3, 0.3, 0.8, 0.06)} material={gold} position={[0, 2.1, 0.05]} />
        {[-2.6, 2.6].map((x) => (
          <mesh key={x} material={flat("#FFF1C9", 0.4, 0, "#FFE9A8", 1.6)} position={[x, 1.2, 0.5]} scale={[0.22, 0.34, 0.22]}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------ */
/* The coordinated replacement: slim, wall-hung                         */
/* ------------------------------------------------------------------ */

const NewVanity: React.FC<{ arrive: number; fixtures: number; warm: number }> = ({ arrive, fixtures, warm }) => {
  if (arrive <= 0) return null;
  const drop = (1 - E.outBack(clamp(arrive), 1.3)) * 7;
  const metal = flat(ART.after.metal, 0.35, 0.7);
  const pop = E.outBack(clamp(fixtures), 1.8);
  return (
    <group position={[-1.8, drop, 0]}>
      <mesh geometry={roundedBox(3.6, 1.35, 1.8, 0.05)} material={ceramic("oak")} position={[0, 2.75, -5.1]} castShadow receiveShadow />
      <mesh geometry={roundedBox(3.5, 0.03, 0.04, 0.01)} material={flat("#7A5A3A", 0.6)} position={[0, 2.75, -4.19]} />
      <mesh geometry={roundedBox(3.72, 0.22, 1.9, 0.05)} material={flat(ART.after.basin, 0.18)} position={[0, 3.53, -5.05]} castShadow receiveShadow />
      <mesh material={flat("#DAD6CE", 0.3)} position={[0, 3.645, -4.95]} scale={[1.05, 0.02, 0.5]}>
        <sphereGeometry args={[1, 28, 12]} />
      </mesh>
      <mesh geometry={roundedBox(0.1, 0.75, 0.1, 0.04)} material={metal} position={[0, 4.0, -5.7]} castShadow />
      <mesh geometry={roundedBox(0.09, 0.09, 0.6, 0.04)} material={metal} position={[0, 4.34, -5.45]} />
      {pop > 0.01 ? (
        <>
          {/* round mirror with a warm halo behind it */}
          <group position={[0, 6.2, -5.9]} scale={pop}>
            <mesh material={flat("#FFE2B8", 0.5, 0, ART.after.warmLight, 0.6 + 1.6 * warm)} position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1.52, 1.52, 0.03, 48]} />
            </mesh>
            <mesh material={mirrorFace()} position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1.4, 1.4, 0.05, 48]} />
            </mesh>
          </group>
          <Plant position={[1.35, 3.64, -5.1]} scale={0.9 * pop} pot={ART.after.metal} />
        </>
      ) : null}
    </group>
  );
};

/* ------------------------------------------------------------------ */
/* The room                                                             */
/* ------------------------------------------------------------------ */

export type BathroomProps = {
  /** Film frame, for small idle motion. */
  f: number;
  /** Floor grout re-coloured from the back wall to the front: 0 black .. 1 matched. */
  grout?: number;
  /** Wall re-tiling wave: 0 loud .. 1 calm. */
  walls?: number;
  /** Old vanity leaving: 0 in place .. 1 gone. */
  oldVanity?: number;
  /** New vanity arriving: 0 absent .. 1 installed. */
  newVanity?: number;
  /** Mirror, plant and towels pop in: 0..1. */
  fixtures?: number;
  /** Shower glass sliding to give the shower its width back: 0..1. */
  glass?: number;
  /** Light: 0 cold ceiling light .. 1 warm. */
  warm?: number;
  /** How many of the four accent tiles sit in the inlay (0..4); the trim appears from 1. */
  niche?: number;
  /** The main character has left its place in the floor. */
  slotEmpty?: boolean;
  /** A wall tile has jumped off the left wall (column j, row k), leaving bare plaster. */
  wallHole?: [number, number] | null;
  /** "A thousand pieces": frames since the floor started twitching piece by piece, or -1. */
  floorTwitch?: number;
  twitchCentre?: [number, number];
  vanityFace?: VanityFace;
};

const NO_FACE: VanityFace = { on: 0, open: 0, drawer: 0, brow: 0, look: [0, 0], eyes: 1 };

export const Bathroom: React.FC<BathroomProps> = ({
  f,
  grout = 0,
  walls = 0,
  oldVanity = 0,
  newVanity = 0,
  fixtures = 0,
  glass: glassT = 0,
  warm = 0,
  niche = 0,
  slotEmpty = false,
  wallHole = null,
  floorTwitch = -1,
  twitchCentre = [3.5, 5.5],
  vanityFace = NO_FACE,
}) => {
  const { w, d, h, x0, x1, z0 } = ROOM;
  const floorGeo = roundedBox(TILE, TILE_H, TILE, 0.018, 2);
  const smallGeo = roundedBox(TILE, TILE, 0.05, 0.014, 2);
  const bigGeo = roundedBox(3.96, 1.96, 0.05, 0.02, 2);
  const plaster = flat("#CFC8BC", 0.95);

  /* ---- floor: the same 96 white tiles before and after ---- */
  const sweepZ = z0 + d * grout;
  const floorAt = (n: number): Inst => {
    const i = n % 8;
    const j = Math.floor(n / 8);
    if (slotEmpty && i === SLOT.i && j === SLOT.j) return null;
    const [x, , z] = cellPos(i, j);
    let lift = 0;
    if (floorTwitch >= 0) {
      const dist = Math.hypot(i - twitchCentre[0], j - twitchCentre[1]);
      lift += Math.sin(clamp((floorTwitch - dist * 1.7) / 7) * Math.PI) * 0.09;
    }
    if (grout > 0 && grout < 1) {
      // each tile gets a little press as the float passes over it
      lift -= Math.sin(clamp(1 - Math.abs(z - sweepZ) / 0.9) * Math.PI * 0.5) * 0.025;
    }
    return { p: [x, -TILE_H / 2 + lift, z] };
  };

  /* ---- walls: a wave that starts at the floor in the back-left corner ---- */
  const wave = (u: number, v: number) => 0.6 * v + 0.4 * u;
  const oldTile = (u: number, v: number, p: V3, r: V3, n: V3): Inst => {
    const t = clamp((walls * 1.55 - wave(u, v)) / 0.3);
    if (t >= 1) return null;
    const push = Math.sin(t * Math.PI) * 0.3;
    return { p: [p[0] + n[0] * push, p[1] + n[1] * push, p[2] + n[2] * push], r: [r[0], r[1] + t * 1.3, r[2]], s: 1 - E.inCubic(t) };
  };
  const newTile = (u: number, v: number, p: V3, r: V3, n: V3): Inst => {
    const t = clamp((walls * 1.55 - wave(u, v) - 0.16) / 0.26);
    if (t <= 0) return null;
    const off = (1 - E.outBack(t, 1.5)) * 1.3;
    return { p: [p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off], r, s: lerp(0.72, 1, E.outCubic(t)) };
  };
  const backOld = (n: number): Inst => {
    const i = n % 8;
    const k = Math.floor(n / 8);
    return oldTile(i / 8, k / 10, [i - 3.5, k + 0.5, z0 + 0.03], [0, 0, 0], [0, 0, 1]);
  };
  const leftOld = (n: number): Inst => {
    const j = n % 12;
    const k = Math.floor(n / 12);
    if (wallHole && wallHole[0] === j && wallHole[1] === k) return null;
    return oldTile(j / 12, k / 10, [x0 + 0.03, k + 0.5, j - 5.5], [0, Math.PI / 2, 0], [1, 0, 0]);
  };
  const rightOld = (n: number): Inst => {
    const j = n % 12;
    const k = Math.floor(n / 12);
    return oldTile(0.3 + j / 12, k / 10, [x1 - 0.03, k + 0.5, j - 5.5], [0, -Math.PI / 2, 0], [-1, 0, 0]);
  };
  const backNew = (n: number): Inst => {
    const c = n % 2;
    const r = Math.floor(n / 2);
    return newTile(c / 2, r / 5, [-2 + 4 * c, 1 + 2 * r, z0 + 0.045], [0, 0, 0], [0, 0, 1]);
  };
  const leftNew = (n: number): Inst => {
    const c = n % 3;
    const r = Math.floor(n / 3);
    return newTile(c / 3, r / 5, [x0 + 0.045, 1 + 2 * r, -4 + 4 * c], [0, Math.PI / 2, 0], [1, 0, 0]);
  };
  const rightNew = (n: number): Inst => {
    const c = n % 3;
    const r = Math.floor(n / 3);
    return newTile(0.3 + c / 3, r / 5, [x1 - 0.045, 1 + 2 * r, -4 + 4 * c], [0, -Math.PI / 2, 0], [-1, 0, 0]);
  };

  const glassX = lerp(2.4, 0.8, E.inOutCubic(glassT));
  const towel = warm > 0.5 ? ART.after.towel : ART.before.towel;
  const fix = E.outBack(clamp(fixtures), 1.6);
  const metal = flat("#B9BEC4", 0.25, 0.9);

  return (
    <group>
      {/* screed under everything, then the grout: old colour, new colour growing over it */}
      <mesh geometry={plane(w + 0.4, d + 0.4)} material={flat("#3B3F45", 0.95)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -TILE_H - 0.01, 0]} receiveShadow />
      <mesh geometry={plane(w, d)} material={flat(ART.before.grout, 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.022, 0]} receiveShadow />
      {grout > 0.001 ? (
        <mesh geometry={plane(w, 1)} material={flat(ART.after.grout, 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, z0 + (d * grout) / 2]} scale={[1, d * grout, 1]} receiveShadow />
      ) : null}
      {grout > 0.001 && grout < 0.999 ? (
        <group position={[0, 0.06, sweepZ]}>
          {/* the grout float */}
          <mesh geometry={roundedBox(w - 0.2, 0.12, 0.42, 0.04)} material={flat("#E8E2D6", 0.6)} castShadow />
          <mesh geometry={roundedBox(w - 0.2, 0.05, 0.46, 0.02)} material={flat("#2A2E34", 0.8)} position={[0, -0.07, 0]} />
          <mesh geometry={roundedBox(1.2, 0.16, 0.16, 0.06)} material={flat("#2A2E34", 0.5)} position={[0, 0.2, 0]} />
        </group>
      ) : null}
      <Instances geometry={floorGeo} material={ceramic("gloss")} count={96} at={floorAt} castShadow />
      {slotEmpty ? <mesh geometry={plane(0.98, 0.98)} material={flat("#22252A", 0.95)} rotation={[-Math.PI / 2, 0, 0]} position={[SLOT_POS[0], -0.021, SLOT_POS[2]]} /> : null}

      {/* the three walls */}
      {wallHole ? (
        <group position={[x0 + 0.006, wallHole[1] + 0.5, wallHole[0] - 5.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh geometry={plane(0.97, 0.97)} material={flat("#3E3B36", 0.95)} />
          <mesh geometry={plane(0.8, 0.8)} material={flat("#5C5750", 0.9)} position={[0, 0, 0.002]} />
          {[-0.24, 0, 0.24].map((y) => (
            <mesh key={y} geometry={plane(0.7, 0.05)} material={flat("#6E685F", 0.9)} position={[0, y, 0.004]} />
          ))}
        </group>
      ) : null}
      <mesh geometry={roundedBox(w + 0.4, h, 0.2, 0.01)} material={plaster} position={[0, h / 2, z0 - 0.1]} receiveShadow />
      <mesh geometry={roundedBox(0.2, h, d, 0.01)} material={plaster} position={[x0 - 0.1, h / 2, 0]} receiveShadow />
      <mesh geometry={roundedBox(0.2, h, d, 0.01)} material={plaster} position={[x1 + 0.1, h / 2, 0]} receiveShadow />
      {walls < 0.999 ? (
        <>
          <Instances geometry={smallGeo} material={ceramic("busy")} count={80} at={backOld} />
          <Instances geometry={smallGeo} material={ceramic("busy")} count={120} at={leftOld} />
          <Instances geometry={smallGeo} material={ceramic("veinBrown")} count={120} at={rightOld} />
        </>
      ) : null}
      {walls > 0.001 ? (
        <>
          <Instances geometry={bigGeo} material={ceramic("calm")} count={10} at={backNew} />
          <Instances geometry={bigGeo} material={ceramic("calm")} count={15} at={leftNew} />
          <Instances geometry={bigGeo} material={ceramic("calm")} count={15} at={rightNew} />
        </>
      ) : null}

      {/* accent inlay: the pattern, kept — in a small frame, where it can be seen properly */}
      {niche > 0 ? (
        <group>
          {[
            [2.6, 6.06, 2.16, 0.07],
            [2.6, 3.94, 2.16, 0.07],
            [1.56, 5.0, 0.07, 2.16],
            [3.64, 5.0, 0.07, 2.16],
          ].map(([x, y, sx, sy], k) => (
            <mesh key={k} geometry={roundedBox(sx, sy, 0.09, 0.01)} material={flat(ART.after.metal, 0.35, 0.7)} position={[x, y, z0 + 0.1]} />
          ))}
          {NICHE.slice(0, Math.floor(niche)).map((p, k) => (
            <mesh key={k} geometry={smallGeo} material={ceramic("busy")} position={[p[0], p[1], z0 + 0.09]} />
          ))}
        </group>
      ) : null}

      {/* shower: glass screen, rain head, mixer, drain */}
      <group position={[glassX, 0, 0]}>
        <mesh geometry={roundedBox(0.06, 7.6, 3.4, 0.01)} material={glass()} position={[0, 3.85, -4.3]} />
        <mesh geometry={roundedBox(0.1, 0.1, 3.5, 0.02)} material={metal} position={[0, 7.7, -4.3]} />
        <mesh geometry={roundedBox(0.1, 0.06, 3.5, 0.02)} material={metal} position={[0, 0.04, -4.3]} />
      </group>
      <mesh geometry={roundedBox(1.1, 0.09, 0.09, 0.03)} material={metal} position={[3.42, 8.3, -4.6]} />
      <mesh material={metal} position={[2.9, 8.2, -4.6]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 32]} />
      </mesh>
      <mesh material={metal} position={[3.9, 4.6, -4.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.14, 24]} />
      </mesh>
      <mesh geometry={plane(0.5, 0.5)} material={flat("#55595F", 0.5, 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[3.2, 0.004, -4.7]} />

      {/* towels on the left wall */}
      <mesh geometry={roundedBox(0.08, 0.08, 2.4, 0.03)} material={metal} position={[x0 + 0.25, 5.2, 1.2]} />
      <mesh geometry={roundedBox(0.1, 1.9, 1.0, 0.04)} material={flat(towel, 0.95)} position={[x0 + 0.26, 4.3, 0.7]} castShadow />
      <mesh geometry={roundedBox(0.1, 1.5, 0.9, 0.04)} material={flat(warm > 0.5 ? "#E9E3D8" : "#F2C230", 0.95)} position={[x0 + 0.27, 4.5, 1.75]} castShadow />

      <OldVanity face={vanityFace} exit={oldVanity} f={f} />
      <NewVanity arrive={newVanity} fixtures={fixtures} warm={warm} />
      {fix > 0.01 ? <Plant position={[3.3, 0, 4.6]} scale={1.5 * fix} pot="#E9E3D8" /> : null}
      {/* thin floor-level light line under the new vanity: only reads when the room is warm */}
      {newVanity >= 1 && warm > 0.05 ? (
        <mesh geometry={plane(3.4, 0.05)} material={glow(ART.after.warmLight, 0.9 * warm)} position={[-1.8, 2.05, -4.25]} />
      ) : null}
    </group>
  );
};

/** Lighting for the room: 0 = the cold overhead light it started with, 1 = warm. */
export const BathLights: React.FC<{ warm: number; boost?: number }> = ({ warm, boost = 1 }) => {
  const key = useMemo(() => new THREE.DirectionalLight(), []);
  useLayoutEffect(() => {
    key.position.set(lerp(3, 7, warm), 16, 13);
    key.target.position.set(0, 1.5, -1);
    key.target.updateMatrixWorld();
    key.color.set(warm > 0.5 ? "#FFE3BF" : "#E4EEFF");
    key.intensity = lerp(1.25, 2.1, warm) * boost;
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 5;
    const c = key.shadow.camera;
    c.left = -9;
    c.right = 9;
    c.top = 11;
    c.bottom = -9;
    c.near = 1;
    c.far = 60;
    c.updateProjectionMatrix();
  });
  return (
    <>
      <hemisphereLight args={[warm > 0.5 ? "#FFF3E2" : "#DDE8FA", "#3A3D42", lerp(0.75, 0.6, warm) * boost]} />
      <primitive object={key} />
      <primitive object={key.target} />
      {/* the old ceiling light: flat, cold, straight down */}
      <pointLight position={[0, 9.6, 0]} color={ART.before.ceilingLight} intensity={38 * (1 - warm) * boost} distance={22} decay={1.6} />
      {/* after: light from the mirror halo and a soft bounce off the calm wall */}
      <pointLight position={[-1.8, 6.2, -4.6]} color={ART.after.warmLight} intensity={26 * warm * boost} distance={12} decay={1.8} />
      <pointLight position={[2.6, 6.5, -3.2]} color="#FFEBD0" intensity={10 * warm * boost} distance={10} decay={2} />
    </>
  );
};
