import React from "react";
import * as THREE from "three";
import { flat, roundedBox } from "./kit";
import { ART } from "../config/art";
import { Letter3D } from "./Props";
import type { V3 } from "../anim";

/**
 * THE DETECTIVE — a rubber duck in a fedora.
 * A bathroom native, about as tall as a floor tile on its legs. Its beak is driven by
 * the lip-sync track (jaw), and every other acting parameter is a plain number so the
 * performance is keyframed deterministically from the film frame.
 */

const gcache = new Map<string, THREE.BufferGeometry>();
const G = <T extends THREE.BufferGeometry>(id: string, make: () => T): T => {
  let g = gcache.get(id);
  if (!g) {
    g = make();
    gcache.set(id, g);
  }
  return g as T;
};
const sphere = () => G("s", () => new THREE.SphereGeometry(1, 28, 20));
const cyl = () => G("c", () => new THREE.CylinderGeometry(1, 1, 1, 32));
const cone = () => G("crown", () => new THREE.CylinderGeometry(0.86, 1, 1, 32));
const torus = () => G("t", () => new THREE.TorusGeometry(1, 0.22, 12, 32));
const ring = () => G("r", () => new THREE.TorusGeometry(1, 0.14, 10, 36));
const disc = () => G("d", () => new THREE.CircleGeometry(1, 32));

