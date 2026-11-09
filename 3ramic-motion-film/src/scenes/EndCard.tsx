import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, COLORS } from "../brand";
import { blink, E, lerp, prog } from "../anim";
import { Cam, KeyLight, StudioEnv, DPR } from "../three/kit";
import { TileCharacter } from "../three/TileCharacter";
import { TexKey } from "../three/textures";
import { FilmGrain } from "../ui/Overlays";
import { Wordmark } from "../ui/Wordmark";
import { MONO, PERSIAN } from "../fonts";

/**
 * END CARD — every ceramic in its place. Nine tiles click into a grid; the hero
 * lands last in the centre, then winks. Wordmark is a typographic placeholder.
 */

const GRID: { tex: TexKey; order: number }[] = [
  { tex: "marble", order: 0 },
  { tex: "terrazzo", order: 3 },
  { tex: "travertine", order: 5 },
  { tex: "stone", order: 2 },
  { tex: "hero", order: 8 },
  { tex: "porcelain", order: 6 },
  { tex: "neutral", order: 4 },
  { tex: "travertine", order: 7 },
  { tex: "terrazzo", order: 1 },
];

const DROP0 = 4;
const STEP = 3.4;

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const heroLand = DROP0 + 8 * STEP + 10;
  const push = E.inOutSine(prog(f, 0, 105));
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 35% at 50% 33%, rgba(255,112,61,0.16), rgba(0,0,0,0) 70%)" }} />
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true }}>
        <StudioEnv intensity={0.6} />
        <ambientLight intensity={0.15} />
        <KeyLight position={[4, 10, 6]} intensity={2.2} color="#FFF4EA" extent={4} />
        <directionalLight position={[-6, 3, -4]} intensity={1.2} color={COLORS.orange} />
        <Cam pos={[0, lerp(13.5, 12.6, push), lerp(5.6, 5.0, push)]} target={[0, 0, 1.45]} fov={30} roll={lerp(-0.05, 0, push)} />
        {GRID.map((g, i) => {
          const x = (i % 3) - 1;
          const z = Math.floor(i / 3) - 1;
          const t0 = DROP0 + g.order * STEP;
          const p = prog(f, t0, 10);
          const drop = (1 - E.outCubic(p)) * 3.2;
          const settle = prog(f, t0 + 10, 8);
          const bounce = Math.sin(settle * Math.PI) * 0.05 * (1 - settle);
          const isHero = g.tex === "hero";
          if (f < t0) return null;
          return (
            <TileCharacter
              key={i}
              tex={g.tex}
              position={[x * 1.06, 0, z * 1.06 + 0.5]}
              faceRot={((i * 3) % 4) * (Math.PI / 2) * (isHero ? 0 : 1)}
              tilt={1}
              legs={0}
              arms={0}
              lift={drop + bounce}
              face={isHero ? E.outBack(prog(f, 70, 8), 2) : 0}
              eyes={isHero ? Math.min(blink(f, [80]), 1) : 1}
              happy={isHero && f >= 88 && f < 98 ? 1 : 0}
              mouth={1}
              brow={-0.1}
            />
          );
        })}
      </ThreeCanvas>
      {/* centre tile landing flash */}
      {f >= heroLand && f < heroLand + 10 ? (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 33%, rgba(255,112,61,${0.35 * (1 - prog(f, heroLand, 10))}), rgba(0,0,0,0) 40%)` }} />
      ) : null}

      <div style={{ position: "absolute", top: 1100, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Wordmark start={8} />
      </div>
      <div
        dir="rtl"
        lang="fa"
        style={{
          position: "absolute",
          top: 1395,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: PERSIAN,
          fontWeight: 700,
          fontSize: 76,
          color: COLORS.ivory,
          opacity: E.outCubic(prog(f, 45, 12)),
          translate: `0 ${(1 - E.outCubic(prog(f, 45, 12))) * 30}px`,
        }}
      >
        {BRAND.taglineFa}
      </div>
      <div style={{ position: "absolute", top: 1530, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: E.outCubic(prog(f, 56, 12)) }}>
        <div style={{ width: lerp(0, 120, E.outCubic(prog(f, 56, 14))), height: 4, background: COLORS.orange }} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 20,
          letterSpacing: "0.22em",
          color: COLORS.ivory,
          opacity: 0.55 * E.outCubic(prog(f, 62, 12)),
        }}
      >
        {BRAND.filmTitle} — A {BRAND.name.toUpperCase()} FILM
      </div>
      <FilmGrain opacity={0.06} />
    </AbsoluteFill>
  );
};
