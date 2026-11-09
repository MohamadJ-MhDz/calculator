import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { blink, E, kv, lerp, prog, V3 } from "../anim";
import { Cam, KeyLight, StudioEnv, DPR } from "../three/kit";
import { DigitalClock } from "../three/Apartment";
import { Suitcase, TileCharacter } from "../three/TileCharacter";
import { FilmGrain, Vignette } from "../ui/Overlays";
import { Apartment3 } from "./Scene05Transformation";
import { EndCard } from "./EndCard";

/**
 * SCENE 06 — THE ENDING (34–40 s)
 * Morning. The hero tile walks into the foreground, sets its suitcase down,
 * looks over the finished apartment and nods. Cut to the brand end card.
 */

export const END_CARD_LOCAL = 75;

const STOP: V3 = [1.0, 0, 1.55];

const heroPose = (f: number) => {
  const walkT = prog(f, 0, 34);
  const x = lerp(-1.45, STOP[0], E.outCubic(walkT));
  const walking = f < 32;
  const bend = Math.sin(prog(f, 34, 14) * Math.PI);
  const turn = E.inOutCubic(prog(f, 45, 9));
  const facing = lerp(Math.PI / 2, -2.25, turn);
  const nod = Math.max(0, Math.sin(prog(f, 58, 8) * Math.PI)) + Math.max(0, Math.sin(prog(f, 66, 8) * Math.PI));
  const lookSweep: [number, number] = f < 56 ? [0, 0] : f < 62 ? [-0.8, 0.3] : f < 68 ? [0.7, 0.35] : [0, 0.1];
  return {
    position: [x, 0, STOP[2]] as V3,
    facing,
    walk: x * 13,
    stride: walking ? 1 : 0,
    lean: bend * 0.45 + nod * 0.22,
    grab: bend * 0.9,
    carry: f < 44 ? ("hand" as const) : ("none" as const),
    happy: f >= 64 ? 1 : 0,
    mouth: f >= 52 ? 1 : 0.4,
    brow: f >= 52 ? -0.1 : 0.1,
    browLift: f >= 56 ? 0.05 : 0,
    eyes: blink(f, [20, 54]),
    look: lookSweep,
  };
};

const ShotCams = (f: number) => {
  if (f < 45) {
    return {
      pos: kv(f, [0, 45], [[5.5, 1.08, 2.1], [4.85, 0.95, 1.95]], E.inOutSine),
      target: [0.2, 0.68, 1.35] as V3,
      fov: 35,
    };
  }
  // reverse angle from inside the room: we are what the hero is looking at
  return {
    pos: kv(f, [45, 75], [[-1.55, 0.78, -0.75], [-1.3, 0.8, -0.5]], E.inOutSine),
    target: [0.95, 0.72, 1.5] as V3,
    fov: 40,
  };
};

const Final: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hero = heroPose(f);
  const cam = ShotCams(f);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #F7EBDD 0%, #F2DCC6 60%, #EAD3BE 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 85% 15%, rgba(255,170,110,0.45), rgba(0,0,0,0) 70%)" }} />
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95 }}>
        <fog attach="fog" args={["#EAD3BE", 20, 50]} />
        <StudioEnv intensity={0.45} />
        <ambientLight intensity={0.14} color="#FFF0E0" />
        <KeyLight position={[12, 7, 9]} target={[0, 0, 0]} intensity={2.5} color="#FFD3A8" extent={9} />
        <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#C7D4E8" />
        <Cam pos={cam.pos} target={cam.target} fov={cam.fov} />
        <Apartment3 merge={1} filled={() => true} heroFilled={false} sideRows={99} ground={1} />
        <DigitalClock text="07:30" colon={Math.floor(f / 15) % 2 === 0} position={[0.05, 0.5, 0.35]} rotation={[0, -0.6, 0]} scale={0.55} />
        <TileCharacter tex="hero" shoes={COLORS.orange} luggage={COLORS.orange} {...hero} />
        {f >= 44 ? <Suitcase color={COLORS.orange} position={[STOP[0] + 0.02, 0.12, STOP[2] - 0.62]} rotation={[0, Math.PI / 2 + 0.3, 0]} /> : null}
      </ThreeCanvas>
      <Vignette strength={0.28} />
      <FilmGrain opacity={0.05} />
    </AbsoluteFill>
  );
};

export const Scene06Ending: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Sequence name="Hero comes home" durationInFrames={END_CARD_LOCAL} premountFor={fps}>
        <Final />
      </Sequence>
      <Sequence name="End card" from={END_CARD_LOCAL} premountFor={fps}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
