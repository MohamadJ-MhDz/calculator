import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND, UI } from "../config/brand";
import { LATIN, PERSIAN, PERSIAN_DISPLAY } from "../fonts";
import { V3 } from "../anim";
import { TILE_STAND } from "../scenes/cameras";
import { CamSpec, faceTo, Stage } from "../scenes/stage";
import { TILE } from "../three/Bathroom";
import { Duck } from "../three/Duck";
import { TileCharacter } from "../three/TileCharacter";
import { FilmGrain, Vignette } from "../ui/Overlays";

/**
 * Instagram cover, 1080×1920. Everything that must be read sits inside the central 3:4
 * area (y 240–1680) that the profile grid shows; the full frame is what the Reels feed shows.
 */
const CAM: CamSpec = { pos: [0.25, 0.8, 9.2], target: [0.22, 1.05, 4.3], fov: 38 };
const DUCK_AT: V3 = [-0.32, 0, 4.85];

export const Cover: React.FC = () => (
  <AbsoluteFill>
    <Stage cam={CAM} warm={0} bath={{ f: 0, slotEmpty: true }} boost={1.08}>
      <TileCharacter
        position={TILE_STAND}
        scale={TILE}
        facing={faceTo(TILE_STAND, CAM.pos) - 0.2}
        tex="gloss"
        tie
        shoes="#2B2F36"
        eyes={1}
        look={[0, 0.1]}
        brow={0.95}
        browLift={0.03}
        mouth={-0.85}
        jaw={0.8}
        lipRound={0.1}
        lean={0.14}
        carry="letter"
        armRaise={0.85}
        wave={1.2}
      />
      <Duck position={DUCK_AT} scale={0.8} facing={faceTo(DUCK_AT, CAM.pos) + 0.67} headTurn={0.25} look={[0.8, 0.12]} lid={0.28} brow={0.55} browLift={0.04} wingR={0.72} magnifier={1} tilt={-0.08} />
    </Stage>
    <Vignette strength={0.45} />
    {/* title — inside the 3:4 grid crop */}
    <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div dir="rtl" lang="fa" style={{ background: UI.paper, color: UI.onPaper, borderRadius: 30, padding: "18px 54px 34px", boxShadow: "0 24px 60px rgba(0,0,0,0.35)", textAlign: "center" }}>
        <div style={{ fontFamily: PERSIAN, fontWeight: 800, fontSize: 52, opacity: 0.75 }}>پروندهٔ</div>
        <div style={{ fontFamily: PERSIAN_DISPLAY, fontSize: 112, lineHeight: 1.2, whiteSpace: "nowrap" }}>استعفای سرامیک‌ها</div>
      </div>
    </div>
    <div style={{ position: "absolute", top: 1560, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div dir="ltr" style={{ fontFamily: LATIN, fontWeight: 800, fontSize: 46, color: UI.onSurface, background: UI.surface, borderRadius: 50, padding: "8px 36px 12px" }}>{BRAND.name}</div>
    </div>
    <FilmGrain opacity={0.04} />
  </AbsoluteFill>
);
