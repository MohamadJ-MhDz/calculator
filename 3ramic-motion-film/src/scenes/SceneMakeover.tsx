import React from "react";
import { AbsoluteFill } from "remotion";
import { blink, clamp, E, lerp, prog, V3 } from "../anim";
import { MAKEOVER } from "../cues";
import { hold, line, mouthOf, scene, useFilmFrame } from "../timeline";
import { BathroomProps, NICHE, TILE } from "../three/Bathroom";
import { Duck } from "../three/Duck";
import { Chip, SampleBox } from "../three/Props";
import { TileCharacter } from "../three/TileCharacter";
import { CompareOverlay } from "../ui/Graphics";
import { FilmGrain, Flash, Vignette } from "../ui/Overlays";
import { DUCK_STAND, MASTER, MASTER_IN, TILE_STAND } from "./cameras";
import { P_FLOOR, PATTERN_HOLE } from "./SceneSuspects";
import { CamSpec, faceTo, mixCam, mixV, Stage } from "./stage";

/**
 * 3 · THE MAKEOVER — the hero sequence.
 *   «متراژ که عوض نمی‌شه… انتخاب‌ها باید با هم جور باشن.»  — the diagnosis
 *   «کارِ سه‌رامیکه!»                                      — the solution provider
 * Then ONE locked camera on the same room: a sample box of coordinated choices opens and
 * the room changes in the order a viewer can follow — the vanity is hoisted out, the grout
 * is matched, the walls calm down, the shower opens up, a slimmer vanity drops in, the
 * light warms, and the loud pattern is kept as a small framed accent («حالا شد!»).
 * Finally a before/after wipe with the identical camera: same walls, same 6 m².
 */

// medium shot on the speaker: the detective large on the left in three-quarter view, the tile
// listening on the right, the badly matched room behind both; then a punch-in for the brand line
const CAM_TWO0: CamSpec = { pos: [-1.3, 1.15, 8.0], target: [-0.25, 0.55, 4.9], fov: 38 };
const CAM_TWO1: CamSpec = { pos: [-1.22, 1.12, 7.7], target: [-0.25, 0.56, 4.9], fov: 38 };
const CAM_CU0: CamSpec = { pos: [-1.55, 0.7, 8.2], target: [-0.8, 1.02, 5.55], fov: 34 };
const CAM_CU1: CamSpec = { pos: [-1.45, 0.74, 7.85], target: [-0.8, 1.04, 5.55], fov: 34 };

const BOX_AT: V3 = [-2.0, 0, 2.2];
const BOX_FROM: V3 = [-6.5, 0, 2.2];
/** Coordinated samples: wall, floor, grout and the accent, fanned out above the box. */
const SAMPLES: { tex?: "calm" | "gloss" | "busy"; color?: string; hover: V3; dest: V3 }[] = [
  { tex: "calm", hover: [-3.0, 2.35, 2.2], dest: [-1.0, 5.0, -5.6] },
  { tex: "gloss", hover: [-2.35, 2.75, 2.1], dest: [0.5, 0.1, 0.0] },
  { color: "#D9D3C8", hover: [-1.65, 2.75, 2.1], dest: [-0.5, 0.1, -2.0] },
  { tex: "busy", hover: [-1.0, 2.35, 2.2], dest: NICHE[0] },
];

const T_FACING = Math.PI; // facing the back wall
const hopOver = (z: number, sweepZ: number, active: boolean) => (active ? Math.sin(clamp(1 - Math.abs(sweepZ - z) / 0.7) * Math.PI * 0.5) ** 2 * 0.55 : 0);

