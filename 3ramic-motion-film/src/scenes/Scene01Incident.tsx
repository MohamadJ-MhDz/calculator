import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { blink, E, kf, kv, lerp, prog, shake, V3 } from "../anim";
import { Cam, StudioEnv, DPR } from "../three/kit";
import { ApartmentSet, buildFloor, NightLights } from "../three/Apartment";
import { Suitcase, TileCharacter, TILE_T } from "../three/TileCharacter";
import { CCTVHud, FilmGrain, Flash, SlamWord, Vignette } from "../ui/Overlays";
import { MONO, SERIF } from "../fonts";

/**
 * SCENE 01 — THE INCIDENT (0–5 s)
 * 03:17. A floor tile opens its eyes, pops out of the floor, grows legs,
 * catches a suitcase that pops out of its own hole like toast. Push-in.
 */

const HERO_POS: V3 = [0, 0, -2.0];

const heroPose = (f: number) => {
  const pop = E.outBack(prog(f, 36, 6), 2.2);
  const hinge = E.settle(prog(f, 42, 18), 2.6, 5);
  const legs = E.outElastic(prog(f, 46, 16));
  const land = prog(f, 52, 10);
  const squash = f >= 52 ? Math.sin(land * Math.PI) * 0.9 * (1 - land) : 0;
  const lift = f < 36 ? -TILE_T / 2 : f < 42 ? lerp(-TILE_T / 2, 0.32, pop) : lerp(0.32, 0, E.outCubic(prog(f, 42, 10)));
  const wobble = f >= 36 && f < 50 ? Math.sin((f - 36) * 1.9) * 0.12 * (1 - prog(f, 36, 14)) : 0;
  const look: [number, number] =
    f < 60 ? [0, 0] : f < 68 ? [-1, 0.15] : f < 76 ? [1, 0.15] : f < 86 ? [0.6, -0.3] : [0, 0.05];
  const grabbing = f >= 82 && f < 94;
  return {
    tilt: f < 42 ? 1 : 1 - hinge,
    lift,
    legs: f < 46 ? 0 : legs,
    arms: E.outBack(prog(f, 52, 8)),
    face: E.outBack(prog(f, 20, 8), 2.5),
    eyes: Math.min(kf(f, [22, 28], [0.05, 1]), blink(f, [33, 101, 128])),
    look,
    brow: kf(f, [62, 72], [0, 0.85]),
    mouth: kf(f, [62, 72], [0, -0.85]),
    sway: wobble,
    squash,
    armRaise: grabbing ? Math.sin(prog(f, 82, 12) * Math.PI) * 0.35 : 0,
    carry: f >= 92 ? ("hand" as const) : ("none" as const),
  };
};

