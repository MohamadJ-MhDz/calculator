import React from "react";
import { AbsoluteFill } from "remotion";
import { blink, E, lerp, prog, shake, V3 } from "../anim";
import { HOOK } from "../cues";
import { line, mouthOf, scene, useFilmFrame } from "../timeline";
import { SLOT_POS, TILE } from "../three/Bathroom";
import { Duck } from "../three/Duck";
import { Letter3D } from "../three/Props";
import { TileCharacter, TILE_T } from "../three/TileCharacter";
import { CaseStamp, PaperOnLens } from "../ui/Graphics";
import { FilmGrain, Flash, Vignette } from "../ui/Overlays";
import { CamSpec, faceTo, inFrontOf, mixCam, mixV, Stage } from "./stage";

/**
 * 1 · THE HOOK — «من دیگه اینجا کار نمی‌کنم!»
 * Frame 0: a floor tile springs out of its place, already shouting. On the last word it
 * throws its resignation letter straight at the lens. When the paper slides off the
 * glass, a rubber-duck detective is standing there: «چرا؟!» — «آخه این چه ترکیبیه؟!» —
 * and we finally look at the room. «خب… پرونده باز شد.»
 */

export const TILE_STAND: V3 = [SLOT_POS[0], 0, SLOT_POS[2] + 0.5];
export const DUCK_STAND: V3 = [-0.78, 0, 5.55];

const CAM_A0: CamSpec = { pos: [1.0, 0.7, 7.8], target: [0.5, 0.7, 4.0], fov: 40 };
const CAM_A1: CamSpec = { pos: [0.86, 0.8, 7.25], target: [0.5, 0.76, 4.0], fov: 40 };
const CAM_B: CamSpec = { pos: [-0.5, 0.92, 9.0], target: [-0.15, 0.76, 4.75], fov: 40 };
const CAM_C: CamSpec = { pos: [1.75, 2.75, 9.7], target: [-0.7, 3.5, -4], fov: 44 };
const CAM_D0: CamSpec = { pos: [-1.34, 0.58, 7.6], target: [-0.78, 0.86, 5.55], fov: 36 };
const CAM_D1: CamSpec = { pos: [-1.24, 0.66, 7.3], target: [-0.78, 0.88, 5.55], fov: 36 };

