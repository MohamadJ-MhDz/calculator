import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { blink, E, kf, kv, lerp, prog, shake, V3 } from "../anim";
import { Cam, StudioEnv, DPR } from "../three/kit";
import { ApartmentSet, buildFloor, FloorTile, NightLights } from "../three/Apartment";
import { Suitcase, TileCharacter, TILE_T } from "../three/TileCharacter";
import { CCTVHud, FilmGrain, Flash, SlamWord, Vignette } from "../ui/Overlays";
import { MONO, SERIF } from "../fonts";

/**
 * SCENE 01 — THE INCIDENT (0–5 s)
 * Overhead CCTV, 03:17. One floor tile opens its eyes, slowly lifts itself out of the
 * floor, grows two legs, picks up a tiny suitcase and heads for the door. Dramatic
 * push-in… then an abrupt cut back to the cold CCTV wide: the rest of the floor is waking up.
 */

/** The abrupt comedic cut (scene-local frame): close-up → locked-off CCTV wide. Music cuts here too. */
export const S1_CUT = 122;

const SPOT_Z = -2.0; // where the hero stands after hinging upright (front edge of its own hole)
const PICK_Z = -1.45; // where it picks the suitcase up
const SUIT_REST: V3 = [0.62, 0.12, -1.38];

/** Frame at which each remaining tile opens its eyes (ripples outward from the hero's hole). */
export const wakeAt = (t: FloorTile) => S1_CUT + 3 + Math.hypot(t.x, t.zc + 2.5) * 3.2;

const heroPose = (f: number) => {
  const cut = f >= S1_CUT;
  // slow lift straight out of the floor, trembling with effort
  const rise = E.inOutSine(prog(f, 26, 20));
  const hinge = E.settle(prog(f, 46, 18), 2.6, 5);
  const legs = E.outElastic(prog(f, 50, 16));
  const land = prog(f, 56, 10);
  const squash = f >= 56 ? Math.sin(land * Math.PI) * 0.9 * (1 - land) : 0;
  const lift = f < 46 ? lerp(-TILE_T / 2, 0.24, rise) : lerp(0.24, 0, E.outCubic(prog(f, 46, 10)));
  const tremble = f >= 26 && f < 46 ? Math.sin(f * 2.3) * 0.035 * (0.3 + rise) : 0;
  const wobble = f >= 46 && f < 60 ? Math.sin((f - 46) * 1.9) * 0.1 * (1 - prog(f, 46, 14)) : 0;

  // steps forward to the suitcase; after the cut it walks back toward the door
  const step = E.inOutSine(prog(f, 80, 10));
  const back = E.inOutSine(prog(f, S1_CUT + 5, 22));
  const z = cut ? lerp(PICK_Z, SPOT_Z, back) : lerp(SPOT_Z, PICK_Z, step);
  const walking = (f >= 80 && f < 90) || (cut && f >= S1_CUT + 5 && f < S1_CUT + 27);
  const facing = cut ? lerp(1.25, Math.PI, E.outCubic(prog(f, S1_CUT, 6))) : E.inCubic(prog(f, 114, 8)) * 0.9;

  const bend = Math.sin(prog(f, 88, 10) * Math.PI);
  const look: [number, number] =
    f < 60 ? [0, 0] : f < 65 ? [-1, 0.15] : f < 70 ? [1, 0.15] : f < 80 ? [0.3, 1] : f < 95 ? [0.6, -0.8] : [0, 0.05];
  return {
    position: [0, 0, z] as V3,
    facing,
    tilt: f < 46 ? 1 : 1 - hinge,
    lift,
    legs: f < 50 ? 0 : legs,
    arms: E.outBack(prog(f, 56, 8)),
    face: E.outBack(prog(f, 18, 8), 2.5),
    eyes: Math.min(kf(f, [20, 28], [0.05, 1]), blink(f, [40, 75, 109, 136])),
    look,
    brow: kf(f, [96, 104], [0, 0.85]),
    mouth: kf(f, [96, 104], [0, -0.85]),
    sway: wobble + tremble,
    squash,
    lean: bend * 0.45,
    grab: bend * 0.9,
    walk: z * 13,
    stride: walking ? 0.95 : 0,
    carry: f >= 93 ? ("hand" as const) : ("none" as const),
  };
};

