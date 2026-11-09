import React, { useMemo } from "react";
import * as THREE from "three";
import { ceramic, flat, plane, roundedBox } from "./kit";
import { mulberry32, TexKey } from "./textures";
import { TILE_T } from "./TileCharacter";
import type { V3 } from "../anim";

/* ------------------------------------------------------------------ */
/* Floor layout — 5 × 6 tiles. Every tile is a potential character.    */
/* ------------------------------------------------------------------ */

export type Mood = "angry" | "tired" | "huffy";
export type FloorTile = {
  id: number;
  x: number;
  zc: number;
  tex: TexKey;
  faceRot: number;
  stuck: boolean;
  hero: boolean;
  carry: "none" | "hand" | "trolley" | "box";
  luggage: string;
  mood: Mood;
  scale: number;
  rank: number;
  s0: number;
};

export const ROOM = { x0: -2.5, x1: 2.5, z0: -3, z1: 3, wallH: 2.8, doorW: 1.5, doorH: 2.4 };
export const HERO_SPOT = { x: 0, zc: -2.5 };

const PREMIUM: TexKey[] = ["marble", "travertine", "terrazzo", "stone", "porcelain", "neutral"];
const LUGGAGE = ["#FF703D", "#F2EDE4", "#8E98A3", "#273140", "#B8AE9F", "#E2582A"];

const isStuck = (x: number, zc: number) =>
  (zc === -2.5 && (x === 1 || x === 2)) || // under the console
  (x === -2 && (zc === 1.5 || zc === 2.5)) || // under the sofa
  (x === 2 && zc === 2.5); // under the plant

export const buildFloor = (): FloorTile[] => {
  const rng = mulberry32(2026);
  const tiles: FloorTile[] = [];
  let id = 0;
  for (let zc = -2.5; zc <= 2.5; zc += 1) {
    for (let x = -2; x <= 2; x++) {
      const hero = x === HERO_SPOT.x && zc === HERO_SPOT.zc;
      const r = rng();
      const carryRoll = rng();
      tiles.push({
        id: id++,
        x,
        zc,
        tex: hero ? "hero" : PREMIUM[Math.floor(r * PREMIUM.length)],
        faceRot: Math.floor(rng() * 4) * (Math.PI / 2),
        stuck: isStuck(x, zc),
        hero,
        carry: hero ? "hand" : carryRoll < 0.42 ? "hand" : carryRoll < 0.72 ? "trolley" : carryRoll < 0.86 ? "box" : "none",
        luggage: LUGGAGE[Math.floor(rng() * LUGGAGE.length)],
        mood: (["angry", "tired", "huffy"] as Mood[])[Math.floor(rng() * 3)],
        scale: hero ? 1 : 0.86 + rng() * 0.14,
        rank: -1,
        s0: -(zc + 0.5),
      });
    }
  }
  // queue order: closest to the door first, inner columns first
  const leaving = tiles.filter((t) => !t.stuck).sort((a, b) => b.s0 - a.s0 || Math.abs(a.x) - Math.abs(b.x) || a.x - b.x);
  leaving.forEach((t, i) => (t.rank = i));
  // the very last one is the small hesitant one carrying a box
  const last = leaving[leaving.length - 1];
  last.carry = "box";
  last.scale = 0.78;
  last.tex = "terrazzo";
  return tiles;
};

/* ------------------------------------------------------------------ */
/* Seven-segment clock texture (no font dependency)                    */
/* ------------------------------------------------------------------ */

const SEG: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};
const clockCache = new Map<string, THREE.CanvasTexture>();
export const clockTexture = (text: string, colon: boolean) => {
  const id = `${text}:${colon}`;
  const hit = clockCache.get(id);
  if (hit) return hit;
  const W = 512;
  const H = 200;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0A0D11";
  ctx.fillRect(0, 0, W, H);
  const digits = text.replace(":", "");
  const dw = 86;
  const dh = 140;
  const th = 16;
  const xs = [48, 148, 286, 386];
  const drawSeg = (x: number, y: number, seg: string, on: boolean) => {
    ctx.fillStyle = on ? "#FF703D" : "rgba(255,112,61,0.07)";
    ctx.shadowColor = on ? "rgba(255,112,61,0.9)" : "transparent";
    ctx.shadowBlur = on ? 14 : 0;
    const h2 = dh / 2;
    const r = (rx: number, ry: number, rw: number, rh: number) => {
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, th / 2);
      ctx.fill();
    };
    if (seg === "a") r(x + th * 0.6, y, dw - th * 1.2, th);
    if (seg === "b") r(x + dw - th, y + th * 0.6, th, h2 - th * 0.9);
    if (seg === "c") r(x + dw - th, y + h2 + th * 0.3, th, h2 - th * 0.9);
    if (seg === "d") r(x + th * 0.6, y + dh - th, dw - th * 1.2, th);
    if (seg === "e") r(x, y + h2 + th * 0.3, th, h2 - th * 0.9);
    if (seg === "f") r(x, y + th * 0.6, th, h2 - th * 0.9);
    if (seg === "g") r(x + th * 0.6, y + h2 - th / 2, dw - th * 1.2, th);
  };
  for (let i = 0; i < 4; i++) {
    const on = SEG[digits[i]] ?? "";
    for (const s of "abcdefg") drawSeg(xs[i], 30, s, on.includes(s));
  }
  ctx.fillStyle = colon ? "#FF703D" : "rgba(255,112,61,0.08)";
  ctx.shadowBlur = colon ? 14 : 0;
  ctx.beginPath();
  ctx.arc(256, 75, 9, 0, Math.PI * 2);
  ctx.arc(256, 125, 9, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  clockCache.set(id, tex);
  return tex;
};

