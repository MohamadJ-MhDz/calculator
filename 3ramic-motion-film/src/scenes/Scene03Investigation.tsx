import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand";
import { E, hash, kf, lerp, prog, V3 } from "../anim";
import { Cam, flat, KeyLight, StudioEnv, DPR } from "../three/kit";
import { RoomModel } from "../three/RoomModel";
import { TileCharacter } from "../three/TileCharacter";
import { TexKey } from "../three/textures";
import { project, toWorld } from "../three/project";
import { Callout } from "../ui/Callout";
import { ChapterTag, FilmGrain, SlamWord, Vignette } from "../ui/Overlays";
import { MONO, DISPLAY } from "../fonts";

/**
 * SCENE 03 — THE INVESTIGATION (11–17 s)
 * The apartment splits into three floating miniature rooms. A forensic pass
 * exposes wrong materials, clashing textures and zero coordination.
 * The tiles protest with tiny picket signs.
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

/** Camera director: overview -> exhibit A -> exhibit B -> pull back. */
const camera = (f: number, centers: V3[]) => {
  const overviewPos: V3 = [10.5, 10.1, 19];
  const overviewTarget: V3 = [0, 1.6, 0];
  const topPos: V3 = [0, 23, 3.2];
  const a = centers[0];
  const b = centers[2];
  const exA: V3 = [a[0] + 7.5, a[1] + 6.0, a[2] + 12.5];
  const exB: V3 = [b[0] + 3.5, b[1] + 8.5, b[2] + 13];
  const tA: V3 = [a[0], a[1] + 1.9, a[2]];
  const tB: V3 = [b[0], b[1] + 1.9, b[2]];
  const shots: { at: number; pos: V3; target: V3; fov: number }[] = [
    { at: 0, pos: topPos, target: [0, 0, 0], fov: 44 },
    { at: SPLIT_END, pos: overviewPos, target: overviewTarget, fov: 38 },
    { at: 50, pos: exA, target: tA, fov: 34 },
    { at: 80, pos: [exA[0] - 0.9, exA[1] + 0.2, exA[2] - 0.7], target: tA, fov: 33 },
    { at: 94, pos: exB, target: tB, fov: 34 },
    { at: 124, pos: [exB[0] + 0.9, exB[1] - 0.2, exB[2] - 0.6], target: tB, fov: 33 },
    { at: 140, pos: [11.2, 11.2, 22.5], target: [0, 2.9, 0], fov: 38 },
    { at: 180, pos: [10.2, 10.8, 23.5], target: [0, 2.9, 0], fov: 38 },
  ];
  for (let i = 0; i < shots.length - 1; i++) {
    const s0 = shots[i];
    const s1 = shots[i + 1];
    if (f >= s0.at && f <= s1.at) {
      const snappy = s1.at - s0.at <= 16 || i === 0 ? E.inOutExpo : E.inOutSine;
      const t = snappy((f - s0.at) / (s1.at - s0.at));
      const l = (x: V3, y: V3): V3 => [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)];
      return { pos: l(s0.pos, s1.pos), target: l(s0.target, s1.target), fov: lerp(s0.fov, s1.fov, t) };
    }
  }
  const last = shots[shots.length - 1];
  return { pos: last.pos, target: last.target, fov: last.fov };
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
  const cam = camera(f, centers);
  const P = (roomIdx: number, local: V3) => project(cam.pos, cam.target, cam.fov, toWorld(local, pos[roomIdx], rot[roomIdx]));

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
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      {/* blueprint field */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(142,152,163,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(142,152,163,0.10) 1px, transparent 1px), linear-gradient(rgba(142,152,163,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(142,152,163,0.05) 1px, transparent 1px)`,
          backgroundSize: "270px 270px, 270px 270px, 54px 54px, 54px 54px",
          backgroundPosition: `${-f * 0.6}px ${-f * 1.2}px`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(255,112,61,0.07), rgba(0,0,0,0) 70%)" }} />

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
            counter={r.kind === "kitchen" ? "pool" : "terrazzo"}
            floor={(a, b) => ({
              a: r.floor,
              jitter: r.kind === "bathroom" && vib ? (hash(f * 13 + a * 5 + b) - 0.5) * 0.06 : 0,
            })}
            backWall={r.back}
            sideWall={r.side}
            wallTile={r.kind === "living" ? 0.7 : 0.5}
          >
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
      <Callout anchor={P(0, [-1.05, 0.25, 1.25])} label={[90, 1260]} tag="EVIDENCE 02" title="A SWIM RING?" sub="INVESTIGATION ONGOING" start={62} end={90} />
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
        <div style={{ position: "absolute", right: 72, top: 570, textAlign: "right", background: COLORS.charcoal, padding: "10px 18px", fontFamily: MONO, color: COLORS.ivory, opacity: E.outCubic(prog(f, 146, 8)) }}>
          <div style={{ fontSize: 20, letterSpacing: "0.16em", opacity: 0.7 }}>COORDINATION SCORE</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 1, color: COLORS.orange }}>
            {Math.round(kf(f, [146, 162], [87, 12], E.outCubic))}%
          </div>
        </div>
      ) : null}

      {/* headlines */}
      <div style={{ position: "absolute", top: 228, left: 72, fontFamily: MONO, fontSize: 22, letterSpacing: "0.16em", color: COLORS.ivory, opacity: f >= 48 ? 0.75 : 0 }}>
        {f < 92 ? "EXHIBIT A" : f < 140 ? "EXHIBIT B" : "EXHIBIT C"}
      </div>
      <SlamWord plate={COLORS.charcoal} text="WRONG" start={48} dur={42} size={150} top={262} left={64} />
      <SlamWord plate={COLORS.charcoal} text="MATERIAL." start={52} dur={38} size={150} top={396} left={64} color={COLORS.orange} />
      <SlamWord plate={COLORS.charcoal} text="CLASHING" start={92} dur={46} size={150} top={262} left={64} />
      <SlamWord plate={COLORS.charcoal} text="TEXTURES." start={96} dur={42} size={150} top={396} left={64} color={COLORS.orange} />
      <SlamWord plate={COLORS.charcoal} text="ZERO" start={140} dur={40} size={150} top={262} left={64} exit={false} />
      <SlamWord plate={COLORS.charcoal} text="COORDINATION." start={144} dur={36} size={116} top={396} left={64} color={COLORS.orange} exit={false} />

      <ChapterTag n="03" title="The Investigation · Case #0317" start={2} dur={44} />
      <Vignette strength={0.5} />
      <FilmGrain opacity={0.07} />
    </AbsoluteFill>
  );
};
