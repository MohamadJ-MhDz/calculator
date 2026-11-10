import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { E, hash, kf, lerp, prog, V3 } from "../anim";
import { Cam, cardFrame, cardSlab, flat, glow, KeyLight, roundedBox, StudioEnv, DPR } from "../three/kit";
import { RoomModel } from "../three/RoomModel";
import { TileCharacter } from "../three/TileCharacter";
import { TexKey } from "../three/textures";
import { project, toWorld } from "../three/project";
import { Callout } from "../ui/Callout";
import { ChapterTag, FilmGrain, SlamWord, Vignette } from "../ui/Overlays";
import { MONO, DISPLAY } from "../fonts";

/**
 * SCENE 03 — THE INVESTIGATION (11–17 s)
 * A dark midnight-blue investigation interface. The apartment plan splits into three
 * floating 3D cards, each carrying a miniature room. Quick cuts and snap-zooms expose
 * unsuitable materials, mismatched patterns and poor combinations; orange markers
 * pin the evidence. The tiles protest with tiny picket signs.
 */

type RoomDef = {
  kind: "kitchen" | "bathroom" | "living";
  joined: V3;
  float: V3;
  rotY: number;
  floor: TexKey;
  back: TexKey;
  side: TexKey;
  protester: TexKey;
};

const ROOMS: RoomDef[] = [
  { kind: "kitchen", joined: [0, 0, -4.45], float: [-0.7, 4.3, -0.6], rotY: 0.3, floor: "pool", back: "pool", side: "pool", protester: "travertine" },
  { kind: "living", joined: [0, 0, 0], float: [0.7, 0, 0], rotY: -0.18, floor: "terracotta", back: "green", side: "bluewhite", protester: "stone" },
  { kind: "bathroom", joined: [0, 0, 4.45], float: [-0.5, -4.3, 0.6], rotY: 0.22, floor: "checker", back: "floral", side: "stripe", protester: "marble" },
];

const SPLIT_END = 36;

const roomPos = (r: RoomDef, i: number, f: number): V3 => {
  const p = E.inOutCubic(prog(f, 6 + i * 3, SPLIT_END - 6));
  const bob = Math.sin(f * 0.06 + i * 2) * 0.08 * p;
  // exhibit C: the rooms are drawn together for comparison
  const together = E.inOutCubic(prog(f, 128, 18));
  const fy = r.float[1] * (1 - 0.2 * together);
  return [lerp(r.joined[0], r.float[0], p), lerp(r.joined[1], fy, p) + bob, lerp(r.joined[2], r.float[2], p)];
};

const roomRot = (r: RoomDef, i: number, f: number) => lerp(0, r.rotY, E.inOutCubic(prog(f, 6 + i * 3, SPLIT_END - 6))) + Math.sin(f * 0.025 + i) * 0.04;

/** Cut points (scene-local): overview → exhibit A → exhibit B → exhibit C. */
export const CUT_A = 48;
export const CUT_B = 92;
export const CUT_C = 140;
/** Snap-zooms inside the exhibits. */
export const ZOOM_A = 70;
export const ZOOM_B = 116;

const mix = (x: V3, y: V3, t: number): V3 => [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)];

/**
 * Camera director. The plan view splits into the overview in one move; after that the
 * edit is hard cuts, each shot drifting slowly, with a snap-zoom onto the evidence.
 */
const camera = (f: number, centers: V3[], evidenceA: V3, evidenceB: V3) => {
  const overviewPos: V3 = [10.5, 10.1, 19];
  const overviewTarget: V3 = [0, 1.6, 0];
  const a = centers[0];
  const b = centers[2];
  const tA: V3 = [a[0], a[1] + 1.9, a[2]];
  const tB: V3 = [b[0], b[1] + 1.9, b[2]];
  if (f < SPLIT_END) {
    const t = E.inOutExpo(f / SPLIT_END);
    return { pos: mix([0, 23, 3.2], overviewPos, t), target: mix([0, 0, 0], overviewTarget, t), fov: lerp(44, 38, t) };
  }
  if (f < CUT_A) {
    const t = (f - SPLIT_END) / (CUT_A - SPLIT_END);
    return { pos: mix(overviewPos, [10.1, 10.0, 18.4], t), target: overviewTarget, fov: 38 };
  }
  if (f < CUT_B) {
    const t = E.outCubic(prog(f, CUT_A, CUT_B - CUT_A));
    const z = E.outExpo(prog(f, ZOOM_A, 6));
    const exA: V3 = [a[0] + 7.5, a[1] + 6.0, a[2] + 12.5];
    return { pos: mix(exA, [exA[0] - 0.9, exA[1] + 0.2, exA[2] - 0.7], t), target: mix(tA, evidenceA, z), fov: lerp(lerp(35, 33, t), 23, z) };
  }
  if (f < CUT_C) {
    const t = E.outCubic(prog(f, CUT_B, CUT_C - CUT_B));
    const z = E.outExpo(prog(f, ZOOM_B, 6));
    const exB: V3 = [b[0] + 3.5, b[1] + 8.5, b[2] + 13];
    return { pos: mix(exB, [exB[0] + 0.9, exB[1] - 0.2, exB[2] - 0.6], t), target: mix(tB, evidenceB, z), fov: lerp(lerp(35, 33, t), 24, z) };
  }
  const t = E.outCubic(prog(f, CUT_C, 40));
  return { pos: mix([11.2, 11.2, 22.5], [10.2, 10.8, 23.5], t), target: [0, 2.9, 0] as V3, fov: 38 };
};