export const DigitalClock: React.FC<{ text: string; colon: boolean; position: V3; rotation?: V3; scale?: number }> = ({
  text,
  colon,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  mat.map = clockTexture(text, colon);
  mat.needsUpdate = true;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={roundedBox(0.56, 0.24, 0.14, 0.03)} material={flat("#151A21", 0.35)} castShadow />
      <mesh geometry={plane(0.48, 0.19)} material={mat} position={[0, 0, 0.0705]} />
    </group>
  );
};

/* ------------------------------------------------------------------ */
/* Furniture                                                            */
/* ------------------------------------------------------------------ */

export const Sofa: React.FC<{ position: V3; rotation?: V3; color?: string; pillow?: string }> = ({
  position,
  rotation = [0, 0, 0],
  color = "#2B3442",
  pillow = "#FF703D",
}) => {
  const m = flat(color, 0.95);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={roundedBox(2.0, 0.26, 0.8, 0.06)} material={m} position={[0, 0.25, 0]} castShadow receiveShadow />
      <mesh geometry={roundedBox(2.0, 0.5, 0.2, 0.08)} material={m} position={[0, 0.55, -0.3]} castShadow />
      <mesh geometry={roundedBox(0.18, 0.4, 0.8, 0.07)} material={m} position={[-0.95, 0.4, 0]} castShadow />
      <mesh geometry={roundedBox(0.18, 0.4, 0.8, 0.07)} material={m} position={[0.95, 0.4, 0]} castShadow />
      <mesh geometry={roundedBox(0.84, 0.12, 0.58, 0.05)} material={flat(color, 0.9)} position={[-0.43, 0.43, 0.06]} castShadow />
      <mesh geometry={roundedBox(0.84, 0.12, 0.58, 0.05)} material={flat(color, 0.9)} position={[0.43, 0.43, 0.06]} castShadow />
      <mesh geometry={roundedBox(0.34, 0.34, 0.12, 0.05)} material={flat(pillow, 0.85)} position={[0.6, 0.62, -0.12]} rotation={[-0.25, 0, 0.15]} castShadow />
      {[-0.9, 0.9].map((x) => [-0.32, 0.32].map((z) => (
        <mesh key={`${x}${z}`} geometry={roundedBox(0.05, 0.12, 0.05, 0.015)} material={flat("#0F1318", 0.4)} position={[x, 0.06, z]} />
      )))}
    </group>
  );
};

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

/* ------------------------------------------------------------------ */
/* The apartment set                                                    */
/* ------------------------------------------------------------------ */

