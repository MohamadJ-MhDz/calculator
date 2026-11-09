import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../brand";
import { MONO, DISPLAY } from "../fonts";
import { E, prog } from "../anim";

/**
 * Investigation callout: pulsing pin on a projected 3D anchor, a leader line that
 * draws on, and a label that types in.
 */
export const Callout: React.FC<{
  anchor: [number, number];
  label: [number, number];
  tag: string;
  title: string;
  sub?: string;
  start: number;
  end?: number;
  color?: string;
  ink?: string;
  align?: "left" | "right";
}> = ({ anchor, label, tag, title, sub, start, end = 9999, color = COLORS.orange, ink = COLORS.ivory, align = "left" }) => {
  const f = useCurrentFrame();
  if (f < start || f > end) return null;
  const p = E.outCubic(prog(f, start, 12));
  const out = E.inCubic(prog(f, end - 8, 8));
  const elbow: [number, number] = [label[0], anchor[1] + (label[1] - anchor[1]) * 0.0];
  const pts = [anchor, [elbow[0] + (anchor[0] - elbow[0]) * 0.35, label[1]] as [number, number], label];
  const len =
    Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) + Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const typed = Math.floor(title.length * E.linear(prog(f, start + 8, 12)));
  const pulse = (f - start) % 24;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out, pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <polyline
          points={pts.map((q) => q.join(",")).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={len}
          strokeDashoffset={len * (1 - p)}
        />
        <circle cx={anchor[0]} cy={anchor[1]} r={9} fill={color} />
        <circle cx={anchor[0]} cy={anchor[1]} r={9 + pulse * 1.4} fill="none" stroke={color} strokeWidth={2.5} opacity={1 - pulse / 24} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: label[1] - 30,
          left: align === "left" ? label[0] + 14 : undefined,
          right: align === "right" ? 1080 - label[0] + 14 : undefined,
          textAlign: align,
          opacity: E.outCubic(prog(f, start + 6, 8)),
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "0.18em",
            color: COLORS.charcoal,
            background: color,
            padding: "4px 10px",
            marginBottom: 8,
          }}
        >
          {tag}
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, color: ink, letterSpacing: "-0.02em", lineHeight: 1 }}>
          {title.slice(0, typed)}
          {typed < title.length ? <span style={{ color }}>▍</span> : null}
        </div>
        {sub ? (
          <div style={{ fontFamily: MONO, fontSize: 19, color: ink, opacity: 0.7, marginTop: 8, letterSpacing: "0.08em" }}>{sub}</div>
        ) : null}
      </div>
    </div>
  );
};
