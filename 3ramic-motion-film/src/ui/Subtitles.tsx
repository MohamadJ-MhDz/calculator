import React from "react";
import { useCurrentFrame } from "remotion";
import { UI } from "../config/brand";
import { SAFE } from "../config/art";
import { PERSIAN } from "../fonts";
import { E, prog } from "../anim";
import { LINES, Line, Phrase } from "../timeline";

/**
 * Persian subtitles, burned in for sound-off viewing.
 *
 * - Text and timing come straight from the timeline, i.e. from the recorded speech:
 *   a phrase is on screen while it is being said, and each word brightens when it is
 *   actually spoken (word timing from the alignment data).
 * - Right-to-left with dir="rtl" + lang="fa"; the browser's text engine shapes the
 *   letters. Words are animated whole, never letter by letter, so letters stay joined
 *   and half-spaces (ZWNJ) stay inside their words.
 * - The block sits inside the Instagram safe area (above the caption/buttons zone).
 */

const TOP = 1300;

const PhraseView: React.FC<{ l: Line; p: Phrase; f: number; wordStart: number }> = ({ l, p, f, wordStart }) => {
  const words = p.text.split(" ");
  const inP = E.outCubic(prog(f, p.from, 4));
  const outP = E.inCubic(prog(f, p.to - 3, 3));
  // spoken words of this phrase, when the written and the spoken word counts agree
  const spoken = l.words.slice(wordStart, wordStart + words.length);
  const timed = spoken.length === words.length;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        right: 1080 - SAFE.right,
        top: TOP,
        height: SAFE.bottom - TOP,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        opacity: inP * (1 - outP),
        translate: `0 ${(1 - inP) * 16}px`,
      }}
    >
      <div
        dir="rtl"
        lang="fa"
        style={{
          maxWidth: 840,
          padding: "14px 34px 20px 34px",
          borderRadius: 20,
          background: UI.surface,
          boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
          fontFamily: PERSIAN,
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.5,
          color: UI.onSurface,
          textAlign: "center",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.26em",
        }}
      >
        {words.map((w, i) => {
          const said = timed ? f >= spoken[i].from - 1 : f >= p.from + (i / words.length) * (p.to - p.from - 8);
          return (
            <span key={i} style={{ display: "inline-block", opacity: said ? 1 : 0.42 }}>
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Place once at film level; it reads the absolute film frame. */
export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  for (const l of LINES) {
    if (!l.subtitle) continue;
    let wordStart = 0;
    for (const p of l.phrases) {
      const n = p.text.split(" ").length;
      if (f >= p.from && f < p.to) return <PhraseView l={l} p={p} f={f} wordStart={wordStart} />;
      wordStart += n;
    }
  }
  return null;
};
