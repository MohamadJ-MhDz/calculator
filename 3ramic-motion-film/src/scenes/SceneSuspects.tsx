import React from "react";
import { AbsoluteFill } from "remotion";
import { blink, clamp, E, lerp, prog, shake, V3 } from "../anim";
import { SUSPECTS } from "../cues";
import { line, mouthOf, scene, useFilmFrame } from "../timeline";
import { TILE } from "../three/Bathroom";
import { Duck } from "../three/Duck";
import { TileCharacter } from "../three/TileCharacter";
import { SuspectTag } from "../ui/Graphics";
import { FilmGrain, Flash, Vignette } from "../ui/Overlays";
import { CamSpec, faceTo, inFrontOf, mixCam, mixV, Stage } from "./stage";

/**
 * 2 · THE SUSPECTS — three design problems, each one a character.
 *   1  the loud pattern      «من فقط می‌خواستم دیده بشم!» — «خب، زیادی دیده شدی!»
 *   2  the black grout       «شیش متر جا… هزار تیکه؟!»
 *   3  the oversized vanity  «این‌جا بدون من هیچی نیست!» — «با تو هم که… جایی نمونده!»
 * Each gets a mugshot flash and a Persian tag, so the case reads with the sound off.
 */

/* ---- suspect 1: against the patterned left wall ---- */
export const PATTERN_HOLE: [number, number] = [7, 1]; // left-wall column and row it jumps out of
const P_WALL: V3 = [-3.92, 1.5, 1.5];
export const P_FLOOR: V3 = [-2.7, 0, 1.6];
const D1: V3 = [-1.3, 0, 2.6];
// the speaking pattern left of centre, the wall it left still in shot, the detective whole on the right
const CAM_1: CamSpec = { pos: [0.7, 1.1, 7.6], target: [-2.25, 0.85, 2.0], fov: 40 };
const CAM_1B: CamSpec = { pos: [0.56, 1.08, 7.25], target: [-2.25, 0.86, 2.0], fov: 40 };

/* ---- suspect 2: down at the grout ---- */
const D2: V3 = [1.25, 0, 1.95];
const CAM_2: CamSpec = { pos: [-0.9, 1.95, -0.35], target: [1.0, 0.45, 1.65], fov: 40 };
const CAM_2B: CamSpec = { pos: [-0.72, 1.8, -0.2], target: [1.0, 0.48, 1.65], fov: 40 };
const TWITCH_CENTRE: [number, number] = [3.9, 6.6];

/* ---- suspect 3: the vanity fills the frame ---- */
const D3: V3 = [-0.3, 0, -1.9];
const CAM_3: CamSpec = { pos: [-0.55, 2.35, 3.7], target: [-0.8, 2.05, -3.6], fov: 42 };
const CAM_3B: CamSpec = { pos: [-0.62, 2.3, 3.3], target: [-0.8, 2.05, -3.6], fov: 42 };

