import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { clamp, E, kf, lerp, prog, V3 } from "../anim";
import { Cam, KeyLight, Slab, StudioEnv, DPR } from "../three/kit";
import { RoomModel } from "../three/RoomModel";
import { project, toWorld } from "../three/project";
import { DISPLAY, MONO } from "../fonts";
import { FilmGrain, FrameMarks, SlamWord } from "../ui/Overlays";
import { HANDOFF_CAM, LAND_AT, PLAN, ROOM_SLOTS, SAMPLES } from "./sceneShared";

/**
 * SCENE 04 — THE 3RAMIC SYSTEM (17–24 s)
 * A fictional, clearly-labelled concept interface. Six premium ceramic samples
 * float in, get a macro close-up, then fly into the rooms that suit them.
 */

const G: V3 = [5.5, 7.5, 13]; // sample-grid centre (world)
const GRID_CAM = { pos: [G[0], G[1], G[2] + 10.5] as V3, target: G, fov: 32 };
const MACRO_IDX = 2; // terrazzo — orange & charcoal chips read beautifully in macro

const gridLocal = (k: number): V3 => [((k % 3) - 1) * 1.05, k < 3 ? 0.55 : -0.55, 0];

const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const bezier = (a: V3, c: V3, b: V3, t: number): V3 => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]];
};

const camera = (f: number) => {
  const m = gridLocal(MACRO_IDX);
  const c: V3 = [G[0] + m[0], G[1] + m[1], G[2] + 0.08];
  // grazing macro: low across the glaze so the bevel, chips and glint all read
  const macroA: V3 = [c[0] + 0.62, c[1] - 0.34, c[2] + 0.42];
  const macroB: V3 = [c[0] + 0.3, c[1] - 0.46, c[2] + 0.34];
  const macroT: V3 = [c[0] - 0.12, c[1] + 0.08, c[2] - 0.02];
  if (f < 62) return { ...GRID_CAM, pos: [GRID_CAM.pos[0], GRID_CAM.pos[1], GRID_CAM.pos[2] - kf(f, [0, 62], [0, 1.2])] as V3 };
  if (f < 72) {
    const t = E.inOutExpo(prog(f, 62, 10));
    const start: V3 = [GRID_CAM.pos[0], GRID_CAM.pos[1], GRID_CAM.pos[2] - 1.2];
    return { pos: lerp3(start, macroA, t), target: lerp3(GRID_CAM.target, macroT, t), fov: lerp(32, 34, t) };
  }
  if (f < 100) {
    const t = E.inOutSine(prog(f, 72, 28));
    return { pos: lerp3(macroA, macroB, t), target: macroT, fov: lerp(34, 30, t) };
  }
  const t = E.inOutCubic(prog(f, 100, 28));
  return { pos: lerp3(macroB, HANDOFF_CAM.pos, t), target: lerp3(macroT, HANDOFF_CAM.target, t), fov: lerp(30, HANDOFF_CAM.fov, t) };
};