let lensMat: THREE.MeshPhysicalMaterial | null = null;
const lens = () => {
  if (!lensMat) lensMat = new THREE.MeshPhysicalMaterial({ color: "#DCEFF4", transparent: true, opacity: 0.28, roughness: 0.03, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  return lensMat;
};

export type DuckProps = {
  position?: V3;
  facing?: number;
  scale?: number;
  /** Beak opening 0..1 (from the lip-sync track). */
  jaw?: number;
  look?: [number, number];
  /** Upper eyelids: 0 wide open .. 1 shut. 0.45 is the deadpan look. */
  lid?: number;
  /** Eyebrow tilt: > 0 frowning/sceptical, < 0 worried. */
  brow?: number;
  browLift?: number;
  /** Wings: 0 at rest .. 1 raised forward. */
  wingL?: number;
  wingR?: number;
  /** Magnifying glass in the right wing: 0 put away .. 1 out. */
  magnifier?: number;
  /** Sunglasses dropping from under the hat brim: 0..1. */
  shades?: number;
  /** Hat lifted in greeting: 0..1. */
  hatTip?: number;
  /** Waddle phase (radians) and amount (0..1). */
  waddle?: number;
  waddleAmp?: number;
  /** Vertical hop. */
  bob?: number;
  /** Whole-body lean: forward (+) / back (−), radians. */
  lean?: number;
  /** Head cocked to one side, radians. */
  tilt?: number;
  /** Head turned left/right relative to the body, radians. */
  headTurn?: number;
  /** Non-uniform squash (x, y, z), e.g. flattened against the lens. */
  squash?: V3;
  /** Holds the resignation letter in the left wing. */
  letter?: boolean;
  castShadow?: boolean;
};

export const Duck: React.FC<DuckProps> = ({
  position = [0, 0, 0],
  facing = 0,
  scale = 1,
  jaw = 0,
  look = [0, 0],
  lid = 0,
  brow = 0,
  browLift = 0,
  wingL = 0,
  wingR = 0,
  magnifier = 0,
  shades = 0,
  hatTip = 0,
  waddle = 0,
  waddleAmp = 0,
  bob = 0,
  lean = 0,
  tilt = 0,
  headTurn = 0,
  squash = [1, 1, 1],
  letter = false,
  castShadow = true,
}) => {
  const body = flat(ART.duck.body, 0.36);
  const beak = flat(ART.duck.beak, 0.4);
  const ink = flat("#0E1014", 0.35);
  const white = flat("#FBFAF6", 0.25);
  const hat = flat(ART.duck.hat, 0.75);
  const band = flat(ART.duck.band, 0.5);
  const coat = flat(ART.duck.coat, 0.85);
  const metal = flat("#B9BEC4", 0.25, 0.9);

  const roll = Math.sin(waddle) * 0.13 * waddleAmp;
  const hop = Math.abs(Math.cos(waddle)) * 0.04 * waddleAmp;
  const eyeOpen = 1 - lid;

  return (
    <group position={position} rotation={[0, facing, 0]} scale={scale}>
      <group position={[0, bob + hop, 0]} rotation={[lean, 0, roll]} scale={squash}>
        {/* body + tail */}
        <mesh geometry={sphere()} material={body} position={[0, 0.43, -0.04]} scale={[0.5, 0.43, 0.6]} castShadow={castShadow} receiveShadow />
        <mesh geometry={sphere()} material={body} position={[0, 0.62, -0.56]} scale={[0.2, 0.2, 0.26]} rotation={[-0.7, 0, 0]} castShadow={castShadow} />
        {/* trench-coat collar */}
        <mesh geometry={torus()} material={coat} position={[0, 0.74, 0.08]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[0.31, 0.3, 0.3]} castShadow={castShadow} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={roundedBox(0.16, 0.24, 0.04, 0.015)} material={coat} position={[s * 0.13, 0.64, 0.42]} rotation={[0.35, 0, s * -0.45]} />
        ))}

        {/* wings */}
        {[-1, 1].map((s) => {
          const raise = s === 1 ? wingR : wingL;
          return (
            <group key={s} position={[s * 0.44, 0.62, 0.02]} rotation={[-raise * 1.35, 0, s * (0.12 + raise * 0.3)]}>
              <mesh geometry={sphere()} material={body} position={[s * 0.03, -0.2, 0]} scale={[0.09, 0.24, 0.27]} castShadow={castShadow} />
              {s === 1 && magnifier > 0.02 ? (
                <group position={[0.02, -0.44, 0.06]} rotation={[1.1, 0, 0]} scale={magnifier}>
                  <mesh geometry={cyl()} material={ink} position={[0, 0.02, 0]} scale={[0.03, 0.26, 0.03]} />
                  <mesh geometry={ring()} material={metal} position={[0, 0.34, 0]} scale={0.2} />
                  <mesh geometry={disc()} material={lens()} position={[0, 0.34, 0]} scale={0.19} />
                </group>
              ) : null}
              {s === -1 && letter ? <Letter3D position={[-0.02, -0.52, 0.12]} rotation={[0.9, 0.2, 0.1]} scale={0.9} /> : null}
            </group>
          );
        })}

        {/* head */}
        <group position={[0, 0.98, 0.16]} rotation={[0, headTurn, tilt]}>
          <mesh geometry={sphere()} material={body} scale={0.345} castShadow={castShadow} />
          {/* eyes */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.135, 0.07, 0.27]}>
              <mesh geometry={sphere()} material={ink} scale={[0.1, 0.108 * Math.max(0.1, eyeOpen), 0.05]} />
              <mesh geometry={sphere()} material={white} position={[0, 0, 0.012]} scale={[0.088, 0.096 * Math.max(0.08, eyeOpen), 0.055]} />
              {eyeOpen > 0.15 ? (
                <>
                  <mesh geometry={sphere()} material={ink} position={[look[0] * 0.034, look[1] * 0.032 * eyeOpen, 0.05]} scale={[0.046, 0.05 * Math.min(1, eyeOpen + 0.15), 0.03]} />
                  <mesh geometry={sphere()} material={white} position={[look[0] * 0.034 + 0.014, look[1] * 0.032 * eyeOpen + 0.018 * eyeOpen, 0.075]} scale={0.012} />
                </>
              ) : null}
              {/* upper lid */}
              {lid > 0.05 ? <mesh geometry={sphere()} material={body} position={[0, 0.108 * (1 - lid * 0.9), 0.03]} scale={[0.112, 0.108 * lid, 0.07]} /> : null}
              <mesh geometry={roundedBox(0.15, 0.03, 0.03, 0.012)} material={ink} position={[0, 0.15 + browLift, 0.03]} rotation={[0, 0, s * -brow * 0.6]} />
            </group>
          ))}
          {/* beak: the lower half is hinged and follows the speech */}
          <mesh geometry={sphere()} material={beak} position={[0, -0.055, 0.36]} scale={[0.19, 0.06, 0.2]} castShadow={castShadow} />
          {jaw > 0.03 ? <mesh geometry={sphere()} material={flat("#5A1C12", 0.6)} position={[0, -0.085 - jaw * 0.02, 0.33]} scale={[0.14, 0.025 + jaw * 0.05, 0.15]} /> : null}
          <group position={[0, -0.075, 0.2]} rotation={[jaw * 0.6, 0, 0]}>
            <mesh geometry={sphere()} material={beak} position={[0, -0.03, 0.15]} scale={[0.165, 0.042, 0.175]} />
          </group>
          {/* sunglasses that drop from under the brim */}
          {shades > 0.02 ? (
            <group position={[0, 0.07 + (1 - shades) * 0.19, 0.345]} scale={[1, Math.min(1, shades * 1.4), 1]}>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={disc()} material={ink} position={[s * 0.135, 0, 0]} scale={[0.125, 0.105, 1]} />
              ))}
              <mesh geometry={roundedBox(0.1, 0.025, 0.01, 0.005)} material={ink} position={[0, 0.03, 0]} />
            </group>
          ) : null}
          {/* fedora */}
          <group position={[0, 0.255 + hatTip * 0.28, -0.02]} rotation={[-0.14 - hatTip * 0.5, 0, 0.07]}>
            <mesh geometry={cyl()} material={hat} scale={[0.47, 0.03, 0.47]} castShadow={castShadow} />
            <mesh geometry={cone()} material={hat} position={[0, 0.15, 0]} scale={[0.29, 0.27, 0.29]} castShadow={castShadow} />
            <mesh geometry={cyl()} material={band} position={[0, 0.055, 0]} scale={[0.295, 0.07, 0.295]} />
          </group>
        </group>
      </group>
    </group>
  );
};