export const SceneSuspects: React.FC = () => {
  const f = useFilmFrame();
  const S = scene("suspects");
  const L5 = line("L05");
  const L6 = line("L06");
  const L7 = line("L07");
  const L8 = line("L08");
  const L9 = line("L09");
  const C = SUSPECTS;
  const shot = f < C.groutCut ? 1 : f < C.vanityCut ? 2 : 3;

  /* ---------------- camera ---------------- */
  let cam: CamSpec;
  if (shot === 1) cam = mixCam(CAM_1, CAM_1B, prog(f, S.from, C.groutCut - S.from));
  else if (shot === 2) cam = mixCam(CAM_2, CAM_2B, prog(f, C.groutCut, C.vanityCut - C.groutCut));
  else {
    cam = mixCam(CAM_3, CAM_3B, E.outCubic(prog(f, C.vanityCut, C.bump - C.vanityCut)));
    const [sx, sy] = shake(f, C.smack, 9, 0.07);
    cam = { ...cam, pos: [cam.pos[0] + sx, cam.pos[1] + sy, cam.pos[2]] };
  }

  /* ---------------- suspect 1: the patterned tile ---------------- */
  const pd = f - C.patternPop;
  const hop = E.outCubic(prog(pd, 2, 9));
  const pPos: V3 = [lerp(P_WALL[0], P_FLOOR[0], hop), lerp(P_WALL[1] - 0.47, 0, E.inCubic(prog(pd, 4, 7))) + Math.sin(prog(pd, 2, 9) * Math.PI) * 0.5, lerp(P_WALL[2], P_FLOOR[2], hop)];
  const pLand = prog(pd, 11, 8);
  const m5 = mouthOf("L05", f);
  const hurt = E.inOutCubic(prog(f, L6.from + 6, 8)); // the detective's reply lands
  const pFacing = lerp(Math.PI / 2, faceTo(P_FLOOR, CAM_1.pos) - 0.12, E.inOutCubic(prog(pd, 3, 9)));

  /* ---------------- the detective ---------------- */
  const m6 = mouthOf("L06", f);
  const m7 = mouthOf("L07", f);
  const m9 = mouthOf("L09", f);
  const shades = E.outBack(prog(f, C.shades, 6), 1.4);
  const flinch = Math.sin(prog(f, C.patternPop + 2, 12) * Math.PI);

  // suspect 3: bumped by the drawer, flat against the lens, then peels off
  const bumpT = prog(f, C.bump + 2, C.smack - C.bump - 2);
  const onLens = f >= C.smack;
  const lensAt = inFrontOf(cam, 1.02, 0, -0.62);
  const slide = onLens ? (f - C.smack) * 0.0035 : 0;
  const peel = E.inCubic(prog(f, C.peel, 9));
  const duck3Pos: V3 = !onLens
    ? mixV(D3, [lensAt[0], lensAt[1] + 0.25, lensAt[2]], E.inCubic(bumpT))
    : [lensAt[0], lensAt[1] - slide - peel * 2.4, lensAt[2] + peel * 0.5];
  const toCam = faceTo(duck3Pos, cam.pos);
  const duck3Facing = lerp(Math.PI - 0.5, toCam, clamp(bumpT * 1.6));
  const squashAmt = onLens ? 1 - peel : 0;
  const smackPop = onLens ? Math.sin(prog(f, C.smack, 6) * Math.PI) * 0.12 : 0;

  /* ---------------- suspect 3: the vanity ---------------- */
  const m8 = mouthOf("L08", f);
  const vOn = shot === 3 ? E.outBack(prog(f, C.vanityCut + 2, 8), 2) : 0;
  const drawer = shot === 3 ? E.outBack(prog(f, C.bump, 5), 2.2) * (1 - E.inOutCubic(prog(f, C.smack + 10, 16)) * 0.75) + m8.energy * 0.12 : 0;

  return (
    <AbsoluteFill>
      <Stage
        cam={cam}
        warm={0}
        bath={{
          f,
          slotEmpty: true,
          wallHole: PATTERN_HOLE,
          floorTwitch: shot === 2 ? f - C.twitch : -1,
          twitchCentre: TWITCH_CENTRE,
          vanityFace: {
            on: vOn,
            open: m8.open,
            drawer,
            brow: 0.85 - (f >= C.smack ? 0.5 : 0),
            look: f >= C.smack ? [0, -0.3] : [0.1, -0.5],
            eyes: blink(f, [C.vanityCut + 14, L8.to + 12]),
          },
        }}
      >
        {/* suspect 1 */}
        {shot === 1 ? (
          <>
            <TileCharacter
              position={pPos}
              scale={TILE}
              facing={pFacing}
              tex="busy"
              tilt={0}
              legs={pd < 3 ? 0 : E.outElastic(prog(pd, 3, 12))}
              arms={E.outBack(prog(pd, 6, 7))}
              squash={pd >= 11 ? Math.sin(pLand * Math.PI) * 0.7 * (1 - pLand) : 0}
              eyes={blink(f, [L5.to + 4, L6.from + 16])}
              look={hurt > 0.5 ? [-0.7, -0.2] : [0.1, 0.25]}
              brow={-0.55}
              browLift={0.03 + m5.energy * 0.03}
              mouth={hurt > 0.5 ? -0.9 : -0.3}
              jaw={m5.open}
              lipRound={m5.round}
              lean={-0.12 + m5.energy * 0.05 + hurt * 0.2}
              sway={Math.sin(f * 0.45) * 0.03 * (m5.speaking ? 1 : 0)}
              armRaise={(m5.speaking ? 0.9 : 0.25) * (1 - hurt)}
              wave={f * 0.33}
            />
            <Duck
              position={D1}
              scale={0.8}
              facing={faceTo(D1, CAM_1.pos) - 0.5}
              headTurn={lerp(-0.75, -0.15, E.inOutCubic(prog(f, L6.from - 2, 8)))}
              jaw={m6.open}
              look={shades > 0.5 ? [0, 0] : [-0.8, 0.1]}
              lid={0.1 + flinch * 0.5}
              brow={0.35}
              lean={-0.16 * flinch + m6.energy * 0.03}
              wingL={flinch * 0.8}
              shades={shades}
              tilt={shades > 0.5 ? -0.07 : 0.04}
            />
          </>
        ) : null}

        {/* suspect 2 */}
        {shot === 2 ? (
          <Duck
            position={D2}
            scale={0.8}
            facing={faceTo(D2, CAM_2.pos) + 0.1}
            jaw={m7.open}
            look={f >= C.twitch ? [0, 0.15] : [-0.2, -0.85]}
            lid={f >= C.twitch ? 0 : 0.22}
            brow={f >= C.twitch ? -0.35 : 0.45}
            browLift={f >= C.twitch ? 0.06 : 0}
            lean={lerp(0.34, 0.12, E.outBack(prog(f, C.twitch, 7)))}
            wingR={0.62}
            magnifier={E.outBack(prog(f, C.groutCut, 7), 1.4)}
            bob={Math.sin(prog(f, C.twitch, 9) * Math.PI) * 0.12}
            tilt={0.06}
          />
        ) : null}

        {/* suspect 3 */}
        {shot === 3 && f < C.peel + 10 ? (
          <Duck
            position={duck3Pos}
            scale={0.8}
            facing={duck3Facing}
            headTurn={f < C.bump ? 0.7 : 0}
            jaw={m9.open}
            look={onLens ? [0.1, 0.5] : [0.4, 0.5]}
            lid={onLens ? 0.42 : 0.3}
            brow={onLens ? 0.2 : 0.5}
            tilt={onLens ? 0.14 : -0.05}
            hatTip={onLens ? 0.22 : 0}
            wingL={onLens ? 0.55 : 0}
            wingR={onLens ? 0.6 : 0}
            squash={[1 + squashAmt * 0.22 + smackPop, 1 + squashAmt * 0.12 + smackPop, 1 - squashAmt * 0.68]}
          />
        ) : null}
      </Stage>
      <Vignette strength={0.42} />
      {/* a mugshot flash for each suspect */}
      <Flash f={f} at={C.tag1} dur={5} max={0.5} />
      <Flash f={f} at={C.tag2} dur={5} max={0.5} />
      <Flash f={f} at={C.tag3} dur={5} max={0.5} />
      <Flash f={f} at={C.smack} dur={4} max={0.25} />
      <SuspectTag f={f} from={C.tag1} to={L6.from + 4} n="۱" label="طرحِ شلوغ" />
      <SuspectTag f={f} from={C.tag2} to={L7.to + 2} n="۲" label="بندکشیِ مشکی" />
      <SuspectTag f={f} from={C.tag3} to={C.bump + 2} n="۳" label="روشوییِ غول‌پیکر" />
      <FilmGrain opacity={0.05} />
      {L9.from < 0 ? null : null}
    </AbsoluteFill>
  );
};