export const SceneHook: React.FC = () => {
  const f = useFilmFrame();
  const S = scene("hook");
  const L1 = line("L01");
  const L2 = line("L02");
  const L3 = line("L03");
  const L4 = line("L04");

  /* ---------------- camera ---------------- */
  let cam: CamSpec;
  if (f < HOOK.hit + 2) {
    cam = mixCam(CAM_A0, CAM_A1, E.outCubic(prog(f, HOOK.pop, HOOK.hit - HOOK.pop)));
    const [sx, sy] = shake(f, HOOK.pop, 10, 0.05);
    cam = { ...cam, pos: [cam.pos[0] + sx, cam.pos[1] + sy, cam.pos[2]] };
  } else if (f < HOOK.reveal) {
    cam = CAM_B;
  } else if (f < HOOK.close) {
    cam = mixCam(CAM_B, CAM_C, E.outExpo(prog(f, HOOK.reveal, 10)));
  } else {
    cam = mixCam(CAM_D0, CAM_D1, E.outCubic(prog(f, HOOK.close, 44)));
  }

  /* ---------------- the tile ---------------- */
  const d = f - HOOK.pop;
  const popUp = E.outBack(prog(d, 0, 4), 2.2);
  const hinge = E.settle(prog(d, 3, 13), 2.6, 5);
  const land = prog(d, 10, 8);
  const m1 = mouthOf("L01", f);
  const m3 = mouthOf("L03", f);
  const speak = m1.speaking ? m1 : m3;
  const hasLetter = f >= HOOK.letterOut && f < HOOK.throwAt + 2;
  const raise = E.outBack(prog(f, HOOK.letterOut, 7)) * (1 - E.inCubic(prog(f, HOOK.throwAt, 5)));
  const afterThrow = f >= HOOK.hit;
  const sulk = E.inOutCubic(prog(f, HOOK.hit + 2, 8)) * (1 - E.inOutCubic(prog(f, L3.from - 4, 6)));
  const rant = E.outBack(prog(f, L3.from - 1, 6)) * (1 - prog(f, HOOK.reveal - 1, 5));
  const toRoom = E.inOutCubic(prog(f, HOOK.reveal - 2, 8));
  const tileFacing = lerp(lerp(0, 0.6, sulk) + lerp(0, -0.42, E.inOutCubic(prog(f, L3.from - 4, 6))), Math.PI - 0.45, toRoom);

  /* ---------------- the letter in flight ---------------- */
  const flyT = prog(f, HOOK.throwAt + 2, HOOK.hit - HOOK.throwAt - 2);
  const flyFrom: V3 = [TILE_STAND[0] + 0.62, 1.32, TILE_STAND[2] + 0.1];
  const flyTo = inFrontOf(cam, 0.42);
  const letterPos = mixV(flyFrom, flyTo, E.inCubic(flyT));

  /* ---------------- the detective ---------------- */
  const duckOn = f >= HOOK.hit + 2;
  const m2 = mouthOf("L02", f);
  const m4 = mouthOf("L04", f);
  const dSpeak = m2.speaking ? m2 : m4;
  const inClose = f >= HOOK.close;
  const duckFacing = inClose
    ? faceTo(DUCK_STAND, CAM_D0.pos) + 0.28
    : lerp(0.38, Math.PI + 0.55, E.inOutCubic(prog(f, HOOK.reveal, 9)));
  const magnify = inClose ? E.outBack(prog(f, HOOK.close + 3, 9), 1.5) : 0;
  const startle = Math.sin(prog(f, L2.from - 1, 9) * Math.PI);

  return (
    <AbsoluteFill>
      <Stage cam={cam} warm={0} bath={{ f, slotEmpty: true }}>
        <TileCharacter
          position={TILE_STAND}
          scale={TILE}
          facing={tileFacing}
          tex="gloss"
          tie
          shoes="#2B2F36"
          tilt={d < 3 ? 1 : 1 - hinge}
          lift={d < 3 ? lerp(-TILE_T, 0.3, popUp) : lerp(0.3, 0, E.outCubic(prog(d, 3, 8)))}
          legs={d < 5 ? 0 : E.outElastic(prog(d, 5, 13))}
          arms={E.outBack(prog(d, 7, 7))}
          squash={d >= 10 ? Math.sin(land * Math.PI) * 0.8 * (1 - land) : 0}
          eyes={blink(f, [HOOK.hit + 14, L3.from + 22])}
          look={afterThrow && f < L3.from - 4 ? [-0.9, 0.05] : toRoom > 0.5 ? [0.3, 0.5] : [0, 0]}
          brow={lerp(0.95, 0.6, rant)}
          browLift={speak.energy * 0.03}
          mouth={-0.85}
          jaw={speak.open}
          lipRound={speak.round}
          lean={0.1 + speak.energy * 0.12 - sulk * 0.06}
          sway={Math.sin(f * 0.9) * 0.02 * (m1.speaking ? 1 : 0)}
          carry={hasLetter ? "letter" : "none"}
          armRaise={Math.max(raise, toRoom * 0.85)}
          wave={toRoom > 0.5 ? f * 0.35 : f * 1.25}
          crossed={sulk}
          cheer={rant * 0.85}
        />
        {f >= HOOK.throwAt + 2 && f < HOOK.hit ? (
          <Letter3D position={[letterPos[0], letterPos[1] + Math.sin(flyT * Math.PI) * 0.25, letterPos[2]]} rotation={[flyT * 5.2, flyT * 2.4, 0.3]} scale={lerp(1, 1.5, flyT)} />
        ) : null}
        {duckOn ? (
          <Duck
            position={DUCK_STAND}
            scale={0.8}
            facing={duckFacing}
            jaw={dSpeak.open}
            look={inClose ? [0.25, 0.1] : f < L3.from ? [0.85, 0.1] : [0.6, 0.45]}
            lid={inClose ? 0.3 : 0}
            brow={inClose ? 0.55 : -0.25 * startle}
            browLift={startle * 0.06}
            hatTip={startle * 0.45}
            bob={Math.sin(prog(f, HOOK.peel + 5, 9) * Math.PI) * 0.1}
            lean={inClose ? 0.06 : -0.1 * startle}
            tilt={inClose ? -0.09 : 0.05}
            headTurn={inClose ? 0 : toRoom < 0.5 ? 0.25 : 0}
            wingR={magnify * 0.72}
            magnifier={magnify}
            waddle={f * 0.5}
            waddleAmp={toRoom > 0 && toRoom < 1 ? 0.6 : 0}
          />
        ) : null}
      </Stage>
      <Vignette strength={0.42} />
      <Flash f={f} at={HOOK.hit} dur={5} max={0.35} />
      <PaperOnLens f={f} hit={HOOK.hit} peel={HOOK.peel} clear={HOOK.clear} />
      <CaseStamp f={f} from={HOOK.stamp} to={S.to} />
      <FilmGrain opacity={0.05} />
      {/* L2 is referenced so its timing is validated with the scene */}
      {L2.from < 0 || L1.from < 0 || L4.from < 0 ? null : null}
    </AbsoluteFill>
  );
};
