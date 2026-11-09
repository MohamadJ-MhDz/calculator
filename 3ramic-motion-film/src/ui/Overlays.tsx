import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { COLORS } from "../brand";
import { MONO, DISPLAY } from "../fonts";
import { clamp, E, hash, prog } from "../anim";

/** Deterministic film grain (pre-baked noise tile, jittered per frame). <Img> blocks rendering until loaded. */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const ox = Math.floor(hash(frame) * 256);
  const oy = Math.floor(hash(frame + 99) * 256);
  const tiles: React.ReactNode[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 6; x++) {
      tiles.push(
        <Img key={`${x}-${y}`} src={staticFile("textures/grain.png")} style={{ position: "absolute", left: x * 256, top: y * 256, width: 256, height: 256 }} />,
      );
    }
  }
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -ox, top: -oy, width: 6 * 256, height: 9 * 256 }}>{tiles}</div>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 60% at 50% 48%, rgba(0,0,0,0) 55%, rgba(5,8,12,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Small editorial chapter tag: "Nº 01 — THE INCIDENT". */
export const ChapterTag: React.FC<{ n: string; title: string; start?: number; dur?: number; dark?: boolean }> = ({
  n,
  title,
  start = 0,
  dur = 90,
  dark = false,
}) => {
  const f = useCurrentFrame();
  const inP = E.outExpo(prog(f, start, 14));
  const outP = E.inCubic(prog(f, start + dur - 10, 10));
  const col = dark ? COLORS.charcoal : COLORS.ivory;
  return (
    <div
      style={{
        position: "absolute",
        top: 132,
        left: 72,
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: MONO,
        fontSize: 24,
        letterSpacing: "0.16em",
        color: col,
        opacity: inP * (1 - outP),
        textTransform: "uppercase",
      }}
    >
      <div style={{ width: 14, height: 14, background: COLORS.orange, rotate: `${(1 - inP) * 90}deg` }} />
      <span style={{ fontWeight: 700 }}>Nº {n}</span>
      <div style={{ width: 70 * inP, height: 2, background: col, opacity: 0.6 }} />
      <span style={{ clipPath: `inset(0 ${(1 - inP) * 100}% 0 0)` }}>{title}</span>
    </div>
  );
};

/** Big kinetic word with a masked slide + skew settle. */
export const SlamWord: React.FC<{
  text: string;
  start: number;
  dur?: number;
  size?: number;
  color?: string;
  top?: number;
  left?: number;
  right?: number;
  align?: "left" | "right" | "center";
  font?: string;
  weight?: number;
  italic?: boolean;
  from?: "bottom" | "top" | "left" | "right";
  letterSpacing?: string;
  exit?: boolean;
  outline?: boolean;
  plate?: string;
}> = ({
  text,
  start,
  dur = 60,
  size = 160,
  color = COLORS.ivory,
  top = 400,
  left,
  right,
  align = "left",
  font = DISPLAY,
  weight = 800,
  italic = false,
  from = "bottom",
  letterSpacing = "-0.045em",
  exit = true,
  outline = false,
  plate,
}) => {
  const f = useCurrentFrame();
  const p = E.outExpo(prog(f, start, 16));
  const o = exit ? E.inExpo(prog(f, start + dur - 10, 10)) : 0;
  if (f < start || (exit && f > start + dur)) return null;
  const off = (1 - p) * 110 + o * -110;
  const tr =
    from === "bottom" ? `0 ${off}%` : from === "top" ? `0 ${-off}%` : from === "left" ? `${-off}% 0` : `${off}% 0`;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: left ?? (align === "center" ? 0 : undefined),
        right: right ?? (align === "center" ? 0 : undefined),
        textAlign: align,
        overflow: "hidden",
        lineHeight: 0.92,
        paddingBottom: size * 0.08,
      }}
    >
      <div
        style={{
          translate: tr,
          transform: `skewX(${(1 - p) * -10}deg)`,
          fontFamily: font,
          fontWeight: weight,
          fontStyle: italic ? "italic" : "normal",
          fontSize: size,
          letterSpacing,
          color: outline ? "transparent" : color,
          WebkitTextStroke: outline ? `3px ${color}` : undefined,
          whiteSpace: "pre",
          background: plate,
          padding: plate ? `${size * 0.02}px ${size * 0.12}px ${size * 0.08}px` : undefined,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** CCTV surveillance overlay. */
export const CCTVHud: React.FC<{ opacity: number; glitch?: number; startSeconds?: number }> = ({
  opacity,
  glitch = 0,
  startSeconds = 3 * 3600 + 16 * 60 + 59,
}) => {
  const f = useCurrentFrame();
  if (opacity <= 0.001) return null;
  // rolls over to 03:17:00 on frame 16 — the same frame the in-scene clock flips
  const secs = startSeconds + Math.floor((f + 14) / 30);
  const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const ff = String((f + 14) % 30).padStart(2, "0");
  const recOn = Math.floor(f / 15) % 2 === 0;
  const jitter = glitch > 0 ? (hash(f) - 0.5) * 40 * glitch : 0;
  const corner = (pos: React.CSSProperties, rot: number) => (
    <div
      style={{
        position: "absolute",
        width: 90,
        height: 90,
        borderTop: `4px solid ${COLORS.ivory}`,
        borderLeft: `4px solid ${COLORS.ivory}`,
        rotate: `${rot}deg`,
        opacity: 0.85,
        ...pos,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity, translate: `${jitter}px 0`, pointerEvents: "none" }}>
      {/* scanlines */}
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)",
          mixBlendMode: "multiply",
        }}
      />
      {corner({ top: 110, left: 60 }, 0)}
      {corner({ top: 110, right: 60 }, 90)}
      {corner({ bottom: 170, right: 60 }, 180)}
      {corner({ bottom: 170, left: 60 }, 270)}
      <div style={{ position: "absolute", top: 140, left: 92, fontFamily: MONO, color: COLORS.ivory, fontSize: 30, letterSpacing: "0.08em" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 700 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: recOn ? "#FF3B2F" : "transparent", border: "3px solid #FF3B2F" }} />
          REC
        </div>
        <div style={{ marginTop: 10, opacity: 0.85, fontSize: 24 }}>CAM 02 · LIVING ROOM</div>
      </div>
      <div style={{ position: "absolute", top: 140, right: 92, fontFamily: MONO, color: COLORS.ivory, fontSize: 26, textAlign: "right", letterSpacing: "0.06em" }}>
        <div>2026-11-09</div>
        <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>
          {hh}:{mm}:{ss}
          <span style={{ opacity: 0.55, fontSize: 24 }}>.{ff}</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 200, left: 92, fontFamily: MONO, color: COLORS.ivory, fontSize: 20, opacity: 0.7, letterSpacing: "0.1em" }}>
        IR · F/1.6 · MOTION: {f > 26 ? <span style={{ color: COLORS.orange, fontWeight: 700 }}>DETECTED</span> : "NONE"}
      </div>
      {glitch > 0.05 ? (
        <AbsoluteFill>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${hash(f * 7 + i) * 100}%`,
                height: 6 + hash(f + i * 3) * 40,
                background: i % 2 ? "rgba(255,112,61,0.25)" : "rgba(242,237,228,0.18)",
                translate: `${(hash(f + i) - 0.5) * 200 * glitch}px 0`,
                opacity: glitch,
              }}
            />
          ))}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Signature transition: the frame is re-tiled. A grid of ceramic tiles flips in
 * (covering the outgoing shot), the cut happens underneath, then they flip away.
 */
export const TileWipe: React.FC<{
  at: number;
  half?: number;
  cols?: number;
  palette?: string[];
  origin?: "tl" | "br" | "center" | "bottom";
}> = ({ at, half = 12, cols = 6, palette = [COLORS.charcoal, COLORS.charcoalSoft, COLORS.orange, COLORS.ivory], origin = "tl" }) => {
  const f = useCurrentFrame();
  if (f < at - half - 2 || f > at + half + 2) return null;
  const cell = 1080 / cols;
  const rows = Math.ceil(1920 / cell);
  const flipDur = half * 0.55;
  const cells: React.ReactNode[] = [];
  const maxD = origin === "center" ? Math.hypot(cols / 2, rows / 2) : origin === "bottom" ? rows : cols + rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let d: number;
      if (origin === "tl") d = (c + r) / maxD;
      else if (origin === "br") d = (cols - 1 - c + rows - 1 - r) / maxD;
      else if (origin === "bottom") d = (rows - 1 - r) / maxD;
      else d = Math.hypot(c + 0.5 - cols / 2, r + 0.5 - rows / 2) / maxD;
      d = clamp(d * 0.85 + hash(r * 31 + c) * 0.15);
      const delay = d * (half - flipDur);
      let ang: number;
      let sc = 1;
      if (f < at) {
        const p = E.outCubic(clamp((f - (at - half) - delay) / flipDur));
        ang = 90 * (1 - p);
        sc = 0.7 + 0.3 * p;
      } else {
        const p = E.inCubic(clamp((f - at - delay) / flipDur));
        ang = -90 * p;
        sc = 1 - 0.3 * p;
      }
      if (Math.abs(ang) >= 89.9) continue;
      const pick = hash(r * 13 + c * 7);
      const col = pick < 0.12 ? palette[2] : pick < 0.2 ? palette[3] : pick < 0.6 ? palette[0] : palette[1];
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: c * cell,
            top: r * cell,
            width: cell + 1,
            height: cell + 1,
            transform: `perspective(900px) rotateY(${ang}deg) scale(${sc})`,
            background: col,
            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25), inset 0 3px 0 rgba(255,255,255,0.08)",
          }}
        />,
      );
    }
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{cells}</AbsoluteFill>;
};

/** Brief exposure flash used on impacts. */
export const Flash: React.FC<{ at: number; dur?: number; color?: string; max?: number }> = ({ at, dur = 8, color = "#fff", max = 0.6 }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, dur);
  if (f < at || f > at + dur) return null;
  return <AbsoluteFill style={{ background: color, opacity: max * (1 - E.outCubic(p)), pointerEvents: "none" }} />;
};

/** Thin registration marks / safe frame used in UI scenes. */
export const FrameMarks: React.FC<{ color?: string; opacity?: number }> = ({ color = COLORS.charcoal, opacity = 0.5 }) => (
  <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
    {[
      { top: 60, left: 60 },
      { top: 60, right: 60 },
      { bottom: 60, left: 60 },
      { bottom: 60, right: 60 },
    ].map((p, i) => (
      <div key={i} style={{ position: "absolute", width: 28, height: 28, ...p }}>
        <div style={{ position: "absolute", left: 13, top: 0, width: 2, height: 28, background: color }} />
        <div style={{ position: "absolute", top: 13, left: 0, height: 2, width: 28, background: color }} />
      </div>
    ))}
  </AbsoluteFill>
);
