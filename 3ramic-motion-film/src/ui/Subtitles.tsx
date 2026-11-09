import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../brand";
import { PERSIAN } from "../fonts";
import { E, prog } from "../anim";
import cueSheet from "../../public/subtitles/narration-fa.json";

/**
 * Persian RTL subtitles.
 * - Base direction set with dir="rtl" + lang="fa" on the line container.
 * - Animated per WORD (never per letter), so Chrome's HarfBuzz shaping keeps
 *   every Persian letter joined; ZWNJ (U+200C) stays inside its word.
 * - Timing comes from public/subtitles/narration-fa.json (also exported as SRT).
 */

export type Cue = {
  id: number;
  from: number;
  to: number;
  text: string;
  highlight: string[];
  voice: "narrator" | "tiles" | "endcard";
};

export const CUES = cueSheet.cues as Cue[];

const Line: React.FC<{ cue: Cue; f: number }> = ({ cue, f }) => {
  const words = cue.text.split(" ");
  const dur = cue.to - cue.from;
  const inP = E.outCubic(prog(f, cue.from, 6));
  const outP = E.inCubic(prog(f, cue.to - 6, 6));
  const tiles = cue.voice === "tiles";
  const revealSpan = Math.max(8, dur * 0.55);
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 1405,
        display: "flex",
        justifyContent: "center",
        opacity: inP * (1 - outP),
        translate: `0 ${(1 - inP) * 18 + outP * -10}px`,
      }}
    >
      <div
        dir="rtl"
        lang="fa"
        style={{
          position: "relative",
          maxWidth: 940,
          padding: "16px 36px 22px 36px",
          borderRadius: 22,
          background: tiles ? COLORS.orange : "rgba(18,24,32,0.82)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
          fontFamily: PERSIAN,
          fontWeight: tiles ? 900 : 700,
          fontSize: 54,
          lineHeight: 1.55,
          color: tiles ? COLORS.charcoal : COLORS.ivory,
          textAlign: "center",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.28em",
        }}
      >
        {/* accent bar on the RTL start side */}
        <div style={{ position: "absolute", right: 0, top: 22, bottom: 22, width: 6, borderRadius: 3, background: tiles ? COLORS.charcoal : COLORS.orange }} />
        {words.map((w, i) => {
          const t0 = cue.from + (i / words.length) * revealSpan;
          const p = E.outCubic(prog(f, t0, 7));
          const hi = cue.highlight.includes(w);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: 0.15 + 0.85 * p,
                translate: `0 ${(1 - p) * 14}px`,
                color: hi ? (tiles ? COLORS.ivory : COLORS.orange) : undefined,
              }}
            >
              {w}
            </span>
          );
        })}
        {tiles ? (
          <div style={{ position: "absolute", bottom: -16, right: 90, width: 0, height: 0, borderLeft: "16px solid transparent", borderRight: "16px solid transparent", borderTop: `18px solid ${COLORS.orange}` }} />
        ) : null}
      </div>
    </div>
  );
};

export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const cue = CUES.find((c) => c.voice !== "endcard" && f >= c.from && f < c.to);
  if (!cue) return null;
  return <Line cue={cue} f={f} />;
};