/* ---------------- floating interface card under each miniature room ---------------- */

const CARD = 4.9;
let cardMaterial: THREE.MeshPhysicalMaterial | null = null;
const cardMat = () => {
  if (!cardMaterial) cardMaterial = new THREE.MeshPhysicalMaterial({ color: "#1B2D5C", roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  return cardMaterial;
};

const RoomCard: React.FC<{ grow: number; alert: number }> = ({ grow, alert }) => {
  const s = lerp(0.84, 1, grow);
  return (
    <group position={[-0.05, -0.09, -0.05]} scale={[s, 1, s]}>
      <mesh geometry={cardSlab(CARD, CARD, 0.42, 0.14)} material={cardMat()} castShadow receiveShadow />
      {/* inset frame line */}
      <mesh geometry={cardFrame(CARD - 0.18, CARD - 0.18, 0.34, 0.03)} material={glow(alert > 0.5 ? COLORS.orange : "#6F86B8")} position={[0, 0.003, 0]} />
      {/* header tab + three window dots on the front margin */}
      <mesh geometry={roundedBox(1.25, 0.024, 0.11, 0.01)} material={glow(COLORS.orange)} position={[-CARD / 2 + 1.0, 0.014, CARD / 2 - 0.2]} />
      {[0, 1, 2].map((k) => (
        <mesh key={k} material={glow(k === 0 ? COLORS.orange : "#6F86B8")} position={[CARD / 2 - 0.42 - k * 0.2, 0.012, CARD / 2 - 0.2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 20]} />
        </mesh>
      ))}
      {/* light strip around the underside edge so the card reads as floating */}
      <mesh geometry={cardFrame(CARD + 0.04, CARD + 0.04, 0.44, 0.045)} material={glow(COLORS.orange, 0.7)} position={[0, -0.2, 0]} />
    </group>
  );
};

const ScanPlane: React.FC<{ x: number }> = ({ x }) => {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: COLORS.orange, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
  const edge = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#FFB08F", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  );
  return (
    <group position={[x, 1.2, 0]}>
      <mesh material={mat} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[4.6, 2.6]} />
      </mesh>
      <mesh material={edge} position={[0, 1.3, 0]}>
        <boxGeometry args={[0.025, 0.025, 4.6]} />
      </mesh>
      <mesh material={edge} position={[0, -1.25, 0]}>
        <boxGeometry args={[0.025, 0.025, 4.6]} />
      </mesh>
    </group>
  );
};

export const Scene03Investigation: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pos = ROOMS.map((r, i) => roomPos(r, i, f));
  const rot = ROOMS.map((r, i) => roomRot(r, i, f));
  const centers = ROOMS.map((r) => r.float);
  const cam = camera(f, centers, toWorld([-0.7, 0.35, 1.25], pos[0], rot[0]), toWorld([0.5, 0.75, -0.9], pos[2], rot[2]));
  const P = (roomIdx: number, local: V3) => project(cam.pos, cam.target, cam.fov, toWorld(local, pos[roomIdx], rot[roomIdx]));
  const grow = E.outCubic(prog(f, 10, SPLIT_END - 10));
  const exhibit = f < CUT_A ? -1 : f < CUT_B ? 0 : f < CUT_C ? 2 : 3;

  const scanA = kf(f, [44, 66], [-2.4, 2.4], E.inOutSine);
  const scanB = kf(f, [96, 118], [-2.4, 2.4], E.inOutSine);
  const vib = f >= 96 && f < 128 ? 1 : 0;
  const protest = E.outBack(prog(f, 84, 10), 2);

  // exhibit C graphics: connectors between rooms
  const cK = P(0, [0, 1.0, 0]);
  const cL = P(1, [0, 1.0, 0]);
  const cB = P(2, [0, 1.0, 0]);
  const conn = E.outCubic(prog(f, 140, 12));

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 95% 62% at 50% 44%, ${COLORS.midnightLift} 0%, ${COLORS.midnight} 48%, ${COLORS.midnightDeep} 100%)` }}>
      {/* interface field: drifting blueprint grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(157,180,214,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(157,180,214,0.11) 1px, transparent 1px), linear-gradient(rgba(157,180,214,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(157,180,214,0.05) 1px, transparent 1px)`,
          backgroundSize: "270px 270px, 270px 270px, 54px 54px, 54px 54px",
          backgroundPosition: `${-f * 0.6}px ${-f * 1.2}px`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(255,112,61,0.08), rgba(0,0,0,0) 70%)" }} />

      <ThreeCanvas dpr={DPR} width={width} height={height} shadows gl={{ antialias: true, alpha: true }}>
        <StudioEnv intensity={0.55} />
        <ambientLight intensity={0.25} color="#B8C6DA" />
        <KeyLight position={[8, 14, 10]} intensity={2.4} color="#E9EEF6" extent={11} />
        <directionalLight position={[-8, 3, -6]} intensity={1.6} color={COLORS.orange} />
        <Cam pos={cam.pos} target={cam.target} fov={cam.fov} />
        {ROOMS.map((r, i) => (
          <RoomModel
            key={r.kind}
            kind={r.kind}
            position={pos[i]}
            rotation={[0, rot[i], 0]}
            wrong
            plinth={false}
            counter={r.kind === "kitchen" ? "pool" : "terrazzo"}
            floor={(a, b) => ({
              a: r.floor,
              jitter: r.kind === "bathroom" && vib ? (hash(f * 13 + a * 5 + b) - 0.5) * 0.06 : 0,
            })}
            backWall={r.back}
            sideWall={r.side}
            wallTile={r.kind === "living" ? 0.7 : 0.5}
          >
            <RoomCard grow={grow} alert={exhibit === i || exhibit === 3 ? 1 : 0} />
            {r.kind === "kitchen" ? (
              <group position={[-1.05, 0.12 + Math.sin(f * 0.15) * 0.02, 1.25]} rotation={[-Math.PI / 2 + 0.1, 0, 0]}>
                <mesh material={flat(COLORS.orange, 0.35)} castShadow>
                  <torusGeometry args={[0.3, 0.11, 16, 32]} />
                </mesh>
                <mesh material={flat("#F2EDE4", 0.35)} rotation={[0, 0, Math.PI / 4]}>
                  <torusGeometry args={[0.3, 0.113, 16, 32, Math.PI / 4]} />
                </mesh>
              </group>
            ) : null}
            {r.kind === "kitchen" ? (
              <group position={[1.3, 0.0, 1.35]} rotation={[0, -0.6, 0]}>
                <mesh material={flat("#F5D21E", 0.4)} position={[0, 0.1, 0]} scale={[0.14, 0.1, 0.11]} castShadow>
                  <sphereGeometry args={[1, 20, 14]} />
                </mesh>
                <mesh material={flat("#F5D21E", 0.4)} position={[0.08, 0.22, 0]} scale={0.075} castShadow>
                  <sphereGeometry args={[1, 16, 12]} />
                </mesh>
                <mesh material={flat(COLORS.orange, 0.4)} position={[0.16, 0.21, 0]} scale={[0.04, 0.018, 0.03]}>
                  <sphereGeometry args={[1, 10, 8]} />
                </mesh>
              </group>
            ) : null}
            {protest > 0.01 ? (
              <TileCharacter
                position={[1.25, 0, 0.2]}
                facing={-0.3}
                scale={0.55 * protest}
                tex={r.protester}
                carry="sign"
                wave={f * 0.5 + i}
                brow={0.9}
                mouth={-1}
                eyes={1}
                lift={Math.abs(Math.sin(f * 0.25 + i)) * 0.06}
              />
            ) : null}
            {i === 0 && f >= 40 && f < 72 ? <ScanPlane x={scanA} /> : null}
            {i === 2 && f >= 92 && f < 124 ? <ScanPlane x={scanB} /> : null}
          </RoomModel>
        ))}
      </ThreeCanvas>

      {/* EXHIBIT A — kitchen */}
      <Callout anchor={P(0, [0.6, 0.02, 1.3])} label={[700, 1190]} tag="EXHIBIT A · FLOOR" title="POOL MOSAIC" sub="LOCATION: KITCHEN · SLIP RISK ↑" start={52} end={90} />
      <Callout anchor={P(0, [-1.05, 0.25, 1.25])} label={[90, 1260]} tag="EVIDENCE 02" title="A SWIM RING?" sub="INVESTIGATION ONGOING" start={ZOOM_A + 2} end={90} />
      {/* EXHIBIT B — bathroom */}
      <Callout anchor={P(2, [0.6, 0.02, 1.0])} label={[640, 1250]} tag="TEXTURE 01" title="CHECKER" start={100} end={136} />
      <Callout anchor={P(2, [0.5, 1.4, -1.98])} label={[680, 640]} tag="TEXTURE 02" title="FLORAL" start={105} end={136} />
      <Callout anchor={P(2, [-1.98, 1.2, 0.6])} label={[90, 760]} tag="TEXTURE 03" title="STRIPES" start={110} end={136} />

      {/* EXHIBIT C — no coordination between rooms */}
      {f >= 140 ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          {[
            [cK, cL],
            [cL, cB],
          ].map(([p0, p1], k) => {
            const mx = lerp(p0[0], p1[0], 0.5);
            const my = lerp(p0[1], p1[1], 0.5);
            const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            return (
              <g key={k}>
                <line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={COLORS.ivory} strokeWidth={3} strokeDasharray="14 10" strokeDashoffset={len * (1 - conn)} opacity={0.75} />
                <g transform={`translate(${mx} ${my}) rotate(${(1 - conn) * 90}) scale(${conn})`}>
                  <circle r={34} fill={COLORS.orange} />
                  <path d="M-13 -13 L13 13 M13 -13 L-13 13" stroke={COLORS.charcoal} strokeWidth={7} strokeLinecap="round" />
                </g>
              </g>
            );
          })}
        </svg>
      ) : null}
      {f >= 146 ? (
        <div style={{ position: "absolute", right: 72, top: 570, textAlign: "right", background: COLORS.midnightDeep, padding: "10px 18px", fontFamily: MONO, color: COLORS.ivory, opacity: E.outCubic(prog(f, 146, 8)) }}>
          <div style={{ fontSize: 20, letterSpacing: "0.16em", opacity: 0.7 }}>COORDINATION SCORE</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 1, color: COLORS.orange }}>
            {Math.round(kf(f, [146, 162], [87, 12], E.outCubic))}%
          </div>
        </div>
      ) : null}

      {/* card headers — anchored to each floating card */}
      {ROOMS.map((r, i) => {
        const show = f >= SPLIT_END - 4 && (exhibit === -1 || exhibit === 3 || exhibit === i);
        if (!show) return null;
        const [x, y] = P(i, [-2.3, -0.1, 2.5]);
        const a = E.outCubic(prog(f, SPLIT_END - 4 + i * 2, 8));
        const bad = exhibit === i || exhibit === 3;
        return (
          <div key={r.kind} style={{ position: "absolute", left: x - 6, top: y + 10, opacity: a, display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 19, letterSpacing: "0.14em", color: COLORS.ivory, whiteSpace: "nowrap" }}>
            <span style={{ background: bad ? COLORS.orange : COLORS.midnightLift, color: bad ? COLORS.charcoal : COLORS.ivory, padding: "3px 9px", fontWeight: 700 }}>CARD 0{i + 1}</span>
            <span style={{ opacity: 0.85 }}>{r.kind.toUpperCase()}</span>
            <span style={{ color: COLORS.orange, fontWeight: 700 }}>{bad ? "● MISMATCH" : "○ SCANNING"}</span>
          </div>
        );
      })}

      {/* headlines */}
      <div style={{ position: "absolute", top: 228, left: 72, fontFamily: MONO, fontSize: 22, letterSpacing: "0.16em", color: COLORS.ivory, opacity: f >= 48 ? 0.75 : 0 }}>
        {f < 92 ? "EXHIBIT A" : f < 140 ? "EXHIBIT B" : "EXHIBIT C"}
      </div>
      <SlamWord plate={COLORS.midnightDeep} text="WRONG" start={48} dur={42} size={150} top={262} left={64} />
      <SlamWord plate={COLORS.midnightDeep} text="MATERIAL." start={52} dur={38} size={150} top={396} left={64} color={COLORS.orange} />
      <SlamWord plate={COLORS.midnightDeep} text="CLASHING" start={92} dur={46} size={150} top={262} left={64} />
      <SlamWord plate={COLORS.midnightDeep} text="TEXTURES." start={96} dur={42} size={150} top={396} left={64} color={COLORS.orange} />
      <SlamWord plate={COLORS.midnightDeep} text="ZERO" start={140} dur={40} size={150} top={262} left={64} exit={false} />
      <SlamWord plate={COLORS.midnightDeep} text="COORDINATION." start={144} dur={36} size={116} top={396} left={64} color={COLORS.orange} exit={false} />

      <ChapterTag n="03" title="The Investigation · Case #0317" start={2} dur={44} />
      <Vignette strength={0.5} />
      <FilmGrain opacity={0.07} />
    </AbsoluteFill>
  );
};
