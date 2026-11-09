import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../brand";
import { DISPLAY } from "../fonts";
import { E, prog } from "../anim";

/** Rubber-stamp slam: drops from scale 1.8 with a hard settle, ink texture via grain mask. */
export const Stamp: React.FC<{
  text: string;
  start: number;
  dur?: number;
  top?: number;
  rotate?: number;
  color?: string;
  size?: number;
  font?: string;
  dir?: "ltr" | "rtl";
}> = ({ text, start, dur = 40, top = 300, rotate = -6, color = COLORS.orange, size = 150, font = DISPLAY, dir = "ltr" }) => {
  const f = useCurrentFrame();
  if (f < start || f > start + dur) return null;
  const p = prog(f, start, 7);
  const scale = 1.8 - 0.8 * E.outBack(p, 1.4);
  const out = E.inCubic(prog(f, start + dur - 6, 6));
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div
        dir={dir}
        style={{
          rotate: `${rotate}deg`,
          scale: String(scale * (1 - out * 0.15)),
          opacity: Math.min(1, p * 3) * (1 - out),
          border: `10px solid ${color}`,
          borderRadius: 18,
          padding: "6px 34px 14px",
          fontFamily: font,
          fontWeight: 800,
          fontSize: size,
          letterSpacing: dir === "ltr" ? "-0.03em" : undefined,
          color,
          lineHeight: 1.05,
          boxShadow: `0 0 0 4px rgba(0,0,0,0.0), inset 0 0 0 4px rgba(0,0,0,0.0)`,
          mixBlendMode: "screen",
          textShadow: "0 2px 0 rgba(0,0,0,0.25)",
        }}
      >
        {text}
      </div>
    </div>
  );
};
