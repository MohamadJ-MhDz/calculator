import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { E, hash, prog } from "../anim";

/** Deterministic film grain (pre-baked noise tile, jittered per frame). */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame();
  const ox = Math.floor(hash(frame) * 256);
  const oy = Math.floor(hash(frame + 99) * 256);
  const tiles: React.ReactNode[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 6; x++) {
      tiles.push(
        <Img key={`${x}-${y}`} src={staticFile("textures/grain.png")} style={{ position: "absolute", left: x * 256, top: y * 256, width: 256, height: 256 }} />,
      );
    }
  }
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -ox, top: -oy, width: 6 * 256, height: 9 * 256 }}>{tiles}</div>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.35 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 78% 62% at 50% 46%, rgba(0,0,0,0) 55%, rgba(8,10,14,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Brief exposure flash on an impact. `at` is in the same frame space as `f`. */
export const Flash: React.FC<{ f: number; at: number; dur?: number; color?: string; max?: number }> = ({ f, at, dur = 6, color = "#fff", max = 0.4 }) => {
  if (f < at || f > at + dur) return null;
  return <AbsoluteFill style={{ background: color, opacity: max * (1 - E.outCubic(prog(f, at, dur))), pointerEvents: "none" }} />;
};