export const Scene04System: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam = camera(f);

  const roomEnter = ROOM_SLOTS.map((_, i) => E.outCubic(prog(f, 104 + i * 5, 22)));
  const roomPos = ROOM_SLOTS.map((r, i): V3 => [r.pos[0], r.pos[1] - (1 - roomEnter[i]) * 14, r.pos[2]]);

  // where each sample lands
  const landing = (k: number): { hover: V3; dive: V3 } => {
    const s = SAMPLES[k];
    const ri = ROOM_SLOTS.findIndex((r) => r.kind === s.room);
    const slot = ROOM_SLOTS[ri];
    const local: V3 = s.surface === "floor" ? [0.4, 0.05, 0.6] : [0.3, 1.1, -1.9];
    const dive = toWorld(local, slot.pos, slot.rotY);
    return { hover: [dive[0] + 0.8, dive[1] + 2.6, dive[2] + 1.6], dive };
  };

  return (
    <AbsoluteFill style={{ background: COLORS.ivory }}>
      {/* lab field: fine grid + soft light */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(18,24,32,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(18,24,32,0.07) 1px, transparent 1px)`,
          backgroundSize: "54px 54px",
          backgroundPosition: `0px ${-f * 0.8}px`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 45% at 50% 52%, rgba(255,255,255,0.75), rgba(242,237,228,0) 70%)" }} />

      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 0.92 }}>
        <StudioEnv intensity={0.42} />
        <ambientLight intensity={0.12} color="#FFF4E8" />
        <KeyLight position={[12, 18, 16]} target={[2, 2, 2]} intensity={1.65} color="#FFF3E6" extent={14} />
        <directionalLight position={[-10, 4, 8]} intensity={0.45} color="#C9D6E8" />
        {/* macro glint that sweeps across the glaze */}
        <pointLight
          position={[G[0] + gridLocal(MACRO_IDX)[0] + kf(f, [66, 100], [-0.9, 0.9], E.inOutSine), G[1] + gridLocal(MACRO_IDX)[1] + 0.25, G[2] + 0.55]}
          intensity={f >= 60 && f < 104 ? 2.2 : 0}
          distance={2.2}
          decay={2}
          color="#FFFFFF"
        />
        <Cam pos={cam.pos} target={cam.target} fov={cam.fov} />

        {/* the six samples */}
        {SAMPLES.map((s, k) => {
          const arrive = E.outExpo(prog(f, 14 + k * 5, 20));
          const local = gridLocal(k);
          const gridPos: V3 = [G[0] + local[0], G[1] + local[1], G[2] + local[2] - (1 - arrive) * 14];
          const isMacro = k === MACRO_IDX && f >= 60 && f < 106;
          const idleY = Math.sin(f * 0.05 + k * 1.3) * (isMacro ? 0.12 : 0.28);
          const idleX = Math.sin(f * 0.04 + k) * 0.12 + (isMacro ? 0.18 : 0);
          const L = landing(k);
          const t0 = 100 + k * 2;
          const land = LAND_AT[s.key];
          const flyT = prog(f, t0, land - 6 - t0);
          const diveT = prog(f, land - 6, 6);
          let p: V3 = gridPos;
          let rx = Math.PI / 2 + idleX;
          let ry = (1 - arrive) * Math.PI * 4 + idleY;
          let sc = 0.8;
          if (f >= t0) {
            const ctrl: V3 = [lerp(gridPos[0], L.hover[0], 0.5), Math.max(gridPos[1], L.hover[1]) + 3, lerp(gridPos[2], L.hover[2], 0.5)];
            p = f < land - 6 ? bezier(gridPos, ctrl, L.hover, E.inOutCubic(flyT)) : lerp3(L.hover, L.dive, E.inCubic(diveT));
            rx = lerp(Math.PI / 2 + idleX, s.surface === "floor" ? 0.2 : Math.PI / 2, E.inOutCubic(flyT));
            ry = idleY + E.inOutCubic(flyT) * Math.PI * 2;
            sc = lerp(0.8, 0.9, flyT) * (1 - E.inCubic(diveT) * 0.85);
          }
          if (f >= land) return null;
          return <Slab key={s.key} tex={s.key} w={1} d={1} t={0.14} position={p} rotation={[rx, ry, 0]} scale={sc} />;
        })}

        {/* rooms receive their materials */}
        {ROOM_SLOTS.map((r, i) => {
          const plan = PLAN[r.kind];
          const floorAt = LAND_AT[plan.floor];
          const wallAt = LAND_AT[plan.wall];
          return (
            <RoomModel
              key={r.kind}
              kind={r.kind}
              position={roomPos[i]}
              rotation={[0, r.rotY, 0]}
              counter={plan.counter}
              floor={(a, b) => {
                const t = prog(f, floorAt + (a + b) * 1.6, 10);
                return { a: "mortar", b: plan.floor, flip: E.inOutCubic(t) };
              }}
              backWall={f >= wallAt ? plan.wall : null}
              sideWall={plan.side && f >= wallAt ? plan.side : null}
              wallRows={Math.floor(clamp((f - wallAt) / 3, 0, 10))}
              wallTile={r.kind === "living" ? 0.7 : 0.5}
              plaster="plasterStone"
              furniture={E.outBack(prog(f, floorAt + 8, 12), 1.6)}
            />
          );
        })}
      </ThreeCanvas>

      {/* ---------------- interface layer ---------------- */}
      <FrameMarks />
      <div style={{ position: "absolute", top: 120, left: 72, right: 72, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: MONO, fontSize: 21, letterSpacing: "0.14em", color: COLORS.charcoal }}>
        <span style={{ fontWeight: 700 }}>Nº 04 · 3RAMIC MATERIAL MATCH</span>
        <span style={{ background: COLORS.orange, color: COLORS.charcoal, padding: "5px 12px", fontWeight: 700 }}>CONCEPT VISUAL</span>
      </div>
      <div style={{ position: "absolute", top: 160, left: 72, fontFamily: MONO, fontSize: 17, letterSpacing: "0.12em", color: COLORS.charcoal, opacity: 0.55 }}>
        A CREATIVE VISUALISATION — NOT A REAL SOFTWARE PRODUCT
      </div>
      <SlamWord text="MATERIAL" start={6} dur={92} size={150} top={220} left={64} color={COLORS.charcoal} />
      <SlamWord text="MATCH." start={10} dur={88} size={150} top={354} left={64} color={COLORS.orange} />

      {/* sample labels (phase 1) */}
      {f < 62
        ? SAMPLES.map((s, k) => {
            const l = gridLocal(k);
            const [x, y] = project(cam.pos, cam.target, cam.fov, [G[0] + l[0], G[1] + l[1] - 0.47, G[2]]);
            const a = E.outCubic(prog(f, 26 + k * 5, 10)) * (1 - prog(f, 56, 6));
            return (
              <div key={s.key} style={{ position: "absolute", left: x - 150, top: y, width: 300, textAlign: "center", opacity: a, fontFamily: MONO, color: COLORS.charcoal }}>
                <div style={{ fontSize: 18, letterSpacing: "0.12em", opacity: 0.6 }}>0{k + 1}</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, letterSpacing: "-0.01em" }}>{s.name}</div>
                <div style={{ fontSize: 15, letterSpacing: "0.1em", opacity: 0.65, marginTop: 2 }}>{s.spec}</div>
              </div>
            );
          })
        : null}

      {/* selection reticle before the macro */}
      {f >= 44 && f < 64
        ? (() => {
            const l = gridLocal(MACRO_IDX);
            const [x, y] = project(cam.pos, cam.target, cam.fov, [G[0] + l[0], G[1] + l[1], G[2]]);
            const p = E.outExpo(prog(f, 44, 10));
            const r = 190 - 40 * p;
            return (
              <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
                <circle cx={x} cy={y} r={r} fill="none" stroke={COLORS.orange} strokeWidth={4} strokeDasharray={`${2 * Math.PI * r * p} 9999`} transform={`rotate(-90 ${x} ${y})`} />
                <circle cx={x} cy={y} r={r + 16} fill="none" stroke={COLORS.charcoal} strokeWidth={1.5} strokeDasharray="4 10" opacity={0.6} />
              </svg>
            );
          })()
        : null}

      {/* macro caption */}
      {f >= 72 && f < 102 ? (
        <div style={{ position: "absolute", left: 72, bottom: 640, fontFamily: MONO, color: COLORS.ivory, opacity: E.outCubic(prog(f, 72, 8)) * (1 - prog(f, 96, 6)) }}>
          <div style={{ display: "inline-block", background: COLORS.charcoal, padding: "8px 14px", fontSize: 20, letterSpacing: "0.16em" }}>MACRO · 03 TERRAZZO</div>
          <div style={{ display: "inline-block", background: COLORS.orange, color: COLORS.charcoal, padding: "8px 14px", fontSize: 20, letterSpacing: "0.16em", fontWeight: 700 }}>→ KITCHEN</div>
        </div>
      ) : null}

      {/* line-8 supers: material · pattern · personality */}
      <SlamWord text="MATERIAL." start={112} dur={98} size={128} top={232} left={64} color={COLORS.charcoal} exit={false} />
      <SlamWord text="PATTERN." start={140} dur={70} size={128} top={348} left={64} color={COLORS.charcoal} exit={false} />
      <SlamWord text="PERSONALITY." start={168} dur={42} size={128} top={464} left={64} color={COLORS.orange} exit={false} />

      {/* match readouts per room */}
      {ROOM_SLOTS.map((r, i) => {
        const plan = PLAN[r.kind];
        const at = LAND_AT[plan.wall] + 4;
        if (f < at) return null;
        const [x, y] = project(cam.pos, cam.target, cam.fov, toWorld([2.4, 0.4, 1.6], roomPos[i], r.rotY));
        const a = E.outCubic(prog(f, at, 8));
        const pct = Math.round(kf(f, [at, at + 14], [40, 96 + i], E.outCubic));
        return (
          <div key={r.kind} style={{ position: "absolute", left: Math.min(x + 6, 760), top: y - 40, opacity: a, fontFamily: MONO, color: COLORS.charcoal, background: "rgba(242,237,228,0.92)", padding: "8px 12px", borderLeft: `5px solid ${COLORS.orange}` }}>
            <div style={{ fontSize: 16, letterSpacing: "0.14em", opacity: 0.7 }}>{r.kind.toUpperCase()}</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, lineHeight: 1 }}>
              {pct}% <span style={{ fontSize: 20, fontFamily: MONO, fontWeight: 700, color: COLORS.orange }}>MATCH</span>
            </div>
          </div>
        );
      })}
      <FilmGrain opacity={0.05} />
    </AbsoluteFill>
  );
};
