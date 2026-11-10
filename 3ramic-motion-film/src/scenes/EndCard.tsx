import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND, COLORS } from "../brand";
import { E, lerp, prog } from "../anim";
import { FilmGrain } from "../ui/Overlays";
import { Wordmark } from "../ui/Wordmark";
import { PERSIAN } from "../fonts";

/**
 * END CARD — a clean dark plate for the official 3ramic logo and the tagline.
 * Nothing else is on it. The logo itself comes from <Wordmark/> (see LOGO in src/brand.ts):
 * the official asset when one is set, plain neutral text otherwise.
 */
export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const tag = E.outCubic(prog(f, 36, 14));
  return (
    <AbsoluteFill style={{ background: COLORS.midnightDeep }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 55% at 50% 46%, ${COLORS.midnight} 0%, ${COLORS.midnightDeep} 100%)` }} />

      {/* logo slot */}
      <div style={{ position: "absolute", top: 620, left: 0, right: 0, height: 300, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Wordmark start={12} />
      </div>

      {/* thin burnt-orange rule */}
      <div style={{ position: "absolute", top: 962, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: lerp(0, 132, E.outCubic(prog(f, 26, 16))), height: 4, background: COLORS.orange }} />
      </div>

      {/* tagline — shaped by the browser's text engine, never split into letters */}
      <div
        dir="rtl"
        lang="fa"
        style={{
          position: "absolute",
          top: 1010,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: PERSIAN,
          fontWeight: 700,
          fontSize: 78,
          lineHeight: 1.5,
          color: COLORS.ivory,
          opacity: tag,
          translate: `0 ${(1 - tag) * 26}px`,
        }}
      >
        {BRAND.taglineFa}
      </div>
      <FilmGrain opacity={0.04} />
    </AbsoluteFill>
  );
};
