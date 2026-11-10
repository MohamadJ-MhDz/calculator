import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, END_CARD_AT, SCENES } from "../brand";
import { blink, E, lerp, prog, V3 } from "../anim";
import { Cam, flat, KeyLight, plane, StudioEnv, DPR } from "../three/kit";
import { Suitcase, TileCharacter } from "../three/TileCharacter";
import { FilmGrain, Vignette } from "../ui/Overlays";
import { Apartment3 } from "./Scene05Transformation";
import { EndCard } from "./EndCard";
import { STUDIO_FLOOR_Y } from "./sceneShared";

/**
 * SCENE 06 — THE ENDING (34–40 s)
 * One continuous shot. The hero tile walks toward the camera and sets its suitcase down.
 * Behind it the newly designed home lifts off the ground and tips up to face us, like a
 * floor plan presenting itself — every room visible at once. A small approving nod, then
 * the frame is re-tiled into the clean dark logo card.
 */

export const END_CARD_LOCAL = END_CARD_AT - SCENES.ending.from;

const X = 0.9;
const Z0 = 17.2; // far end of its walk
const Z1 = 19.6; // where it stops
const SET_DOWN = 36; // the suitcase leaves its hand
export const NOD_AT = 54;
const HOME_Z = -1.5;

const heroPose = (f: number, reveal: number) => {
  const z = lerp(Z0, Z1, E.outCubic(prog(f, 0, 28)));
  const walking = f < 26;
  const bend = Math.sin(prog(f, 28, 14) * Math.PI);
  const nod = Math.max(0, Math.sin(prog(f, NOD_AT, 9) * Math.PI));
  return {
    position: [X, STUDIO_FLOOR_Y, z] as V3,
    facing: 0.08,
    walk: z * 12,
    stride: walking ? 0.95 : 0,
    lean: bend * 0.45 + nod * 0.34,
    grab: bend * 0.9,
    carry: f < SET_DOWN ? ("hand" as const) : ("none" as const),
    happy: f >= NOD_AT + 5 ? 1 : 0,
    mouth: f >= 42 ? 1 : 0.3,
    brow: f >= 42 ? -0.12 : 0.1,
    browLift: f >= 46 ? 0.05 : 0,
    eyes: blink(f, [16, 47]),
    look: (f < 28 ? [0, 0.1] : f < 40 ? [0.6, -0.7] : [0.1, 0.2 * reveal]) as [number, number],
    squash: nod * 0.15,
  };
};

const mix = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const Final: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const reveal = E.inOutCubic(prog(f, 24, 34));
  const settle = Math.sin(prog(f, 58, 16) * Math.PI) * 0.03; // the home overshoots a touch, then rests
  const hero = heroPose(f, reveal);
  // low in front of the hero as it approaches … then back and up a little as the home rises behind it
  const pos = mix([X + 0.75, 0.15, Z1 + 5.2], [1.5, 0.55, Z1 + 6.4], reveal);
  const target = mix([X, 0.3, Z1], [0.45, 3.9, 1.0], reveal);
  const fov = lerp(36, 40, reveal);
  const ground = flat("#EADFD1", 0.9);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #F7EBDD 0%, #F2DCC6 60%, #EAD3BE 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 85% 15%, rgba(255,170,110,0.45), rgba(0,0,0,0) 70%)" }} />
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 0.95 }}>
        <fog attach="fog" args={["#EAD3BE", 34, 90]} />
        <StudioEnv intensity={0.45} />
        <ambientLight intensity={0.14} color="#FFF0E0" />
        <KeyLight position={[15, 18, 28]} target={[0, 4, 8]} intensity={2.5} color="#FFD3A8" extent={17} mapSize={4096} />
        <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#C7D4E8" />
        <Cam pos={pos} target={target} fov={fov} />
        <mesh geometry={plane(160, 160)} material={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, STUDIO_FLOOR_Y, 0]} receiveShadow />
        {/* the home: lifts off the ground and tips up to present every room at once */}
        <group position={[0.2, lerp(0, 7.3, reveal) + settle * 4, HOME_Z]} rotation={[lerp(0, 1.0, reveal) + settle, 0, 0]}>
          <Apartment3 merge={1} filled={() => true} sideRows={99} ground={0} />
        </group>
        <TileCharacter tex="hero" shoes={COLORS.orange} luggage={COLORS.orange} {...hero} />
        {f >= SET_DOWN ? <Suitcase color={COLORS.orange} position={[X + 0.66, STUDIO_FLOOR_Y + 0.12, Z1 + 0.12]} rotation={[0, Math.PI / 2 - 0.35, 0]} /> : null}
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
      <Sequence name="End card · logo slot + tagline" from={END_CARD_LOCAL} premountFor={fps}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
