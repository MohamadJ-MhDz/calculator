import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getBump, getTexture, TexKey } from "./textures";
import type { V3 } from "../anim";
import { getInputProps } from "remotion";

/** Canvas pixel ratio. Pass --props='{"dpr":0.5}' for a fast low-res preview render. */
export const DPR: number = Number((getInputProps() as { dpr?: number }).dpr ?? 1);

/* ------------------------------------------------------------------ */
/* Shared geometry (created once per tab)                              */
/* ------------------------------------------------------------------ */

const geoCache = new Map<string, THREE.BufferGeometry>();
export const roundedBox = (w: number, h: number, d: number, r = 0.02, seg = 2) => {
  const id = `rb:${w}:${h}:${d}:${r}:${seg}`;
  let g = geoCache.get(id);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, r);
    geoCache.set(id, g);
  }
  return g;
};

export const plane = (w: number, h: number) => {
  const id = `pl:${w}:${h}`;
  let g = geoCache.get(id);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    geoCache.set(id, g);
  }
  return g;
};

/* ------------------------------------------------------------------ */
/* Ceramic materials                                                    */
/* ------------------------------------------------------------------ */

type Finish = {
  roughness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  bump?: number;
  metalness?: number;
};

export const FINISH: Record<TexKey, Finish> = {
  marble: { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 },
  travertine: { roughness: 0.62, bump: 0.6 },
  terrazzo: { roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 },
  stone: { roughness: 0.82, bump: 1.2 },
  porcelain: { roughness: 0.74 },
  neutral: { roughness: 0.5, clearcoat: 0.15 },
  hero: { roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.08 },
  pool: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 },
  checker: { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05 },
  floral: { roughness: 0.25, clearcoat: 0.8 },
  stripe: { roughness: 0.25, clearcoat: 0.8 },
  terracotta: { roughness: 0.85, bump: 0.6 },
  green: { roughness: 0.12, clearcoat: 1 },
  bluewhite: { roughness: 0.16, clearcoat: 0.9 },
  gray: { roughness: 0.55 },
  clay: { roughness: 0.95, bump: 0.8 },
  mortar: { roughness: 0.97, bump: 1.5 },
  plasterIvory: { roughness: 0.92 },
  plasterNight: { roughness: 0.92 },
  plasterStone: { roughness: 0.92 },
  oak: { roughness: 0.55, clearcoat: 0.3 },
  fabricCharcoal: { roughness: 0.98 },
  fabricIvory: { roughness: 0.98 },
  sign: { roughness: 0.8 },
};

const matCache = new Map<string, THREE.Material>();

/** Physically-based ceramic material driven by a procedural texture. */
const HIRES: TexKey[] = ["terrazzo", "marble", "hero", "travertine", "stone"];

export const ceramic = (key: TexKey, repeat = 1, sizeIn?: number): THREE.MeshPhysicalMaterial => {
  const size = sizeIn ?? (HIRES.includes(key) && repeat === 1 ? 1024 : 512);
  const id = `cer:${key}:${repeat}:${size}`;
  const hit = matCache.get(id);
  if (hit) return hit as THREE.MeshPhysicalMaterial;
  const fin = FINISH[key];
  const m = new THREE.MeshPhysicalMaterial({
    map: getTexture(key, size, repeat),
    roughness: fin.roughness,
    metalness: fin.metalness ?? 0,
    clearcoat: fin.clearcoat ?? 0,
    clearcoatRoughness: fin.clearcoatRoughness ?? 0.1,
  });
  if (fin.bump) {
    const b = getBump(key, size);
    if (repeat !== 1) {
      b.wrapS = b.wrapT = THREE.RepeatWrapping;
      b.repeat.set(repeat, repeat);
    }
    m.bumpMap = b;
    m.bumpScale = fin.bump;
  }
  matCache.set(id, m);
  return m;
};

export const flat = (color: string, roughness = 0.6, metalness = 0, emissive?: string, emissiveIntensity = 1) => {
  const id = `flat:${color}:${roughness}:${metalness}:${emissive}:${emissiveIntensity}`;
  const hit = matCache.get(id);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (emissive) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = emissiveIntensity;
  }
  matCache.set(id, m);
  return m;
};

/** Glazed ceramic body (tile edges). */
export const BISCUIT = () => flat("#EDE6DA", 0.45);

/* ------------------------------------------------------------------ */
/* Environment & camera                                                 */
/* ------------------------------------------------------------------ */

/** Procedural studio environment (three.js RoomEnvironment through PMREM) for glaze reflections. */
export const StudioEnv: React.FC<{ intensity?: number; rotationY?: number }> = ({ intensity = 0.7, rotationY = 0 }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const tex = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return env;
  }, [gl]);
  useLayoutEffect(() => {
    scene.environment = tex;
    scene.environmentIntensity = intensity;
    scene.environmentRotation.set(0, rotationY, 0);
  }, [scene, tex, intensity, rotationY]);
  return null;
};

/**
 * Deterministic camera. Updated in a layout effect so it lands *before*
 * @remotion/three's ManualFrameRenderer advances the R3F loop.
 */
export const Cam: React.FC<{ pos: V3; target: V3; fov?: number; roll?: number }> = ({
  pos,
  target,
  fov = 35,
  roll = 0,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(target[0], target[1], target[2]);
    if (roll) camera.rotateZ(roll);
    camera.fov = fov;
    camera.near = 0.05;
    camera.far = 300;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  });
  return null;
};