export const Scene01Incident: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const floor = useMemo(() => buildFloor(), []);
  const hero = heroPose(f);
  const cut = f >= S1_CUT;

  // --- camera: CCTV with stepped digital zoom, a dramatic push-in, then the hard cut back
  const zoomStep = cut ? 0 : Math.floor(kf(f, [30, 48], [0, 4]));
  const cctvFov = 50 - zoomStep * 3.2;
  const cctvPos: V3 = [3.1, 5.6, 3.9];
  const cctvTarget: V3 = [-0.1, 0.25, -1.75];
  const push = cut ? 0 : E.inOutExpo(prog(f, 86, 28));
  const [sx, sy] = shake(f, 56, 10, 0.035);
  const closePos = kv(f, [114, S1_CUT], [[0.9, 0.42, 2.7], [0.82, 0.45, 2.45]], E.outCubic);
  const closeTarget: V3 = [0.14, 0.6, PICK_Z];
  const pos: V3 = [lerp(cctvPos[0], closePos[0], push) + sx, lerp(cctvPos[1], closePos[1], push) + sy, lerp(cctvPos[2], closePos[2], push)];
  const target: V3 = [lerp(cctvTarget[0], closeTarget[0], push), lerp(cctvTarget[1], closeTarget[1], push), lerp(cctvTarget[2], closeTarget[2], push)];
  const fov = lerp(cctvFov, 40, push);
  const roll = Math.sin(push * Math.PI) * -0.12;

  // --- the suitcase pops out of the tile's own hole like toast, sails over its head and lands in front of it
  const toast = E.outBack(prog(f, 62, 8), 2.5);
  const fly = E.inOutSine(prog(f, 70, 11));
  const bounce = f >= 81 ? Math.abs(Math.sin((f - 81) * 0.9)) * 0.12 * (1 - prog(f, 81, 8)) : 0;
  const suitFrom: V3 = [0, lerp(-0.25, 0.75, toast), -2.5];
  const suitPos: V3 = [
    lerp(suitFrom[0], SUIT_REST[0], fly),
    lerp(suitFrom[1], SUIT_REST[1], fly) + Math.sin(fly * Math.PI) * 1.3 + bounce,
    lerp(suitFrom[2], SUIT_REST[2], fly),
  ];
  const suitRotY = Math.PI / 2 + (1 - E.outCubic(prog(f, 62, 19))) * Math.PI * 2.5;
  const suitRotX = Math.sin(fly * Math.PI) * 1.2;

  // --- grade: CCTV mono -> cinematic colour -> (cut) back to cold CCTV
  const color = cut ? 0 : E.inOutCubic(prog(f, 90, 14));
  const hud = cut ? 1 : 1 - prog(f, 90, 10);
  const glitch = f >= 88 && f < 102 ? Math.sin(prog(f, 88, 14) * Math.PI) : f >= S1_CUT && f < S1_CUT + 5 ? 1 - prog(f, S1_CUT, 5) : 0;
  const awake = floor.filter((t) => !t.hero && !t.stuck && f >= wakeAt(t)).length;

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
          {floor.map((t) => {
            if (t.hero) return null;
            const t0 = wakeAt(t);
            const up = !t.stuck && f >= t0;
            const d = f - t0;
            return (
              <TileCharacter
                key={t.id}
                position={[t.x, 0, t.zc + 0.5]}
                tex={t.tex}
                faceRot={t.faceRot}
                scale={1}
                tilt={1}
                lift={-TILE_T / 2 + (up ? Math.max(0, Math.sin(d * 1.5 + t.id * 2.1)) * 0.045 : 0)}
                sway={up ? Math.sin(d * 1.5 + t.id) * 0.035 : 0}
                legs={0}
                arms={0}
                face={up ? E.outBack(prog(f, t0, 7), 2.4) : 0}
                eyes={up ? Math.min(kf(f, [t0 + 1, t0 + 6], [0.05, 1]), blink(f, [t0 + 14 + (t.id % 5)])) : 1}
                look={[Math.sin(f * 0.22 + t.id) * 0.7, 0.25]}
                brow={t.mood === "angry" ? 0.7 : t.mood === "tired" ? -0.4 : 0.3}
                mouth={-0.5}
              />
            );
          })}
          <TileCharacter tex="hero" shoes={COLORS.orange} luggage={COLORS.orange} {...hero} />
          {f >= 62 && f < 93 ? <Suitcase color={COLORS.orange} position={suitPos} rotation={[suitRotX, suitRotY, 0]} /> : null}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* CCTV look */}
      <AbsoluteFill style={{ background: "rgba(60,110,150,0.12)", mixBlendMode: "color", opacity: 1 - color }} />
      <CCTVHud opacity={hud} glitch={glitch} moving={cut ? awake + 1 : f > 26 ? 1 : 0} />
      {/* CCTV feed "boot" — static burst over the first frames (never a black frame) */}
      {f < 6 ? <FilmGrain opacity={0.55 * (1 - f / 6)} /> : null}
      <Flash at={56} dur={6} max={0.14} />
      <Flash at={96} dur={10} max={0.3} color={COLORS.ivory} />
      {/* the cut: one frame of white-hot feed, then cold CCTV again */}
      <Flash at={S1_CUT} dur={4} max={0.5} color="#DCE8FF" />

      {/* kinetic type after the push-in — killed by the cut */}
      {!cut ? (
        <>
          <SlamWord text="03:17" start={98} dur={60} size={280} top={170} left={64} exit={false} />
          <SlamWord text="a.m." start={104} dur={60} size={110} top={300} left={830} font={SERIF} weight={400} italic color={COLORS.orange} letterSpacing="0" exit={false} />
          {f >= 106 ? (
            <div
              style={{
                position: "absolute",
                top: 456,
                left: 72,
                fontFamily: MONO,
                fontSize: 22,
                letterSpacing: "0.16em",
                color: COLORS.ivory,
                opacity: E.outCubic(prog(f, 106, 8)) * 0.8,
              }}
            >
              INCIDENT REPORT · FLOOR TILE B-03
            </div>
          ) : null}
        </>
      ) : null}
      <Vignette strength={0.6} />
      <FilmGrain opacity={0.09} />
    </AbsoluteFill>
  );
};
