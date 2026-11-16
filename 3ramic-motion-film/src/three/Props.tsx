import React, { useMemo } from "react";
import * as THREE from "three";
import { ceramic, flat, plane, roundedBox } from "./kit";
import type { TexKey } from "./textures";
import { ART } from "../config/art";
import { BRAND } from "../config/brand";
import { clamp, E, V3 } from "../anim";

/** The resignation letter as a small 3D sheet (the readable version is the 2D paper on the lens). */
export const Letter3D: React.FC<{ position?: V3; rotation?: V3; scale?: number }> = ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh geometry={roundedBox(0.5, 0.66, 0.012, 0.004)} material={flat(ART.paper, 0.9)} castShadow />
    <mesh geometry={roundedBox(0.3, 0.06, 0.004, 0.002)} material={flat("#15181C", 0.8)} position={[0.04, 0.22, 0.008]} />
    {[0.08, 0.0, -0.08, -0.16].map((y, i) => (
      <mesh key={i} geometry={roundedBox(i === 3 ? 0.2 : 0.36, 0.018, 0.004, 0.002)} material={flat("#8B8F96", 0.8)} position={[i === 3 ? 0.08 : 0, y, 0.008]} />
    ))}
  </group>
);

/** Label for the sample box: the brand name as plain text (Latin, no shaping needed), or the official logo if one is set. */
const labelCache = new Map<string, THREE.CanvasTexture>();
const boxLabel = () => {
  const id = BRAND.name;
  const hit = labelCache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#F5F2EC";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#15181C";
  ctx.font = '700 132px "Vazirmatn", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(BRAND.name, 256, 132);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  labelCache.set(id, t);
  return t;
};

/**
 * The 3ramic sample box: slides in closed, the lid swings open, and a coordinated set of
 * samples rises out of it — one palette, chosen together.
 */
export const SampleBox: React.FC<{ position: V3; rotation?: V3; open: number; glowAmt?: number; scale?: number }> = ({ position, rotation = [0, 0, 0], open, glowAmt = 0, scale = 1 }) => {
  const kraft = flat(ART.kraft, 0.85);
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: boxLabel(), roughness: 0.7 }), []);
  const inside = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFE9C4", transparent: true, depthWrite: false, toneMapped: false }), []);
  inside.opacity = 0.85 * glowAmt;
  const lid = E.outBack(clamp(open), 1.4);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={roundedBox(2.0, 1.0, 1.4, 0.04)} material={kraft} position={[0, 0.5, 0]} castShadow receiveShadow />
      <mesh geometry={plane(1.3, 0.62)} material={label} position={[0, 0.52, 0.705]} />
      <mesh geometry={roundedBox(2.02, 0.1, 0.16, 0.02)} material={flat("#8E6A42", 0.8)} position={[0, 0.82, 0.71]} />
      {glowAmt > 0.01 ? <mesh geometry={plane(1.84, 1.24)} material={inside} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.004, 0]} /> : null}
      {/* lid hinged along the back edge */}
      <group position={[0, 1.0, -0.7]} rotation={[-lid * 1.9, 0, 0]}>
        <mesh geometry={roundedBox(2.06, 0.08, 1.46, 0.03)} material={kraft} position={[0, 0.04, 0.72]} castShadow />
      </group>
    </group>
  );
};

/** One sample from the box: a real tile body with the chosen surface. */
export const Chip: React.FC<{ tex?: TexKey; color?: string; position: V3; rotation?: V3; w?: number; d?: number; scale?: number }> = ({
  tex,
  color,
  position,
  rotation = [0, 0, 0],
  w = 0.9,
  d = 0.9,
  scale = 1,
}) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh geometry={roundedBox(w, 0.08, d, 0.02)} material={flat("#EDE6DA", 0.5)} castShadow />
    <mesh geometry={plane(w * 0.95, d * 0.95)} material={tex ? ceramic(tex) : flat(color ?? "#ccc", 0.8)} position={[0, 0.0415, 0]} rotation={[-Math.PI / 2, 0, 0]} />
  </group>
);
