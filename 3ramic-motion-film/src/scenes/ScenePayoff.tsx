import React from "react";
import { AbsoluteFill } from "remotion";
import { blink, E, lerp, prog } from "../anim";
import { PAYOFF } from "../cues";
import { line, mouthOf, scene, useFilmFrame } from "../timeline";
import { TILE } from "../three/Bathroom";
import { Duck } from "../three/Duck";
import { TileCharacter } from "../three/TileCharacter";
import { FilmGrain, Vignette } from "../ui/Overlays";
import { DUCK_STAND, TILE_STAND } from "./cameras";
import { CamSpec, faceTo, mixCam, Stage } from "./stage";
import { finishedRoom, PatternInNiche } from "./room";

/**
 * 4 · THE PAYOFF — the tile reconsiders.
 *   «اوه… این دیگه یه چیز دیگه‌س!» — «خب، استعفاتو پس می‌گیری؟» — «با پاداش!»
 * The two-shot repeats the hook's framing on purpose: same two characters, same angle,
 * a different room behind them.
 */

// close on the tile, the new room behind it
const CAM_AWE0: CamSpec = { pos: [0.92, 0.66, 7.25], target: [0.5, 0.78, 4.0], fov: 36 };
const CAM_AWE1: CamSpec = { pos: [0.85, 0.7, 6.95], target: [0.5, 0.8, 4.0], fov: 36 };
// the hook's two-shot, now warm
const CAM_TWO0: CamSpec = { pos: [-0.55, 1.05, 10.0], target: [-0.22, 0.62, 4.8], fov: 42 };
const CAM_TWO1: CamSpec = { pos: [-0.52, 1.02, 9.7], target: [-0.22, 0.63, 4.8], fov: 42 };

export const ScenePayoff: React.FC = () => {
  const f = useFilmFrame();
  const S = scene("payoff");
  const P = PAYOFF;
  const L13 = line("L13");
  const L14 = line("L14");
  const L15 = line("L15");
  const two = f >= P.twoShot;

  const cam = two ? mixCam(CAM_TWO0, CAM_TWO1, E.inOutSine(prog(f, P.twoShot, S.to - P.twoShot))) : mixCam(CAM_AWE0, CAM_AWE1, E.inOutSine(prog(f, S.from, P.twoShot - S.from)));

  const m13 = mouthOf("L13", f);
  const m15 = mouthOf("L15", f);
  const m14 = mouthOf("L14", f);
  const tileSpeak = m13.speaking ? m13 : m15;

  // the tile turns from the room to camera in awe, then to the detective
  const awe = E.outBack(prog(f, L13.from - 3, 8), 1.6);
  const toDuck = E.inOutCubic(prog(f, P.twoShot - 2, 8));
  const tileFacing = lerp(0.15, faceTo(TILE_STAND, DUCK_STAND) * 0.5, toDuck);
  const cross = E.outBack(prog(f, P.cross, 7), 1.5);
  const think = Math.sin(prog(f, P.think, P.cross - P.think) * Math.PI);
  const deadpan = E.inOutCubic(prog(f, P.deadpan, 6));
  const letterUp = E.outBack(prog(f, P.letterUp, 7), 1.4) * (1 - E.inCubic(prog(f, P.deadpan + 2, 6)));

  return (
    <AbsoluteFill>
      <Stage cam={cam} warm={1} bath={finishedRoom(f)} boost={1.05}>
        <TileCharacter
          position={TILE_STAND}
          scale={TILE}
          facing={tileFacing}
          tex="gloss"
          tie
          shoes="#2B2F36"
          eyes={blink(f, [L13.to + 6, L14.to - 4])}
          look={two ? (f < P.cross ? [-0.7, 0.05] : [-0.2, 0.2]) : [lerp(0.4, 0, awe), 0.35]}
          brow={two ? (f >= P.cross ? 0.55 : -0.2 - think * 0.3) : -0.45}
          browLift={two ? think * 0.05 : awe * 0.06}
          mouth={two ? (f >= P.cross ? -0.1 : 0.3) : 0.8}
          jaw={tileSpeak.open}
          lipRound={tileSpeak.round}
          lean={two ? (f >= P.cross ? -0.1 : 0.0) : -0.12 * awe + m13.energy * 0.04}
          armRaise={two ? 0 : awe * 0.55}
          wave={f * 0.2}
          cheer={two ? 0 : awe * 0.35}
          crossed={cross}
          squash={f >= P.cross ? Math.sin(prog(f, P.cross + 3, 6) * Math.PI) * 0.25 : 0}
        />
        {two ? (
          <Duck
            position={DUCK_STAND}
            scale={0.8}
            facing={deadpan > 0.5 ? faceTo(DUCK_STAND, cam.pos) : faceTo(DUCK_STAND, TILE_STAND) - 0.35}
            headTurn={deadpan > 0.5 ? 0 : 0.2}
            jaw={m14.open}
            look={deadpan > 0.5 ? [0, 0] : [0.7, 0.05]}
            lid={lerp(0.2, 0.48, deadpan)}
            brow={lerp(0.35, 0.65, deadpan)}
            browLift={think * 0.04}
            wingL={letterUp * 0.85}
            letter={letterUp > 0.05}
            lean={m14.energy * 0.04}
            tilt={deadpan > 0.5 ? 0 : -0.1}
            bob={Math.sin(prog(f, P.squeak, 8) * Math.PI) * 0.06}
          />
        ) : null}
        <PatternInNiche f={f} />
      </Stage>
      <Vignette strength={0.28} />
      <FilmGrain opacity={0.045} />
      {L15.from < 0 ? null : null}
    </AbsoluteFill>
  );
};
