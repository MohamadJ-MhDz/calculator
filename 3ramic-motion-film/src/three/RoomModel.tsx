import React from "react";
import * as THREE from "three";
import { BISCUIT, ceramic, FINISH, flat, plane, roundedBox } from "./kit";
import { getTexture, TexKey } from "./textures";
import { Plant, Sofa } from "./Apartment";
import type { V3 } from "../anim";

/* ------------------------------------------------------------------ */
/* Tiled surfaces with independent X/Y repeat                           */
/* ------------------------------------------------------------------ */

const surfCache = new Map<string, THREE.MeshPhysicalMaterial>();
export const tiled = (key: TexKey, rx: number, ry: number) => {
  const id = `${key}:${rx}:${ry}`;
  const hit = surfCache.get(id);
  if (hit) return hit;
  const base = getTexture(key, 512);
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  const fin = FINISH[key];
  const m = new THREE.MeshPhysicalMaterial({
    map: t,
    roughness: fin.roughness,
    clearcoat: fin.clearcoat ?? 0,
    clearcoatRoughness: fin.clearcoatRoughness ?? 0.1,
  });
  surfCache.set(id, m);
  return m;
};

/** A floor tile that can flip over to reveal a different material on its underside. */
export const FlipTile: React.FC<{
  a: TexKey;
  b?: TexKey;
  flip?: number;
  position: V3;
  size?: number;
  drop?: number;
  faceRot?: number;
  jitter?: number;
}> = ({ a, b, flip = 0, position, size = 1, drop = 0, faceRot = 0, jitter = 0 }) => {
  const t = 0.07 * size;
  const s = size * 0.985;
  const lift = Math.sin(flip * Math.PI) * 0.45 * size + drop;
  return (
    <group position={[position[0] + jitter, position[1] - t / 2 + lift, position[2]]} rotation={[flip * Math.PI, 0, 0]}>
      <mesh geometry={roundedBox(s, t, s, Math.min(0.02, t * 0.3))} material={BISCUIT()} castShadow receiveShadow />
      <mesh geometry={plane(s * 0.965, s * 0.965)} material={ceramic(a)} position={[0, t / 2 + 0.0015, 0]} rotation={[-Math.PI / 2, 0, faceRot]} receiveShadow />
      {b ? (
        <mesh geometry={plane(s * 0.965, s * 0.965)} material={ceramic(b)} position={[0, -t / 2 - 0.0015, 0]} rotation={[Math.PI / 2, 0, faceRot]} receiveShadow />
      ) : null}
    </group>
  );
};

/* ------------------------------------------------------------------ */
/* Furniture                                                            */
/* ------------------------------------------------------------------ */

const torusGeo = new Map<string, THREE.TorusGeometry>();
const torus = (r: number, t: number) => {
  const id = `${r}:${t}`;
  let g = torusGeo.get(id);
  if (!g) {
    g = new THREE.TorusGeometry(r, t, 16, 40);
    torusGeo.set(id, g);
  }
  return g;
};
const cylGeo = new Map<string, THREE.CylinderGeometry>();
const cyl = (rt: number, rb: number, h: number, seg = 28) => {
  const id = `${rt}:${rb}:${h}:${seg}`;
  let g = cylGeo.get(id);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg);
    cylGeo.set(id, g);
  }
  return g;
};

