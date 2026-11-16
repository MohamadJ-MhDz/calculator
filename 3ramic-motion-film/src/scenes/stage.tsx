import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ART } from "../config/art";
import { lerp, V3 } from "../anim";
import { Cam, DPR, StudioEnv } from "../three/kit";
import { BathLights, Bathroom, BathroomProps } from "../three/Bathroom";

/** One camera set-up. */
export type CamSpec = { pos: V3; target: V3; fov: number; roll?: number };

export const mixV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const mixCam = (a: CamSpec, b: CamSpec, t: number): CamSpec => ({
  pos: mixV(a.pos, b.pos, t),
  target: mixV(a.target, b.target, t),
  fov: lerp(a.fov, b.fov, t),
  roll: lerp(a.roll ?? 0, b.roll ?? 0, t),
});

/** Unit vector from the camera toward its target, and a point `dist` in front of the lens. */
export const inFrontOf = (cam: CamSpec, dist: number, right = 0, up = 0): V3 => {
  const d: V3 = [cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]];
  const n = Math.hypot(d[0], d[1], d[2]) || 1;
  const f: V3 = [d[0] / n, d[1] / n, d[2] / n];
  const r: V3 = [-f[2], 0, f[0]];
  const rn = Math.hypot(r[0], r[2]) || 1;
  return [cam.pos[0] + f[0] * dist + (r[0] / rn) * right, cam.pos[1] + f[1] * dist + up, cam.pos[2] + f[2] * dist + (r[2] / rn) * right];
};

/** Y rotation that makes a character at `from` face the point `to`. */
export const faceTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mixHex = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`;
};

/**
 * The set, lit, with one camera. A scene is one Stage whose camera changes per frame, so
 * a cut does not rebuild the WebGL scene.
 */
export const Stage: React.FC<{
  cam: CamSpec;
  /** 0 = the cold "before" light, 1 = warm. */
  warm: number;
  bath: BathroomProps;
  /** Extra brightness for close-ups. */
  boost?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ cam, warm, bath, boost = 1, style, children }) => {
  const { width, height } = useVideoConfig();
  const top = mixHex("#10151F", "#F6EDDF", warm);
  const bottom = mixHex(ART.backdropBefore, ART.backdropAfter, warm);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`, ...style }}>
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 1.0 }}>
        <StudioEnv intensity={lerp(0.32, 0.5, warm)} />
        <BathLights warm={warm} boost={boost} />
        <Cam pos={cam.pos} target={cam.target} fov={cam.fov} roll={cam.roll ?? 0} />
        <Bathroom {...bath} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
