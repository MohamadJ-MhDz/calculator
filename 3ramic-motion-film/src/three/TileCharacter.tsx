import React from "react";
import * as THREE from "three";
import { BISCUIT, ceramic, flat, plane, roundedBox, BlobShadow } from "./kit";
import type { TexKey } from "./textures";
import type { V3 } from "../anim";
import { Letter3D } from "./Props";

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

export type Carry = "none" | "letter";

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
  armRaise?: number;
  wave?: number;
  grab?: number;
  shoes?: string;
  shadowBlob?: number;
  squash?: number;
  castShadow?: boolean;
  /** Rolls the tile on its edges like a square wheel (radians, about the face normal). Use with legs = 0. */
  roll?: number;
  /** 0..1 — both arms thrown up in a V (victory). */
  cheer?: number;
  /** 0..1 — left arm brought up in front of the face (checking an imaginary watch). */
  watch?: number;
  /** Impatient foot tap: forward swing of the right leg (radians). */
  tap?: number;
  /** Speech: jaw opening 0..1 and lip rounding 0..1 from the lip-sync track. */
  jaw?: number;
  lipRound?: number;
  /** A small necktie — this tile has a job. */
  tie?: boolean;
  /** 0..1 — arms folded across the front. */
  crossed?: number;
};


const Face: React.FC<{
  eyes: number;
  look: [number, number];
  brow: number;
  browLift: number;
  mouth: number;
  happy: number;
  s: number;
  jaw: number;
  lipRound: number;
}> = ({ eyes, look, brow, browLift, mouth, happy, s, jaw, lipRound }) => {
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
      {jaw > 0.05 ? (
        // talking: an open mouth whose height follows the jaw and whose width narrows for rounded vowels
        <group position={[0, 0.035 - jaw * 0.02, z + 0.012]}>
          <mesh geometry={sphereGeo()} material={ink} scale={[0.105 - lipRound * 0.045, 0.02 + jaw * 0.085, 0.02]} />
          {jaw > 0.4 ? (
            <mesh geometry={sphereGeo()} material={flat("#B8493F", 0.6)} position={[0, -(0.02 + jaw * 0.085) * 0.5, 0.012]} scale={[0.06 - lipRound * 0.02, (0.02 + jaw * 0.085) * 0.38, 0.012]} />
          ) : null}
        </group>
      ) : mouth > 0.08 ? (
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
  tex = "gloss",
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
  armRaise = 0,
  wave = 0,
  grab = 0,
  shoes = "#151B23",
  shadowBlob = 0,
  squash = 0,
  castShadow = true,
  roll = 0,
  cheer = 0,
  watch = 0,
  tap = 0,
  jaw = 0,
  lipRound = 0,
  tie = false,
  crossed = 0,
}) => {
  const sw = Math.sin(walk);
  const bob = stride * 0.035 * Math.abs(Math.cos(walk));
  const legSwing = stride * 0.62 * sw;
  const armSwing = stride * 0.5 * sw;
  const legLen = Math.max(0.0001, LEG * legs);
  // a square rolling on its edges: the centre rides up and down on the half-diagonal
  const rollLift = roll ? 0.5 * (Math.abs(Math.cos(roll)) + Math.abs(Math.sin(roll)) - 1) : 0;
  const pivotY = LEG * legs + lift + bob + tilt * (TILE_T / 2) + rollLift;
  const tiltAngle = (-tilt * Math.PI) / 2;
  const legMat = flat("#1A2029", 0.5);
  const shoeMat = flat(shoes, 0.45);

  const armPose = (side: number): V3 => {
    let ax = -side * armSwing;
    let az = side * 0.14;
    if (side === 1 && armRaise > 0) {
      az = az + (2.5 - az) * armRaise + Math.sin(wave) * 0.4 * armRaise;
      ax = ax * (1 - armRaise);
    }
    if (side === -1 && watch > 0) {
      ax = ax * (1 - watch) + -1.15 * watch;
      az = az * (1 - watch) + 0.75 * watch;
    }
    if (cheer > 0) {
      const up = side * (2.45 + Math.sin(wave + side * 0.9) * 0.28);
      az = az * (1 - cheer) + up * cheer;
      ax = ax * (1 - cheer);
    }
    if (grab > 0) {
      ax = ax * (1 - grab) + -0.5 * grab;
      az = az + side * 0.55 * grab;
    }
    if (crossed > 0) {
      // both forearms laid across the front, one a little higher than the other
      ax = ax * (1 - crossed) + -0.32 * crossed;
      az = az * (1 - crossed) + side * (-1.85 + (side === 1 ? 0.16 : -0.1)) * crossed;
    }
    return [ax, 0, az];
  };

  return (
    <group position={position} rotation={[0, facing, 0]} scale={scale}>
      {shadowBlob > 0 ? <BlobShadow position={[0, 0.006, 0]} w={1.5} d={0.75} opacity={shadowBlob} /> : null}
      {legs > 0.02
        ? [-1, 1].map((side) => (
            <group key={side} position={[side * 0.2, pivotY, 0]} rotation={[side * legSwing - (side === 1 ? tap : 0), 0, 0]}>
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
        <group position={[0, 0.5, 0]} rotation={[0, 0, roll]} scale={[1 + squash * 0.12, 1 - squash * 0.12, 1]}>
          <mesh geometry={roundedBox(1, 1, TILE_T, 0.024, 3)} material={BISCUIT()} castShadow={castShadow} receiveShadow />
          <mesh
            geometry={plane(0.962, 0.962)}
            material={ceramic(tex)}
            position={[0, 0, TILE_T / 2 + 0.0012]}
            rotation={[0, 0, faceRot]}
            receiveShadow
          />
          <mesh geometry={plane(0.962, 0.962)} material={ceramic("clay")} position={[0, 0, -TILE_T / 2 - 0.0012]} rotation={[0, Math.PI, 0]} />

          {face > 0.01 ? <Face eyes={eyes} look={look} brow={brow} browLift={browLift} mouth={mouth} happy={happy} s={face} jaw={jaw} lipRound={lipRound} /> : null}
          {tie && face > 0.5 ? (
            <group position={[0, -0.2, TILE_T / 2 + 0.012]} rotation={[0, 0, sway * 0.6 + stride * 0.05 * sw]}>
              <mesh geometry={roundedBox(0.075, 0.05, 0.02, 0.008)} material={flat("#2B2F36", 0.6)} />
              <mesh geometry={roundedBox(0.085, 0.2, 0.016, 0.008)} material={flat("#2B2F36", 0.6)} position={[0, -0.125, 0]} />
              <mesh geometry={roundedBox(0.06, 0.06, 0.015, 0.006)} material={flat("#2B2F36", 0.6)} position={[0, -0.225, 0]} rotation={[0, 0, Math.PI / 4]} />
            </group>
          ) : null}

          {arms > 0.01
            ? [-1, 1].map((side) => {
                const r = armPose(side);
                return (
                  <group key={side} position={[side * 0.53, 0.06, 0]} rotation={r} scale={arms}>
                    <mesh geometry={armGeo()} material={legMat} position={[0, -ARM / 2, 0]} scale={[1, ARM, 1]} />
                    <mesh geometry={sphereGeo()} material={legMat} position={[0, -ARM, 0]} scale={0.042} />
                    {carry === "letter" && side === 1 ? <Letter3D position={[0.02, -ARM - 0.26, 0.03]} rotation={[0, 0, Math.PI]} scale={0.9} /> : null}
                  </group>
                );
              })
            : null}


        </group>
      </group>

    </group>
  );
};