/** The room at transformation progress `f` (or forced to the "before" state). */
const roomAt = (f: number, before = false): BathroomProps => {
  const M = MAKEOVER;
  if (before) return { f, slotEmpty: true, warm: 0 };
  const nicheCount = f < M.nicheTrim ? 0 : f < M.nicheTiles[0] ? 0.5 : f < M.nicheTiles[1] ? 1 : f < M.nicheTiles[2] ? 2 : f < M.leap[1] ? 3 : 4;
  return {
    f,
    slotEmpty: true,
    wallHole: f < M.walls[0] ? PATTERN_HOLE : null,
    oldVanity: prog(f, M.vanityOut[0], M.vanityOut[1] - M.vanityOut[0]),
    grout: E.inOutSine(prog(f, M.grout[0], M.grout[1] - M.grout[0])),
    walls: prog(f, M.walls[0], M.walls[1] - M.walls[0]),
    glass: prog(f, M.glass[0], M.glass[1] - M.glass[0]),
    newVanity: prog(f, M.vanityIn[0], M.vanityIn[1] - M.vanityIn[0]),
    fixtures: prog(f, M.fixtures[0], M.fixtures[1] - M.fixtures[0]),
    warm: E.inOutCubic(prog(f, M.warm[0], M.warm[1] - M.warm[0])),
    // slot 4 of the inlay is drawn by the character itself once it lands
    niche: nicheCount >= 4 ? 3.0 : nicheCount === 0.5 ? 0.01 : nicheCount,
  };
};

/** Watchers in the master shot: the tile and the detective, backs to us, looking at the room. */
const Watchers: React.FC<{ f: number; frozen?: boolean }> = ({ f, frozen = false }) => {
  const M = MAKEOVER;
  const sweepZ = -6 + 12 * E.inOutSine(prog(f, M.grout[0], M.grout[1] - M.grout[0]));
  const sweeping = !frozen && f > M.grout[0] && f < M.grout[1];
  const delight = frozen ? 0 : E.inOutCubic(prog(f, M.warm[0], 30));
  const tHop = hopOver(TILE_STAND[2], sweepZ, sweeping);
  const dHop = hopOver(DUCK_STAND[2], sweepZ, sweeping);
  // heads follow the action: vanity (left), walls, shower (right), inlay (right, high)
  const lookX = frozen ? 0 : f < M.walls[0] ? -0.5 : f < M.glass[1] ? 0.1 : f < M.vanityIn[1] ? -0.6 : 0.6;
  return (
    <>
      <TileCharacter
        position={[TILE_STAND[0], tHop, TILE_STAND[2]]}
        scale={TILE}
        facing={T_FACING + lookX * 0.3}
        tex="gloss"
        tie
        shoes="#2B2F36"
        legs={1 - tHop * 0.4}
        arms={1}
        cheer={delight * 0.7}
        wave={f * 0.3}
        look={[lookX, 0.4]}
        happy={delight > 0.6 ? 1 : 0}
        mouth={0.2 + delight * 0.7}
        squash={tHop > 0.05 ? -0.4 : 0}
      />
      <Duck
        position={[DUCK_STAND[0], dHop, DUCK_STAND[2]]}
        scale={0.8}
        facing={Math.PI - 0.25 + lookX * 0.3}
        look={[lookX, 0.3]}
        lid={0.15}
        brow={0.2 - delight * 0.4}
        bob={dHop > 0.05 ? 0.1 : 0}
        tilt={0.05}
        wingL={dHop * 0.9}
        wingR={dHop * 0.9}
      />
    </>
  );
};

