import React from "react";
import * as THREE from "three";
import { BISCUIT, ceramic, flat, plane, roundedBox, BlobShadow } from "./kit";
import type { TexKey } from "./textures";
import type { V3 } from "../anim";

/**
 * THE TILE — the film's character.
 * A real glazed ceramic tile (rounded biscuit body, textured glaze face, ribbed clay back)
 * with tiny legs, shoes, arms and an expressive face. Every pose parameter is a plain
 * number so it can be driven deterministically from useCurrentFrame().
 */

export const TILE_T = 0.085;
export const LEG = 0.34;
const ARM = 0.3;

const gcache = new Map<string, THREE.BufferGeometry>();
const G = <T extends THREE.BufferGeometry>(id: string, make: () => T): T => {
  let g = gcache.get(id);
  if (!g) {
    g = make();
    gcache.set(id, g);
  }
  return g as T;
};
const legGeo = () => G("leg", () => new THREE.CylinderGeometry(0.028, 0.03, 1, 10));
const armGeo = () => G("arm", () => new THREE.CylinderGeometry(0.022, 0.024, 1, 8));
const sphereGeo = () => G("sphere", () => new THREE.SphereGeometry(1, 22, 16));
const arcGeo = () => G("arc", () => new THREE.TorusGeometry(1, 0.2, 8, 24, Math.PI));
const cylGeo = () => G("cyl", () => new THREE.CylinderGeometry(1, 1, 1, 18));

export type Carry = "none" | "hand" | "trolley" | "box" | "sign";

export type TileCharProps = {
  position?: V3;
  facing?: number;
  scale?: number;
  tex?: TexKey;
  faceRot?: number;
  /** 0 upright .. 1 lying flat face-up (hinged at bottom edge). */
  tilt?: number;
  lift?: number;
  legs?: number;
  arms?: number;
  walk?: number;
  stride?: number;
  lean?: number;
  sway?: number;
  eyes?: number;
  face?: number;
  look?: [number, number];
  brow?: number;
  browLift?: number;
  mouth?: number;
  happy?: number;
  carry?: Carry;
  luggage?: string;
  armRaise?: number;
  wave?: number;
  grab?: number;
  shoes?: string;
  shadowBlob?: number;
  squash?: number;
  castShadow?: boolean;
};

const DARK = "#161C24";

export const Suitcase: React.FC<{
  color: string;
  w?: number;
  h?: number;
  d?: number;
  position?: V3;
  rotation?: V3;
  scale?: number;
  trolley?: number;
}> = ({ color, w = 0.3, h = 0.24, d = 0.11, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, trolley = 0 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh geometry={roundedBox(w, h, d, 0.028, 3)} material={flat(color, 0.42)} castShadow />
    <mesh geometry={roundedBox(0.024, h + 0.006, d + 0.008, 0.008)} material={flat(DARK, 0.5)} position={[-w * 0.28, 0, 0]} />
    <mesh geometry={roundedBox(0.024, h + 0.006, d + 0.008, 0.008)} material={flat(DARK, 0.5)} position={[w * 0.28, 0, 0]} />
    {trolley > 0 ? (
      <>
        {/* telescopic handle */}
        <mesh geometry={roundedBox(0.018, 0.34 * trolley, 0.018, 0.006)} material={flat("#9AA3AD", 0.3, 0.8)} position={[-0.07, h / 2 + 0.17 * trolley, d * 0.3]} />
        <mesh geometry={roundedBox(0.018, 0.34 * trolley, 0.018, 0.006)} material={flat("#9AA3AD", 0.3, 0.8)} position={[0.07, h / 2 + 0.17 * trolley, d * 0.3]} />
        <mesh geometry={roundedBox(0.17, 0.03, 0.03, 0.012)} material={flat(DARK, 0.5)} position={[0, h / 2 + 0.34 * trolley, d * 0.3]} />
        {/* wheels */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            geometry={cylGeo()}
            material={flat(DARK, 0.6)}
            position={[s * (w / 2 - 0.04), -h / 2 - 0.025, -d * 0.25]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.028, 0.025, 0.028]}
          />
        ))}
      </>
    ) : (
      <mesh geometry={arcGeo()} material={flat(DARK, 0.5)} position={[0, h / 2, 0]} scale={[0.055, 0.05, 0.06]} />
    )}
  </group>
);

