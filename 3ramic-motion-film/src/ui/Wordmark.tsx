import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { BRAND, COLORS, LOGO } from "../brand";
import { DISPLAY } from "../fonts";
import { E, prog } from "../anim";

/**
 * LOGO SLOT — every brand-mark placement in the film goes through this component.
 *
 * - If `LOGO.file` (src/brand.ts) names a file in public/, that official asset is shown,
 *   untouched: no recolouring, no distortion, only a fade/settle reveal.
 * - Otherwise (no asset supplied) the exact brand name is set as plain neutral text.
 *   That text is a stand-in, not a logo, and is intentionally undesigned.
 */
export const Wordmark: React.FC<{ start?: number; size?: number }> = ({ start = 0, size = 150 }) => {
  const f = useCurrentFrame();
  const p = E.outExpo(prog(f, start, 18));
  const reveal: React.CSSProperties = {
    opacity: E.outCubic(prog(f, start, 10)),
    translate: `0 ${(1 - p) * 26}px`,
    scale: String(0.96 + 0.04 * p),
  };
  if (LOGO.file) {
    return <Img src={staticFile(LOGO.file)} style={{ width: LOGO.width, height: "auto", display: "block", ...reveal }} />;
  }
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "0",
        lineHeight: 1,
        color: COLORS.ivory,
        ...reveal,
      }}
    >
      {BRAND.name}
    </div>
  );
};