export const SceneMakeover: React.FC = () => {
  const f = useFilmFrame();
  const S = scene("makeover");
  const M = MAKEOVER;
  const L10 = line("L10");
  const L11 = line("L11");
  const L12 = line("L12");
  const C = hold("compare");
  const T = hold("transform");
  const shot = f < M.brandCut ? 1 : f < M.wideCut ? 2 : 3;

  /* ---------------- camera ---------------- */
  let cam: CamSpec;
  if (shot === 1) cam = mixCam(CAM_TWO0, CAM_TWO1, E.inOutSine(prog(f, S.from, M.brandCut - S.from)));
  else if (shot === 2) cam = mixCam(CAM_CU0, CAM_CU1, E.outCubic(prog(f, M.brandCut, M.wideCut - M.brandCut)));
  else cam = mixCam(MASTER, MASTER_IN, E.inOutSine(prog(f, T.from, T.to - T.from)));

  /* ---------------- the conversation (shots 1–2) ---------------- */
  const m10 = mouthOf("L10", f);
  const m11 = mouthOf("L11", f);
  const second = L10.phrases.length > 1 ? L10.phrases[1].from : L10.from + (L10.to - L10.from) / 2;
  const sweepWing = E.inOutCubic(prog(f, L10.from + 2, 10)) * (1 - E.inOutCubic(prog(f, second - 4, 8)));
  const together = E.inOutCubic(prog(f, second, 10));
  const eureka = E.outBack(prog(f, L11.from - 2, 6), 1.8);

  /* ---------------- shot 3: box, samples ---------------- */
  const boxSlide = E.outCubic(prog(f, M.boxIn, M.boxLand - M.boxIn));
  const boxOut = E.inCubic(prog(f, M.T0 + 20, 14));
  const boxPos: V3 = mixV(mixV(BOX_FROM, BOX_AT, boxSlide), BOX_FROM, boxOut);
  const boxOpen = prog(f, M.boxOpen, 8) * (1 - prog(f, M.T0 + 14, 6));
  const rise = E.outBack(prog(f, M.samplesUp[0], M.samplesUp[1] - M.samplesUp[0]), 1.3);

  /* ---------------- the patterned tile ---------------- */
  const m12 = mouthOf("L12", f);
  const leapT = prog(f, M.leap[0], M.leap[1] - M.leap[0]);
  const slot4 = NICHE[3];
  const nichePos: V3 = [slot4[0], slot4[1] - 0.47, -5.9];
  const arc = Math.sin(leapT * Math.PI) * 2.6;
  const pPos: V3 = leapT <= 0 ? P_FLOOR : leapT >= 1 ? nichePos : [lerp(P_FLOOR[0], nichePos[0], E.inOutSine(leapT)), lerp(P_FLOOR[1], nichePos[1], E.inOutCubic(leapT)) + arc, lerp(P_FLOOR[2], nichePos[2], E.inOutSine(leapT))];
  const landed = leapT >= 1;
  const settle = E.settle(prog(f, M.leap[1], 12), 2.4, 4);
  const pFacing = leapT < 0.5 ? faceTo(P_FLOOR, [-1.0, 0, -3.0]) : 0;

  /* ---------------- compare ---------------- */
  const wipeIn = E.inOutCubic(prog(f, M.wipeIn[0], M.wipeIn[1] - M.wipeIn[0]));
  const wipeOut = E.inOutCubic(prog(f, M.wipeOut[0], M.wipeOut[1] - M.wipeOut[0]));
  const inCompare = f >= C.from && f < C.to;
  const divider = lerp(1080, 540, wipeIn) + (1080 - 540) * wipeOut; // "before" covers the right side
  const compareShow = inCompare ? clamp(wipeIn * 1.4) * (1 - wipeOut) : 0;

  const room = roomAt(f);
  const warm = room.warm ?? 0;

  const masterChildren = (frozenBefore: boolean) => (
    <>
      <Watchers f={f} frozen={frozenBefore} />
      {!frozenBefore && f < M.T0 + 36 ? <SampleBox position={boxPos} rotation={[0, 0.25, 0]} open={boxOpen} glowAmt={boxOpen} scale={1} /> : null}
      {!frozenBefore && rise > 0.01 && f < M.walls[0] + 22
        ? SAMPLES.map((s, k) => {
            const go = E.inCubic(prog(f, M.walls[0] - 4 + k * 3, 16));
            const at = mixV(mixV([BOX_AT[0], 0.6, BOX_AT[2]], s.hover, rise), s.dest, go);
            const bobY = Math.sin(f * 0.18 + k) * 0.05 * (1 - go);
            return <Chip key={k} tex={s.tex} color={s.color} position={[at[0], at[1] + bobY, at[2]]} rotation={[Math.PI / 2 - 0.25 + go * 1.2, 0.15 * (k - 1.5), 0]} w={0.62} d={0.62} scale={1 - go * 0.6} />;
          })
        : null}
      {frozenBefore ? (
        <TileCharacter position={[-3.92, 1.5 - 0.47, 1.5]} scale={TILE} facing={Math.PI / 2} tex="busy" legs={0} arms={0} face={0} castShadow={false} />
      ) : (
        <TileCharacter
          position={pPos}
          scale={TILE}
          facing={pFacing}
          tex="busy"
          legs={landed ? 0 : 1 - E.inCubic(clamp((leapT - 0.5) * 2))}
          arms={landed ? 0 : 1 - E.inCubic(clamp((leapT - 0.55) * 2.2))}
          squash={landed ? Math.sin(settle * Math.PI) * 0.5 * (1 - settle) : leapT > 0 ? -0.25 : 0}
          eyes={blink(f, [M.leap[1] + 20])}
          look={landed ? [0.3, -0.4] : [0.4, 0.3]}
          brow={landed ? -0.3 : -0.5}
          happy={0}
          mouth={landed ? 0.9 : 0.3}
          jaw={m12.open}
          lipRound={m12.round}
          cheer={leapT > 0 && leapT < 0.5 ? 1 : 0}
          wave={f * 0.4}
          castShadow={!landed}
        />
      )}
    </>
  );

  return (
    <AbsoluteFill>
      {shot < 3 ? (
        <Stage cam={cam} warm={0} bath={roomAt(f, true)} boost={1.05}>
          <TileCharacter
            position={TILE_STAND}
            scale={TILE}
            facing={shot === 1 ? lerp(faceTo(TILE_STAND, DUCK_STAND), faceTo(TILE_STAND, CAM_TWO0.pos), 0.5) : faceTo(TILE_STAND, DUCK_STAND) * 0.55}
            tex="gloss"
            tie
            shoes="#2B2F36"
            eyes={blink(f, [L10.from + 18, second + 10])}
            look={shot === 1 ? [-0.8, 0.1] : [-0.6, 0.2]}
            brow={0.35 - together * 0.5}
            browLift={eureka * 0.05}
            mouth={shot === 2 ? 0.5 : -0.2}
            lean={-0.04}
            armRaise={0}
            crossed={0.8 * (1 - together)}
          />
          <Duck
            position={DUCK_STAND}
            scale={0.8}
            facing={shot === 1 ? lerp(faceTo(DUCK_STAND, CAM_TWO0.pos), faceTo(DUCK_STAND, TILE_STAND), 0.25) : faceTo(DUCK_STAND, CAM_CU0.pos) + 0.25}
            headTurn={shot === 1 ? lerp(0.45, 0, together) : 0}
            jaw={shot === 1 ? m10.open : m11.open}
            look={shot === 1 ? [0.6 - together * 0.6, -0.1] : [0.2, 0.15]}
            lid={shot === 1 ? 0.3 : 0.12}
            brow={shot === 1 ? 0.45 : -0.2}
            browLift={shot === 2 ? eureka * 0.07 : 0}
            wingL={sweepWing * 0.85 + together * 0.6}
            wingR={together * 0.6 + (shot === 2 ? eureka * 0.8 : 0)}
            magnifier={shot === 2 ? eureka : 0}
            hatTip={shot === 2 ? Math.sin(prog(f, L11.words[1]?.from ?? L11.from, 10) * Math.PI) * 0.6 : 0}
            lean={shot === 1 ? 0.05 + m10.energy * 0.03 : -0.06 + m11.energy * 0.05}
            tilt={shot === 1 ? -0.08 : 0.06}
            bob={shot === 2 ? Math.sin(prog(f, L11.from, 8) * Math.PI) * 0.08 : 0}
          />
        </Stage>
      ) : (
        <>
          <Stage cam={cam} warm={warm} bath={room}>
            {masterChildren(false)}
          </Stage>
          {inCompare && divider < 1079 ? (
            <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${divider}px)` }}>
              <Stage cam={cam} warm={0} bath={roomAt(f, true)}>
                {masterChildren(true)}
              </Stage>
            </AbsoluteFill>
          ) : null}
        </>
      )}
      <Vignette strength={lerp(0.42, 0.28, warm)} />
      <Flash f={f} at={M.brandCut} dur={4} max={0.18} />
      <Flash f={f} at={M.leap[1]} dur={6} max={0.22} color="#FFF4DE" />
      <CompareOverlay x={divider} show={compareShow} />
      <FilmGrain opacity={0.05} />
      {L12.from < 0 ? null : null}
    </AbsoluteFill>
  );
};