/** Cardboard "I quit" box with a tiny plant. */
const QuitBox: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <mesh geometry={roundedBox(0.4, 0.24, 0.28, 0.012)} material={flat("#C79E6B", 0.85)} castShadow />
    <mesh geometry={roundedBox(0.41, 0.03, 0.06, 0.005)} material={flat("#B78D5B", 0.7)} position={[0, 0.115, 0]} />
    <mesh geometry={cylGeo()} material={flat("#E9E2D6", 0.6)} position={[-0.08, 0.17, 0]} scale={[0.05, 0.1, 0.05]} />
    <mesh geometry={sphereGeo()} material={flat("#4E7A55", 0.7)} position={[-0.1, 0.27, 0]} scale={[0.035, 0.08, 0.03]} rotation={[0, 0, 0.4]} />
    <mesh geometry={sphereGeo()} material={flat("#5E8C63", 0.7)} position={[-0.05, 0.28, 0.01]} scale={[0.035, 0.09, 0.03]} rotation={[0, 0, -0.35]} />
    <mesh geometry={sphereGeo()} material={flat("#46704C", 0.7)} position={[-0.08, 0.3, -0.01]} scale={[0.03, 0.08, 0.03]} />
    {/* tiny framed photo */}
    <mesh geometry={roundedBox(0.12, 0.1, 0.012, 0.004)} material={flat("#121820", 0.5)} position={[0.09, 0.15, -0.03]} rotation={[-0.2, 0, 0.1]} />
    <mesh geometry={plane(0.09, 0.07)} material={flat("#FF703D", 0.6)} position={[0.09, 0.152, -0.022]} rotation={[-0.2, 0, 0.1]} />
  </group>
);