/** Directional key light with a well-fitted shadow frustum. */
export const KeyLight: React.FC<{
  position: V3;
  target?: V3;
  color?: string;
  intensity?: number;
  extent?: number;
  mapSize?: number;
  bias?: number;
}> = ({ position, target = [0, 0, 0], color = "#ffffff", intensity = 2, extent = 8, mapSize = 2048, bias = -0.0004 }) => {
  const light = useMemo(() => new THREE.DirectionalLight(), []);
  useLayoutEffect(() => {
    light.position.set(...position);
    light.target.position.set(...target);
    light.target.updateMatrixWorld();
    light.color.set(color);
    light.intensity = intensity;
    light.castShadow = true;
    light.shadow.mapSize.set(mapSize, mapSize);
    light.shadow.bias = bias;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 4;
    const c = light.shadow.camera;
    c.left = -extent;
    c.right = extent;
    c.top = extent;
    c.bottom = -extent;
    c.near = 0.5;
    c.far = 60;
    c.updateProjectionMatrix();
  });
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Ceramic slab (tile) — rounded glazed body + textured face            */
/* ------------------------------------------------------------------ */

export const Slab: React.FC<{
  tex: TexKey;
  w?: number;
  d?: number;
  t?: number;
  position?: V3;
  rotation?: V3;
  scale?: number | V3;
  faceRot?: number;
  repeat?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  back?: boolean;
}> = ({
  tex,
  w = 1,
  d = 1,
  t = 0.08,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  faceRot = 0,
  repeat = 1,
  castShadow = true,
  receiveShadow = true,
  back = false,
}) => {
  const r = Math.min(0.022, t * 0.3, w * 0.1);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={roundedBox(w, t, d, r)} material={BISCUIT()} castShadow={castShadow} receiveShadow={receiveShadow} />
      <mesh
        geometry={plane(w - r * 1.6, d - r * 1.6)}
        material={ceramic(tex, repeat)}
        position={[0, t / 2 + 0.0015, 0]}
        rotation={[-Math.PI / 2, 0, faceRot]}
        receiveShadow={receiveShadow}
      />
      {back ? (
        <mesh
          geometry={plane(w - r * 1.6, d - r * 1.6)}
          material={ceramic("clay")}
          position={[0, -t / 2 - 0.0015, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ) : null}
    </group>
  );
};

/** Soft contact shadow blob under objects. */
let blobTex: THREE.CanvasTexture | null = null;
const getBlobTex = () => {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.5, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
};
const blobMats = new Map<number, THREE.MeshBasicMaterial>();
export const BlobShadow: React.FC<{ position?: V3; w?: number; d?: number; opacity?: number }> = ({
  position = [0, 0.004, 0],
  w = 1,
  d = 1,
  opacity = 1,
}) => {
  const key = Math.round(opacity * 20) / 20;
  let m = blobMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: getBlobTex(), transparent: true, depthWrite: false, opacity: key });
    blobMats.set(key, m);
  }
  if (key <= 0) return null;
  return <mesh geometry={plane(1, 1)} material={m} position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[w, d, 1]} />;
};

/* ------------------------------------------------------------------ */
/* Floating interface card (rounded slab + glowing inset frame)        */
/* ------------------------------------------------------------------ */

const roundedRect = (w: number, d: number, r: number, into: THREE.Shape | THREE.Path) => {
  const x = -w / 2;
  const y = -d / 2;
  into.moveTo(x + r, y);
  into.lineTo(x + w - r, y);
  into.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  into.lineTo(x + w, y + d - r);
  into.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  into.lineTo(x + r, y + d);
  into.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  into.lineTo(x, y + r);
  into.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return into;
};

/** Rounded-corner slab lying in the XZ plane, top face at y = 0. */
export const cardSlab = (w: number, d: number, r: number, t: number) => {
  const id = `card:${w}:${d}:${r}:${t}`;
  let g = geoCache.get(id);
  if (!g) {
    g = new THREE.ExtrudeGeometry(roundedRect(w, d, r, new THREE.Shape()) as THREE.Shape, {
      depth: t,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.rotateX(Math.PI / 2);
    g.translate(0, -0.025, 0);
    geoCache.set(id, g);
  }
  return g;
};

/** Thin rounded-rectangle outline (a frame of the given line width) lying in the XZ plane. */
export const cardFrame = (w: number, d: number, r: number, line: number) => {
  const id = `frame:${w}:${d}:${r}:${line}`;
  let g = geoCache.get(id);
  if (!g) {
    const shape = roundedRect(w, d, r, new THREE.Shape()) as THREE.Shape;
    shape.holes.push(roundedRect(w - line * 2, d - line * 2, Math.max(0.01, r - line), new THREE.Path()) as THREE.Path);
    g = new THREE.ShapeGeometry(shape, 10);
    g.rotateX(-Math.PI / 2);
    geoCache.set(id, g);
  }
  return g;
};

const glowCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit, tone-map-free colour for interface lines that must stay brand-accurate. */
export const glow = (color: string, opacity = 1) => {
  const id = `${color}:${opacity}`;
  let m = glowCache.get(id);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
    glowCache.set(id, m);
  }
  return m;
};