export const ApartmentSet: React.FC<{
  doorOpen?: number;
  clockText?: string;
  colon?: boolean;
  showFurniture?: boolean;
}> = ({ doorOpen = 0, clockText = "03:17", colon = true, showFurniture = true }) => {
  const { x0, x1, z0, z1, wallH, doorW, doorH } = ROOM;
  const wallMat = ceramic("plasterNight", 2);
  const T = 0.14;
  const winZ0 = -1.3;
  const winZ1 = 0.5;
  const winY0 = 0.95;
  const winY1 = 2.3;
  const mortar = ceramic("mortar", 3);
  return (
    <group>
      {/* mortar bed (revealed when tiles leave) */}
      <mesh geometry={plane(x1 - x0, z1 - z0)} material={mortar} rotation={[-Math.PI / 2, 0, 0]} position={[0, -TILE_T, 0]} receiveShadow />
      {/* surrounding slab so the diorama reads as a building */}
      <mesh geometry={roundedBox(x1 - x0 + 0.3, 0.6, z1 - z0 + 0.3, 0.02)} material={flat("#1B2129", 0.9)} position={[0, -TILE_T - 0.302, 0]} receiveShadow />

      {/* back wall with door opening */}
      <mesh geometry={roundedBox(-doorW / 2 - x0, wallH, T, 0.01)} material={wallMat} position={[(x0 + -doorW / 2) / 2, wallH / 2, z0 - T / 2]} castShadow receiveShadow />
      <mesh geometry={roundedBox(x1 - doorW / 2, wallH, T, 0.01)} material={wallMat} position={[(x1 + doorW / 2) / 2, wallH / 2, z0 - T / 2]} castShadow receiveShadow />
      <mesh geometry={roundedBox(doorW, wallH - doorH, T, 0.01)} material={wallMat} position={[0, doorH + (wallH - doorH) / 2, z0 - T / 2]} castShadow receiveShadow />
      {/* door frame */}
      <mesh geometry={roundedBox(0.06, doorH, T + 0.04, 0.01)} material={flat("#E9E2D6", 0.5)} position={[-doorW / 2 - 0.03, doorH / 2, z0 - T / 2]} castShadow />
      <mesh geometry={roundedBox(0.06, doorH, T + 0.04, 0.01)} material={flat("#E9E2D6", 0.5)} position={[doorW / 2 + 0.03, doorH / 2, z0 - T / 2]} castShadow />
      <mesh geometry={roundedBox(doorW + 0.12, 0.06, T + 0.04, 0.01)} material={flat("#E9E2D6", 0.5)} position={[0, doorH + 0.03, z0 - T / 2]} castShadow />
      {/* door leaf, hinged on the right, swings into the hallway */}
      <group position={[doorW / 2, 0, z0 - T / 2]} rotation={[0, -doorOpen * 1.75, 0]}>
        <mesh geometry={roundedBox(doorW - 0.02, doorH - 0.02, 0.05, 0.012)} material={flat("#E4DDD1", 0.55)} position={[-doorW / 2, doorH / 2, 0]} castShadow receiveShadow />
        <mesh geometry={roundedBox(doorW - 0.3, doorH * 0.36, 0.012, 0.01)} material={flat("#D8D0C3", 0.6)} position={[-doorW / 2, doorH * 0.7, 0.03]} />
        <mesh geometry={roundedBox(doorW - 0.3, doorH * 0.36, 0.012, 0.01)} material={flat("#D8D0C3", 0.6)} position={[-doorW / 2, doorH * 0.27, 0.03]} />
        <mesh geometry={roundedBox(0.18, 0.035, 0.06, 0.015)} material={flat("#20262F", 0.3, 0.6)} position={[-doorW + 0.18, 1.05, 0.06]} />
      </group>

      {/* left wall with window */}
      <mesh geometry={roundedBox(T, wallH, winZ0 - z0, 0.01)} material={wallMat} position={[x0 - T / 2, wallH / 2, (z0 + winZ0) / 2]} castShadow receiveShadow />
      <mesh geometry={roundedBox(T, wallH, z1 - winZ1, 0.01)} material={wallMat} position={[x0 - T / 2, wallH / 2, (winZ1 + z1) / 2]} castShadow receiveShadow />
      <mesh geometry={roundedBox(T, winY0, winZ1 - winZ0, 0.01)} material={wallMat} position={[x0 - T / 2, winY0 / 2, (winZ0 + winZ1) / 2]} castShadow receiveShadow />
      <mesh geometry={roundedBox(T, wallH - winY1, winZ1 - winZ0, 0.01)} material={wallMat} position={[x0 - T / 2, winY1 + (wallH - winY1) / 2, (winZ0 + winZ1) / 2]} castShadow receiveShadow />
      {/* window mullions */}
      <mesh geometry={roundedBox(0.05, winY1 - winY0, 0.05, 0.01)} material={flat("#20262F", 0.4)} position={[x0 - 0.04, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2]} castShadow />
      <mesh geometry={roundedBox(0.05, 0.05, winZ1 - winZ0, 0.01)} material={flat("#20262F", 0.4)} position={[x0 - 0.04, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2]} castShadow />
      <mesh geometry={roundedBox(0.2, 0.05, winZ1 - winZ0 + 0.1, 0.01)} material={flat("#E9E2D6", 0.5)} position={[x0 + 0.05, winY0, (winZ0 + winZ1) / 2]} castShadow />

      {/* baseboards */}
      <mesh geometry={roundedBox(x1 - x0, 0.09, 0.03, 0.008)} material={flat("#E9E2D6", 0.5)} position={[0, 0.045, z0 + 0.015]} />
      <mesh geometry={roundedBox(0.03, 0.09, z1 - z0, 0.008)} material={flat("#E9E2D6", 0.5)} position={[x0 + 0.015, 0.045, 0]} />

      {/* hallway beyond the door */}
      <mesh geometry={plane(3.2, 6)} material={ceramic("neutral", 4)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, z0 - 3.1]} receiveShadow />
      <mesh geometry={roundedBox(0.12, wallH, 6, 0.01)} material={flat("#D9C9B2", 0.9)} position={[-1.6, wallH / 2, z0 - 3.1]} receiveShadow />
      <mesh geometry={roundedBox(0.12, wallH, 6, 0.01)} material={flat("#D9C9B2", 0.9)} position={[1.6, wallH / 2, z0 - 3.1]} receiveShadow />
      <mesh geometry={roundedBox(3.3, 0.1, 6, 0.01)} material={flat("#E8DCCB", 0.9)} position={[0, wallH, z0 - 3.1]} />

      {showFurniture ? (
        <>
          {/* console + clock + lamp */}
          <mesh geometry={roundedBox(1.45, 0.5, 0.42, 0.03)} material={ceramic("oak")} position={[1.72, 0.36, z0 + 0.24]} castShadow receiveShadow />
          {[1.08, 2.36].map((x) => (
            <mesh key={x} geometry={roundedBox(0.05, 0.11, 0.05, 0.015)} material={flat("#0F1318", 0.4)} position={[x, 0.055, z0 + 0.24]} />
          ))}
          <DigitalClock text={clockText} colon={colon} position={[1.5, 0.73, z0 + 0.26]} />
          <group position={[2.15, 0.61, z0 + 0.24]}>
            <mesh geometry={roundedBox(0.04, 0.5, 0.04, 0.015)} material={flat("#20262F", 0.4, 0.5)} position={[0, 0.25, 0]} castShadow />
            <mesh position={[0, 0.55, 0]} material={flat("#F2EDE4", 0.7)} castShadow>
              <coneGeometry args={[0.2, 0.22, 24, 1, true]} />
            </mesh>
          </group>
          {/* framed print */}
          <group position={[-1.6, 1.55, z0 + 0.02]}>
            <mesh geometry={roundedBox(0.9, 1.1, 0.04, 0.01)} material={flat("#151A21", 0.5)} castShadow />
            <mesh geometry={plane(0.78, 0.98)} material={flat("#E9E2D6", 0.8)} position={[0, 0, 0.021]} />
            <mesh position={[0, 0.1, 0.023]} material={flat("#FF703D", 0.7)}>
              <circleGeometry args={[0.22, 40]} />
            </mesh>
            <mesh geometry={plane(0.5, 0.04)} material={flat("#121820", 0.7)} position={[0, -0.3, 0.023]} />
          </group>
          <Sofa position={[-2.05, 0, 1.55]} rotation={[0, Math.PI / 2, 0]} />
          <Plant position={[2.05, 0, 2.45]} scale={1.1} />
        </>
      ) : null}
    </group>
  );
};