export const Scene01Incident: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const floor = useMemo(() => buildFloor(), []);
  const hero = heroPose(f);

  // --- camera: CCTV with stepped digital zoom, then a dramatic push-in
  const zoomStep = Math.floor(kf(f, [38, 56], [0, 4]));
  const cctvFov = 50 - zoomStep * 3.2;
  const cctvPos: V3 = [3.1, 5.6, 3.9];
  const cctvTarget: V3 = [-0.1, 0.25, -1.75];
  const push = E.inOutExpo(prog(f, 92, 32));
  const [sx, sy] = shake(f, 36, 12, 0.05);
  const closePos = kv(f, [124, 150], [[0.8, 0.5, 1.55], [0.62, 0.55, 1.05]], E.outCubic);
  const closeTarget: V3 = [0.14, 0.97, -2.0];
  const pos: V3 = [lerp(cctvPos[0], closePos[0], push) + sx, lerp(cctvPos[1], closePos[1], push) + sy, lerp(cctvPos[2], closePos[2], push)];
  const target: V3 = [lerp(cctvTarget[0], closeTarget[0], push), lerp(cctvTarget[1], closeTarget[1], push), lerp(cctvTarget[2], closeTarget[2], push)];
  const fov = lerp(cctvFov, 40, push);
  const roll = Math.sin(push * Math.PI) * -0.12;

  // --- suitcase pops out of the hole like toast, then flies into the hand
  const toast = E.outBack(prog(f, 72, 8), 2.5);
  const fly = E.inOutCubic(prog(f, 84, 8));
  const suitStart: V3 = [0, lerp(-0.25, 0.62, toast), -2.5];
  const suitEnd: V3 = [0.66, 0.42, -2.0];
  const suitPos: V3 = [lerp(suitStart[0], suitEnd[0], fly), lerp(suitStart[1], suitEnd[1], fly) + Math.sin(fly * Math.PI) * 0.35, lerp(suitStart[2], suitEnd[2], fly)];
  const suitRotY = lerp(0, Math.PI * 2.5, E.outCubic(prog(f, 72, 20)));

  // --- grade: CCTV mono -> cinematic colour
  const color = E.inOutCubic(prog(f, 94, 14));
  const hud = 1 - prog(f, 94, 10);
  const glitch = f >= 90 && f < 106 ? Math.sin(prog(f, 90, 16) * Math.PI) : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      <AbsoluteFill
        style={{
          filter: `saturate(${lerp(0.18, 1.05, color)}) contrast(${lerp(1.25, 1.05, color)}) brightness(${lerp(1.25, 1, color)})`,
        }}
      >
        <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true }}>
          <color attach="background" args={[COLORS.night]} />
          <fog attach="fog" args={[COLORS.night, 9, 22]} />
          <StudioEnv intensity={0.12} />
          <NightLights hall={0} clockGlow={1} moon={1} />
          <Cam pos={pos} target={target} fov={fov} roll={roll} />
          <ApartmentSet doorOpen={0} clockText={f < 16 ? "03:16" : "03:17"} colon={Math.floor(f / 15) % 2 === 0} />
          {floor.map((t) =>
            t.hero ? null : (
              <TileCharacter
                key={t.id}
                position={[t.x, 0, t.zc + 0.5]}
                tex={t.tex}
                faceRot={t.faceRot}
                tilt={1}
                lift={-TILE_T / 2}
                legs={0}
                arms={0}
                face={0}
              />
            ),
          )}
          <TileCharacter
            position={HERO_POS}
            tex="hero"
            shoes={COLORS.orange}
            luggage={COLORS.orange}
            tilt={hero.tilt}
            lift={hero.lift}
            legs={hero.legs}
            arms={hero.arms}
            face={hero.face}
            eyes={hero.eyes}
            look={hero.look}
            brow={hero.brow}
            mouth={hero.mouth}
            sway={hero.sway}
            squash={hero.squash}
            armRaise={hero.armRaise}
            carry={hero.carry}
          />
          {f >= 70 && f < 92 ? <Suitcase color={COLORS.orange} position={suitPos} rotation={[0, suitRotY, 0]} /> : null}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* CCTV look */}
      <AbsoluteFill style={{ background: "rgba(60,110,120,0.10)", mixBlendMode: "color", opacity: 1 - color }} />
      <CCTVHud opacity={hud} glitch={glitch} />
      {/* CCTV feed "boot" — static burst over the first frames (never a black frame) */}
      {f < 6 ? <FilmGrain opacity={0.55 * (1 - f / 6)} /> : null}
      <Flash at={36} dur={6} max={0.18} />
      <Flash at={100} dur={10} max={0.35} color={COLORS.ivory} />

      {/* kinetic type after the push-in */}
      <SlamWord text="03:17" start={104} dur={60} size={280} top={170} left={64} exit={false} />
      <SlamWord text="a.m." start={110} dur={60} size={110} top={300} left={830} font={SERIF} weight={400} italic color={COLORS.orange} letterSpacing="0" exit={false} />
      {f >= 112 ? (
        <div
          style={{
            position: "absolute",
            top: 456,
            left: 72,
            fontFamily: MONO,
            fontSize: 22,
            letterSpacing: "0.16em",
            color: COLORS.ivory,
            opacity: E.outCubic(prog(f, 112, 10)) * 0.8,
          }}
        >
          INCIDENT REPORT · FLOOR TILE B-03
        </div>
      ) : null}
      <Vignette strength={0.6} />
      <FilmGrain opacity={0.09} />
    </AbsoluteFill>
  );
};
