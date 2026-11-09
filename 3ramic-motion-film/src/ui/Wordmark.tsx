import React from "react";
import { useCurrentFrame } from "remotion";
import { BRAND, COLORS } from "../brand";
import { DISPLAY } from "../fonts";
import { E, prog } from "../anim";

/**
 * TYPOGRAPHIC PLACEHOLDER — not a logo.
 * Sets the exact brand name "3ramic" in Bricolage Grotesque. Replace the contents
 * of this component with the official 3ramic logo (e.g. <Img src={staticFile("logo.svg")} />)
 * when it is supplied; every placement in the film uses this component.
 */
export const Wordmark: React.FC<{ start?: number; size?: number }> = ({ start = 0, size = 230 }) => {
  const f = useCurrentFrame();
  const chars = BRAND.name.split("");
  return (
    <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "-0.05em", lineHeight: 1, overflow: "hidden", paddingBottom: size * 0.12 }}>
      {chars.map((c, i) => {
        const p = E.outExpo(prog(f, start + i * 2, 14));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: i === 0 ? COLORS.orange : COLORS.ivory,
              translate: `0 ${(1 - p) * 110}%`,
              rotate: `${(1 - p) * 8}deg`,
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
};