const Face: React.FC<{
  eyes: number;
  look: [number, number];
  brow: number;
  browLift: number;
  mouth: number;
  happy: number;
  s: number;
}> = ({ eyes, look, brow, browLift, mouth, happy, s }) => {
  const z = TILE_T / 2 + 0.002;
  const white = flat("#FBFAF6", 0.25);
  const ink = flat("#0E1218", 0.35);
  const ey = 0.21;
  return (
    <group scale={[s, s, 1]}>
      {[-1, 1].map((side) => {
        const x = side * 0.17;
        return (
          <group key={side}>
            {happy < 0.5 ? (
              <>
                {/* outline ring makes the eye read on any glaze */}
                <mesh geometry={sphereGeo()} material={ink} position={[x, ey, z]} scale={[0.1, 0.11 * Math.max(0.08, eyes), 0.02]} />
                <mesh geometry={sphereGeo()} material={white} position={[x, ey, z + 0.006]} scale={[0.086, 0.096 * Math.max(0.06, eyes), 0.028]} />
                {eyes > 0.15 ? (
                  <>
                    <mesh
                      geometry={sphereGeo()}
                      material={ink}
                      position={[x + look[0] * 0.032, ey + look[1] * 0.03 * eyes, z + 0.03]}
                      scale={[0.043, 0.047 * eyes, 0.018]}
                    />
                    <mesh
                      geometry={sphereGeo()}
                      material={white}
                      position={[x + look[0] * 0.032 + 0.013, ey + look[1] * 0.03 * eyes + 0.016 * eyes, z + 0.047]}
                      scale={[0.012, 0.012 * eyes, 0.006]}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <mesh geometry={arcGeo()} material={ink} position={[x, ey - 0.03, z + 0.01]} scale={[0.07, 0.07, 0.05]} />
            )}
            <mesh
              geometry={roundedBox(0.15, 0.032, 0.02, 0.01)}
              material={ink}
              position={[x, ey + 0.135 + browLift, z + 0.012]}
              rotation={[0, 0, side * brow * 0.55]}
            />
          </group>
        );
      })}
      {mouth > 0.08 ? (
        <mesh geometry={arcGeo()} material={ink} position={[0, 0.06, z + 0.01]} rotation={[0, 0, Math.PI]} scale={[0.085, 0.07 * mouth, 0.05]} />
      ) : mouth < -0.08 ? (
        <mesh geometry={arcGeo()} material={ink} position={[0, -0.0, z + 0.01]} scale={[0.07, 0.05 * -mouth, 0.05]} />
      ) : (
        <mesh geometry={roundedBox(0.11, 0.024, 0.02, 0.01)} material={ink} position={[0, 0.03, z + 0.01]} />
      )}
    </group>
  );
};

export const TileCharacter: React.FC<TileCharProps> = ({
  position = [0, 0, 0],
  facing = 0,
  scale = 1,
  tex = "hero",
  faceRot = 0,
  tilt = 0,
  lift = 0,
  legs = 1,
  arms = 1,
  walk = 0,
  stride = 0,
  lean = 0,
  sway = 0,
  eyes = 1,
  face = 1,
  look = [0, 0],
  brow = 0,
  browLift = 0,
  mouth = 0,
  happy = 0,
  carry = "none",
  luggage = "#FF703D",
  armRaise = 0,
  wave = 0,
  grab = 0,
  shoes = "#151B23",
  shadowBlob = 0,
  squash = 0,
  castShadow = true,
}) => {
  const sw = Math.sin(walk);
  const bob = stride * 0.035 * Math.abs(Math.cos(walk));
  const legSwing = stride * 0.62 * sw;
  const armSwing = stride * 0.5 * sw;
  const legLen = Math.max(0.0001, LEG * legs);
  const pivotY = LEG * legs + lift + bob + tilt * (TILE_T / 2);
  const tiltAngle = (-tilt * Math.PI) / 2;
  const legMat = flat("#1A2029", 0.5);
  const shoeMat = flat(shoes, 0.45);

  const armPose = (side: number): V3 => {
    let ax = -side * armSwing;
    let az = side * 0.14;
    if (carry === "hand" && side === 1) {
      ax *= 0.35;
      az = 0.3;
    }
    if (carry === "trolley" && side === 1) {
      ax = 0.5;
      az = 0.24;
    }
    if (carry === "box") {
      ax = -1.3;
      az = side * 0.02;
    }
    if (carry === "sign" && side === 1) {
      ax = 0;
      az = 2.75 + Math.sin(wave) * 0.12;
    }
    if (side === 1 && armRaise > 0) {
      az = az + (2.5 - az) * armRaise + Math.sin(wave) * 0.4 * armRaise;
      ax = ax * (1 - armRaise);
    }
    if (side === -1 && armRaise > 0 && carry === "none") {
      // shrug: both arms up a bit
    }
    if (grab > 0) {
      ax = ax * (1 - grab) + -0.5 * grab;
      az = az + side * 0.55 * grab;
    }
    return [ax, 0, az];
  };

  const signAz = 2.75 + Math.sin(wave) * 0.12;
  const handSign: V3 = [0.53 + ARM * Math.sin(signAz), 0.06 - ARM * Math.cos(signAz), 0];

  return (
    <group position={position} rotation={[0, facing, 0]} scale={scale}>
      {shadowBlob > 0 ? <BlobShadow position={[0, 0.006, 0]} w={1.5} d={0.75} opacity={shadowBlob} /> : null}
      {legs > 0.02
        ? [-1, 1].map((side) => (
            <group key={side} position={[side * 0.2, pivotY, 0]} rotation={[side * legSwing, 0, 0]}>
              <mesh geometry={legGeo()} material={legMat} position={[0, -legLen / 2, 0]} scale={[1, legLen, 1]} castShadow={castShadow} />
              <mesh
                geometry={roundedBox(0.13, 0.075, 0.2, 0.034, 3)}
                material={shoeMat}
                position={[0, -legLen + 0.037, 0.035]}
                scale={Math.min(1, legs * 1.4)}
              />
            </group>
          ))
        : null}

      <group position={[0, pivotY, 0]} rotation={[tiltAngle + lean, 0, sway + stride * 0.045 * sw]}>
        <group position={[0, 0.5, 0]} scale={[1 + squash * 0.12, 1 - squash * 0.12, 1]}>
          <mesh geometry={roundedBox(1, 1, TILE_T, 0.024, 3)} material={BISCUIT()} castShadow={castShadow} receiveShadow />
          <mesh
            geometry={plane(0.962, 0.962)}
            material={ceramic(tex)}
            position={[0, 0, TILE_T / 2 + 0.0012]}
            rotation={[0, 0, faceRot]}
            receiveShadow
          />
          <mesh geometry={plane(0.962, 0.962)} material={ceramic("clay")} position={[0, 0, -TILE_T / 2 - 0.0012]} rotation={[0, Math.PI, 0]} />

          {face > 0.01 ? <Face eyes={eyes} look={look} brow={brow} browLift={browLift} mouth={mouth} happy={happy} s={face} /> : null}

          {arms > 0.01
            ? [-1, 1].map((side) => {
                const r = armPose(side);
                return (
                  <group key={side} position={[side * 0.53, 0.06, 0]} rotation={r} scale={arms}>
                    <mesh geometry={armGeo()} material={legMat} position={[0, -ARM / 2, 0]} scale={[1, ARM, 1]} />
                    <mesh geometry={sphereGeo()} material={legMat} position={[0, -ARM, 0]} scale={0.042} />
                    {carry === "hand" && side === 1 ? (
                      <Suitcase color={luggage} position={[0, -ARM - 0.155, 0]} rotation={[0, Math.PI / 2, 0]} />
                    ) : null}
                  </group>
                );
              })
            : null}

          {carry === "box" && arms > 0.5 ? <QuitBox position={[0, -0.12, 0.3]} /> : null}

          {carry === "sign" && arms > 0.5 ? (
            <group position={handSign} rotation={[0, 0, Math.sin(wave) * 0.12]}>
              <mesh geometry={cylGeo()} material={flat("#B88A5E", 0.7)} position={[0, 0.22, 0]} scale={[0.016, 0.6, 0.016]} castShadow />
              <mesh geometry={roundedBox(0.5, 0.4, 0.025, 0.01)} material={flat("#E4DDD1", 0.8)} position={[0, 0.6, 0]} castShadow />
              <mesh geometry={plane(0.46, 0.36)} material={ceramic("sign")} position={[0, 0.6, 0.014]} />
            </group>
          ) : null}
        </group>
      </group>

      {carry === "trolley" ? (
        <group position={[0.62, 0, -0.42]} rotation={[0.55, 0, 0]}>
          <Suitcase color={luggage} w={0.32} h={0.4} d={0.15} position={[0, 0.25, 0]} trolley={1} />
        </group>
      ) : null}
    </group>
  );
};