/** Night lighting rig for the apartment. */
export const NightLights: React.FC<{ hall?: number; clockGlow?: number; moon?: number; fill?: number }> = ({
  hall = 0,
  clockGlow = 1,
  moon = 1,
  fill = 1,
}) => {
  const spot = useMemo(() => new THREE.SpotLight(), []);
  spot.position.set(0, 2.5, ROOM.z0 - 3.2);
  spot.target.position.set(0, 0, 1.2);
  spot.target.updateMatrixWorld();
  spot.color.set("#FFB98A");
  spot.intensity = hall * 90;
  spot.angle = 0.62;
  spot.penumbra = 0.7;
  spot.decay = 1.6;
  spot.distance = 16;
  spot.castShadow = hall > 0.01;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  const moonLight = useMemo(() => new THREE.DirectionalLight(), []);
  moonLight.position.set(-8, 6.5, -0.6);
  moonLight.target.position.set(0.4, 0, -0.2);
  moonLight.target.updateMatrixWorld();
  moonLight.color.set("#A9BFE0");
  moonLight.intensity = 2.4 * moon;
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.02;
  const sc = moonLight.shadow.camera;
  sc.left = -6;
  sc.right = 6;
  sc.top = 6;
  sc.bottom = -6;
  sc.near = 1;
  sc.far = 30;
  sc.updateProjectionMatrix();
  return (
    <>
      <hemisphereLight args={["#3A4C6E", "#0A0D12", 0.75 * fill]} />
      <ambientLight intensity={0.05 * fill} color="#6C7FA6" />
      <primitive object={moonLight} />
      <primitive object={moonLight.target} />
      <pointLight position={[1.5, 0.95, ROOM.z0 + 0.55]} color="#FF7A45" intensity={1.1 * clockGlow} distance={2.2} decay={2} />
      {/* cool rim from the window side keeps the night palette when the camera gets close */}
      <directionalLight position={[-3, 3, 4]} color="#7F98C4" intensity={0.55 * fill} />
      <primitive object={spot} />
      <primitive object={spot.target} />
      {hall > 0.01 ? <pointLight position={[0, 2.2, ROOM.z0 - 1.2]} color="#FFB98A" intensity={6 * hall} distance={6} decay={2} /> : null}
    </>
  );
};
