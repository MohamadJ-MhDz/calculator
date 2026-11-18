import React from "react";
import { AbsoluteFill } from "remotion";
import { blink, clamp, E, lerp, prog } from "../anim";
import { BRAND_CUES } from "../cues";
import { line, scene, useFilmFrame } from "../timeline";
import { TILE } from "../three/Bathroom";
import { Duck } from "../three/Duck";
import { TileCharacter, TILE_T } from "../three/TileCharacter";
import { BrandLockup } from "../ui/Graphics";
import { FilmGrain, Vignette } from "../ui/Overlays";
import { DUCK_STAND, TILE_STAND } from "./cameras";
import { finishedRoom, PatternInNiche } from "./room";
import { CamSpec, faceTo, mixCam, Stage } from "./stage";

/**
 * 5 · BRAND CLOSE — «سه‌رامیک. هر سرامیکی، جای خودش.»
 * The finished room stays in view under the brand card. On «جای خودش» the tile lets
 * itself fall back into its own place in the floor — click — and the detective tips his hat.
 */

// the finished room under the brand card; the tile's own place and the whole detective in frame
const CAM_0: CamSpec = { pos: [0.2, 5.6, 13.8], target: [-0.2, 1.6, 0.9], fov: 40 };
const CAM_1: CamSpec = { pos: [0.15, 5.3, 13.0], target: [-0.15, 1.5, 1.0], fov: 40 };

export const SceneBrand: React.FC = () => {
  const f = useFilmFrame();
  const S = scene("brand");
  const B = BRAND_CUES;
  const L16 = line("L16");
  const cam = mixCam(CAM_0, CAM_1, E.inOutSine(prog(f, S.from, S.to - S.from)));

  // turn to camera, arms down, legs tuck, and a trust-fall backwards into the slot
  const turn = E.inOutCubic(prog(f, B.walk[0], B.walk[1] - B.walk[0]));
  const uncross = 1 - E.inOutCubic(prog(f, B.walk[0], 8));
  const fall = prog(f, B.lieDown[0], B.lieDown[1] - B.lieDown[0]);
  const fallE = E.inCubic(fall);
  const settle = E.settle(prog(f, B.click, 10), 3, 6);
  const flat = f >= B.click;
  const tuck = E.inOutCubic(prog(f, B.lieDown[0] - 6, 8));
  const content = E.inOutCubic(prog(f, B.click + 8, 8));
  const facing = lerp(faceTo(TILE_STAND, DUCK_STAND) * 0.5, 0, turn);

  const hat = Math.sin(prog(f, B.hatTip, 22) * Math.PI);

  return (
    <AbsoluteFill>
      <Stage cam={cam} warm={1} bath={finishedRoom(f)}>
        <TileCharacter
          position={TILE_STAND}
          scale={TILE}
          facing={facing}
          tex="gloss"
          tie={!flat}
          shoes="#2B2F36"
          tilt={flat ? 1 : fallE}
          lift={flat ? -TILE_T * clamp(settle) : lerp(0, -TILE_T * 0.5, fallE)}
          legs={1 - tuck}
          arms={1 - tuck}
          crossed={uncross}
          eyes={content > 0.5 ? 1 : blink(f, [B.walk[0] + 10])}
          happy={content > 0.5 ? 1 : 0}
          look={flat ? [0, 0] : [0.1, 0.3]}
          brow={-0.2}
          mouth={0.7}
          squash={flat ? Math.sin(clamp(settle) * Math.PI) * 0.15 * (1 - clamp(settle)) : 0}
        />
        <Duck
          position={DUCK_STAND}
          scale={0.8}
          facing={faceTo(DUCK_STAND, cam.pos) + lerp(-0.5, 0, E.inOutCubic(prog(f, B.click - 4, 10)))}
          look={f < B.click ? [0.6, 0.6] : [0, 0]}
          lid={0.2}
          brow={-0.1}
          hatTip={hat * 0.8}
          wingR={hat * 0.7}
          tilt={0.08 * hat}
          bob={Math.sin(prog(f, B.click, 8) * Math.PI) * 0.06}
        />
        <PatternInNiche f={f} />
      </Stage>
      <Vignette strength={0.26} />
      <BrandLockup f={f} nameAt={B.nameAt} taglineAt={B.taglineAt} ctaAt={B.ctaAt} />
      <FilmGrain opacity={0.04} />
      {L16.from < 0 ? null : null}
    </AbsoluteFill>
  );
};