export const Kitchen: React.FC<{ w: number; d: number; counter: TexKey; splash?: TexKey; wrong?: boolean; pop?: number }> = ({
  w,
  d,
  counter,
  wrong = false,
  pop = 1,
}) => {
  const cab = flat(wrong ? "#9FC9D9" : "#EDE6DA", 0.55);
  const handle = flat("#1A2029", 0.35, 0.6);
  return (
    <group scale={[1, pop, 1]}>
      {/* base run along back wall */}
      <group position={[0, 0, -d / 2 + 0.33]}>
        <mesh geometry={roundedBox(w - 0.1, 0.82, 0.62, 0.02)} material={cab} position={[0, 0.41, 0]} castShadow receiveShadow />
        <mesh geometry={roundedBox(w - 0.05, 0.06, 0.68, 0.015)} material={ceramic(counter)} position={[0, 0.85, 0.02]} castShadow receiveShadow />
        {Array.from({ length: Math.floor(w / 0.8) }).map((_, i) => (
          <mesh key={i} geometry={roundedBox(0.28, 0.025, 0.03, 0.01)} material={handle} position={[-w / 2 + 0.5 + i * 0.8, 0.7, 0.32]} />
        ))}
        {/* hob + sink */}
        <mesh geometry={roundedBox(0.55, 0.012, 0.4, 0.01)} material={flat("#0E1218", 0.2, 0.3)} position={[w / 2 - 0.9, 0.885, 0.02]} />
        <mesh geometry={roundedBox(0.5, 0.02, 0.36, 0.05)} material={flat("#AEB5BD", 0.25, 0.9)} position={[-w / 2 + 0.9, 0.88, 0.02]} />
      </group>
      {/* open shelf */}
      <mesh geometry={roundedBox(w * 0.55, 0.05, 0.25, 0.01)} material={ceramic("oak")} position={[-w * 0.12, 1.55, -d / 2 + 0.14]} castShadow />
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={cyl(0.06, 0.05, 0.12)} material={flat(i === 1 ? "#FF703D" : "#E9E2D6", 0.6)} position={[-w * 0.3 + i * 0.25, 1.64, -d / 2 + 0.14]} castShadow />
      ))}
      {/* island */}
      <group position={[0.2, 0, 0.45]}>
        <mesh geometry={roundedBox(1.5, 0.82, 0.72, 0.03)} material={flat(wrong ? "#6FA8BF" : "#273140", 0.6)} position={[0, 0.41, 0]} castShadow receiveShadow />
        <mesh geometry={roundedBox(1.62, 0.07, 0.84, 0.02)} material={ceramic(counter)} position={[0, 0.86, 0]} castShadow receiveShadow />
        {[-0.45, 0.45].map((x) => (
          <group key={x} position={[x, 0, 0.62]}>
            <mesh geometry={cyl(0.17, 0.17, 0.05)} material={flat("#FF703D", 0.6)} position={[0, 0.62, 0]} castShadow />
            <mesh geometry={cyl(0.02, 0.02, 0.6, 8)} material={flat("#1A2029", 0.4, 0.5)} position={[0, 0.3, 0]} />
          </group>
        ))}
      </group>
      {/* pendant lights */}
      {[-0.35, 0.75].map((x) => (
        <group key={x} position={[x, 1.75, 0.45]}>
          <mesh geometry={cyl(0.006, 0.006, 0.5, 6)} material={flat("#1A2029", 0.4)} position={[0, 0.25, 0]} />
          <mesh material={flat("#FF703D", 0.5)} castShadow>
            <coneGeometry args={[0.16, 0.18, 28, 1, true]} />
          </mesh>
          <mesh material={flat("#FFE3C4", 0.4, 0, "#FFC48A", 2)} position={[0, -0.06, 0]}>
            <sphereGeometry args={[0.05, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const Bathroom: React.FC<{ w: number; d: number; wrong?: boolean; pop?: number }> = ({ w, d, wrong = false, pop = 1 }) => {
  const white = flat("#F7F5F0", 0.2);
  return (
    <group scale={[1, pop, 1]}>
      {/* freestanding tub */}
      <group position={[w / 2 - 0.85, 0, -d / 2 + 0.75]}>
        <mesh geometry={roundedBox(1.0, 0.55, 1.6, 0.22, 4)} material={white} position={[0, 0.3, 0]} castShadow receiveShadow />
        <mesh geometry={roundedBox(0.78, 0.1, 1.36, 0.08, 3)} material={flat(wrong ? "#7AB8C9" : "#CFE0E6", 0.1)} position={[0, 0.52, 0]} />
      </group>
      {/* vanity + basin + mirror */}
      <group position={[-w / 2 + 0.38, 0, -1.1]}>
        <mesh geometry={roundedBox(0.55, 0.5, 1.1, 0.03)} material={wrong ? flat("#B04B8C", 0.5) : ceramic("oak")} position={[0, 0.55, 0]} castShadow receiveShadow />
        <mesh geometry={cyl(0.22, 0.17, 0.12)} material={white} position={[0.02, 0.86, 0]} castShadow />
        <mesh geometry={cyl(0.38, 0.38, 0.03, 40)} material={flat("#C9CED4", 0.08, 1)} position={[-0.25, 1.55, 0]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={torus(0.39, 0.02)} material={flat("#FF703D", 0.4)} position={[-0.23, 1.55, 0]} rotation={[0, Math.PI / 2, 0]} />
      </group>
      {/* towel */}
      <mesh geometry={roundedBox(0.06, 0.6, 0.38, 0.025)} material={flat(wrong ? "#E8C21A" : "#FF703D", 0.95)} position={[-w / 2 + 0.1, 1.05, d / 2 - 0.7]} castShadow />
      <Plant position={[w / 2 - 0.35, 0, d / 2 - 0.4]} scale={0.75} />
    </group>
  );
};

export const Living: React.FC<{ w: number; d: number; wrong?: boolean; pop?: number }> = ({ w, d, wrong = false, pop = 1 }) => (
  <group scale={[1, pop, 1]}>
    <Sofa position={[0.1, 0, -d / 2 + 0.55]} color={wrong ? "#6B3E8E" : "#2B3442"} pillow={wrong ? "#3E8E66" : "#FF703D"} />
    {/* round coffee table */}
    <group position={[0.15, 0, 0.45]}>
      <mesh geometry={cyl(0.48, 0.48, 0.06, 40)} material={wrong ? flat("#C0392B", 0.4) : ceramic("terrazzo")} position={[0, 0.38, 0]} castShadow receiveShadow />
      <mesh geometry={cyl(0.12, 0.2, 0.36, 24)} material={flat("#1A2029", 0.5)} position={[0, 0.18, 0]} castShadow />
      <mesh geometry={roundedBox(0.3, 0.05, 0.22, 0.01)} material={flat("#E9E2D6", 0.8)} position={[0.12, 0.435, 0.05]} rotation={[0, 0.4, 0]} />
    </group>
    {/* arc floor lamp */}
    <group position={[-w / 2 + 0.45, 0, 0.1]}>
      <mesh geometry={cyl(0.18, 0.2, 0.05)} material={flat("#1A2029", 0.4, 0.4)} position={[0, 0.025, 0]} castShadow />
      <mesh geometry={cyl(0.015, 0.015, 1.7, 8)} material={flat("#1A2029", 0.3, 0.6)} position={[0, 0.85, 0]} castShadow />
      <mesh material={flat("#F2EDE4", 0.6, 0, "#FFD7B0", 0.6)} position={[0.08, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
    <Plant position={[w / 2 - 0.45, 0, -d / 2 + 0.45]} scale={0.95} pot={wrong ? "#F25A8C" : "#E4DDD1"} />
  </group>
);

/* ------------------------------------------------------------------ */
/* Room model                                                           */
/* ------------------------------------------------------------------ */

export type RoomKind = "kitchen" | "bathroom" | "living";

export const RoomModel: React.FC<{
  kind: RoomKind;
  w?: number;
  d?: number;
  wallH?: number;
  floor: (i: number, j: number) => { a: TexKey; b?: TexKey; flip?: number; drop?: number; jitter?: number; hidden?: boolean };
  backWall?: TexKey | null;
  sideWall?: TexKey | null;
  wallTile?: number;
  wallRows?: number;
  plaster?: TexKey;
  furniture?: number;
  wrong?: boolean;
  counter?: TexKey;
  position?: V3;
  rotation?: V3;
  scale?: number;
  plinth?: boolean;
  /** Door opening in the side wall (room-local z centre). */
  sideDoor?: { z: number; w: number; h: number } | null;
  children?: React.ReactNode;
}> = ({
  kind,
  w = 4,
  d = 4,
  wallH = 2.1,
  floor,
  backWall = null,
  sideWall = null,
  wallTile = 0.5,
  wallRows = 99,
  plaster = "plasterIvory",
  furniture = 1,
  wrong = false,
  counter = "terrazzo",
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  plinth = true,
  sideDoor = null,
  children,
}) => {
  const T = 0.1;
  const rowsTotal = Math.round(wallH / wallTile);
  const rows = Math.min(rowsTotal, wallRows);
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      const t = floor(i, j);
      if (t.hidden) continue;
      tiles.push(
        <FlipTile
          key={`${i}-${j}`}
          a={t.a}
          b={t.b}
          flip={t.flip}
          drop={t.drop}
          jitter={t.jitter}
          faceRot={((i * 7 + j * 3) % 4) * (Math.PI / 2)}
          position={[-w / 2 + 0.5 + i, 0, -d / 2 + 0.5 + j]}
        />,
      );
    }
  }
  const wallPlaster = ceramic(plaster, 1);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {plinth ? (
        <>
          <mesh geometry={roundedBox(w + 0.36, 0.34, d + 0.36, 0.04)} material={flat("#20272F", 0.7)} position={[0, -0.25, 0]} castShadow receiveShadow />
          <mesh geometry={roundedBox(w + 0.38, 0.03, d + 0.38, 0.01)} material={flat("#FF703D", 0.5)} position={[0, -0.415, 0]} />
        </>
      ) : null}
      <mesh geometry={plane(w, d)} material={flat("#3A3F45", 0.95)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.075, 0]} receiveShadow />
      {tiles}
      {/* back wall */}
      <mesh geometry={roundedBox(w + T, wallH, T, 0.015)} material={wallPlaster} position={[-T / 2, wallH / 2, -d / 2 - T / 2]} castShadow receiveShadow />
      {backWall
        ? Array.from({ length: rows }).map((_, r) => (
            <mesh
              key={r}
              geometry={plane(w, wallTile)}
              material={tiled(backWall, w / wallTile, 1)}
              position={[0, wallTile * (r + 0.5), -d / 2 + 0.004]}
              receiveShadow
            />
          ))
        : null}
      {/* side wall (optionally with a door opening) */}
      {sideDoor ? (
        <>
          {(() => {
            const a0 = -d / 2;
            const a1 = sideDoor.z - sideDoor.w / 2;
            const b0 = sideDoor.z + sideDoor.w / 2;
            const b1 = d / 2;
            const segs: [number, number][] = [
              [a0, a1],
              [b0, b1],
            ];
            return (
              <>
                {segs.map(([z0, z1], k) =>
                  z1 - z0 > 0.01 ? (
                    <mesh key={k} geometry={roundedBox(T, wallH, z1 - z0, 0.015)} material={wallPlaster} position={[-w / 2 - T / 2, wallH / 2, (z0 + z1) / 2]} castShadow receiveShadow />
                  ) : null,
                )}
                <mesh geometry={roundedBox(T, wallH - sideDoor.h, sideDoor.w, 0.015)} material={wallPlaster} position={[-w / 2 - T / 2, sideDoor.h + (wallH - sideDoor.h) / 2, sideDoor.z]} castShadow receiveShadow />
                <mesh geometry={roundedBox(T + 0.05, 0.05, sideDoor.w + 0.1, 0.01)} material={flat("#1A2029", 0.4)} position={[-w / 2 - T / 2, sideDoor.h + 0.025, sideDoor.z]} />
                {sideWall
                  ? Array.from({ length: rows }).map((_, r) => {
                      const yc = wallTile * (r + 0.5);
                      if (yc > sideDoor.h) {
                        return (
                          <mesh key={r} geometry={plane(d, wallTile)} material={tiled(sideWall, d / wallTile, 1)} position={[-w / 2 + 0.004, yc, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow />
                        );
                      }
                      return segs.map(([z0, z1], k) =>
                        z1 - z0 > 0.01 ? (
                          <mesh
                            key={`${r}-${k}`}
                            geometry={plane(z1 - z0, wallTile)}
                            material={tiled(sideWall, Math.max(0.5, (z1 - z0) / wallTile), 1)}
                            position={[-w / 2 + 0.004, yc, (z0 + z1) / 2]}
                            rotation={[0, Math.PI / 2, 0]}
                            receiveShadow
                          />
                        ) : null,
                      );
                    })
                  : null}
              </>
            );
          })()}
        </>
      ) : (
        <>
          <mesh geometry={roundedBox(T, wallH, d, 0.015)} material={wallPlaster} position={[-w / 2 - T / 2, wallH / 2, 0]} castShadow receiveShadow />
          {sideWall
            ? Array.from({ length: rows }).map((_, r) => (
                <mesh
                  key={r}
                  geometry={plane(d, wallTile)}
                  material={tiled(sideWall, d / wallTile, 1)}
                  position={[-w / 2 + 0.004, wallTile * (r + 0.5), 0]}
                  rotation={[0, Math.PI / 2, 0]}
                  receiveShadow
                />
              ))
            : null}
        </>
      )}
      {furniture > 0.001 ? (
        kind === "kitchen" ? (
          <Kitchen w={w} d={d} counter={counter} wrong={wrong} pop={furniture} />
        ) : kind === "bathroom" ? (
          <Bathroom w={w} d={d} wrong={wrong} pop={furniture} />
        ) : (
          <Living w={w} d={d} wrong={wrong} pop={furniture} />
        )
      ) : null}
      {children}
    </group>
  );
};
