import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BRAND, UI } from "../config/brand";
import { ART, SAFE } from "../config/art";
import { LATIN, PERSIAN, PERSIAN_DISPLAY } from "../fonts";
import { clamp, E, lerp, prog } from "../anim";

/**
 * All 2D graphics of the film. Persian is the language of every message on screen; the
 * only Latin text is the brand name and the web address. Colours come from UI tokens
 * (src/config/brand.ts): neutral ink and paper until the official palette is verified.
 * Every component takes the film frame `f` and its own cue frames — nothing is timed
 * by wall-clock or CSS animation.
 */

/* ------------------------------------------------------------------ */
/* The resignation letter, stuck to the lens                            */
/* ------------------------------------------------------------------ */

export const PaperOnLens: React.FC<{ f: number; hit: number; peel: number; clear: number }> = ({ f, hit, peel, clear }) => {
  if (f < hit || f >= clear) return null;
  const arrive = E.outBack(prog(f, hit, 3), 1.6);
  const slide = E.inCubic(prog(f, peel, clear - peel));
  // stick–slip: it judders a little as it lets go of the glass
  const judder = f >= peel ? Math.sin((f - peel) * 2.4) * 7 * (1 - slide) : 0;
  const y = slide * 2150 + judder;
  const rot = lerp(-6, -15, slide);
  const scale = lerp(0.35, 1, arrive);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 380,
          width: 780,
          height: 1040,
          background: ART.paper,
          borderRadius: 10,
          boxShadow: "0 40px 90px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.6) inset",
          transform: `translateY(${y}px) rotate(${rot}deg) scale(${scale})`,
          transformOrigin: "50% 45%",
          padding: "86px 70px",
          boxSizing: "border-box",
        }}
      >
        <div dir="rtl" lang="fa" style={{ fontFamily: PERSIAN_DISPLAY, fontSize: 168, lineHeight: 1.1, color: UI.onPaper, textAlign: "center" }}>
          استعفانامه
        </div>
        <div style={{ height: 8, background: UI.onPaper, margin: "26px 40px 54px" }} />
        {[1, 0.92, 0.97, 0.6].map((w, i) => (
          <div key={i} style={{ height: 20, width: `${w * 100}%`, marginLeft: `${(1 - w) * 100}%`, background: UI.paperShade, borderRadius: 10, marginBottom: 40 }} />
        ))}
        <div dir="rtl" lang="fa" style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 54, fontFamily: PERSIAN, fontWeight: 700, fontSize: 46, color: UI.onPaper }}>
          <span>امضا:</span>
          {/* signed with a tile */}
          <div style={{ width: 120, height: 120, border: `8px solid ${UI.onPaper}`, borderRadius: 14, position: "relative", rotate: "-8deg" }}>
            <div style={{ position: "absolute", left: 24, top: 34, width: 20, height: 26, borderRadius: 12, background: UI.onPaper }} />
            <div style={{ position: "absolute", right: 24, top: 34, width: 20, height: 26, borderRadius: 12, background: UI.onPaper }} />
            <div style={{ position: "absolute", left: 34, bottom: 22, width: 36, height: 8, borderRadius: 4, background: UI.onPaper }} />
          </div>
          <span style={{ fontWeight: 800 }}>یه سرامیکِ خسته</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Case-file stamp and suspect tags                                     */
/* ------------------------------------------------------------------ */

export const CaseStamp: React.FC<{ f: number; from: number; to: number }> = ({ f, from, to }) => {
  if (f < from || f >= to) return null;
  const p = prog(f, from, 5);
  const scale = 1.7 - 0.7 * E.outBack(p, 1.3);
  const out = E.inCubic(prog(f, to - 5, 5));
  return (
    <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        dir="rtl"
        lang="fa"
        style={{
          rotate: "-4deg",
          scale: String(scale),
          opacity: Math.min(1, p * 3) * (1 - out),
          background: UI.surface,
          color: UI.onSurface,
          border: `6px solid ${UI.onSurface}`,
          outline: `6px solid ${UI.surface}`,
          borderRadius: 16,
          padding: "10px 40px 18px",
          textAlign: "center",
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontFamily: PERSIAN, fontWeight: 700, fontSize: 38, opacity: 0.8 }}>پروندهٔ</div>
        <div style={{ fontFamily: PERSIAN_DISPLAY, fontSize: 96, lineHeight: 1.15 }}>استعفای سرامیک‌ها</div>
      </div>
    </div>
  );
};

/** «مظنونِ ۱ — طرحِ شلوغ»: names the design problem for sound-off viewers. */
export const SuspectTag: React.FC<{ f: number; from: number; to: number; n: string; label: string }> = ({ f, from, to, n, label }) => {
  if (f < from || f >= to) return null;
  const inP = E.outExpo(prog(f, from, 9));
  const out = E.inCubic(prog(f, to - 5, 5));
  return (
    <div
      dir="rtl"
      lang="fa"
      style={{
        position: "absolute",
        top: SAFE.top + 24,
        right: SAFE.left,
        display: "flex",
        alignItems: "stretch",
        opacity: (1 - out) * Math.min(1, inP * 2),
        translate: `${(1 - inP) * 220 + out * 120}px 0`,
        transform: `skewX(${(1 - inP) * 10}deg)`,
        boxShadow: "0 16px 36px rgba(0,0,0,0.32)",
        borderRadius: 16,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div style={{ background: UI.onSurface, color: UI.surface, padding: "8px 26px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: PERSIAN, fontWeight: 800, fontSize: 30, lineHeight: 1.2 }}>مظنونِ</div>
        <div style={{ fontFamily: PERSIAN_DISPLAY, fontSize: 84, lineHeight: 1 }}>{n}</div>
      </div>
      <div style={{ background: UI.surface, color: UI.onSurface, padding: "12px 36px 20px", display: "flex", alignItems: "center", fontFamily: PERSIAN_DISPLAY, fontSize: 82, lineHeight: 1.15, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Before / after comparison                                            */
/* ------------------------------------------------------------------ */

/** Divider handle and labels for the same-angle comparison. `x` is the divider position in px. */
export const CompareOverlay: React.FC<{ x: number; show: number }> = ({ x, show }) => {
  if (show <= 0.01) return null;
  const chip = (text: string, side: "before" | "after"): React.ReactNode => (
    <div
      dir="rtl"
      lang="fa"
      style={{
        position: "absolute",
        top: SAFE.top + 40,
        ...(side === "before" ? { right: 1080 - x + 26 } : { left: x + 26 }),
        background: side === "before" ? UI.surface : UI.paper,
        color: side === "before" ? UI.onSurface : UI.onPaper,
        fontFamily: PERSIAN_DISPLAY,
        fontSize: 76,
        lineHeight: 1.15,
        padding: "4px 34px 12px",
        borderRadius: 14,
        boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
        opacity: show,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x - 4, top: 0, bottom: 0, width: 8, background: UI.paper, boxShadow: "0 0 24px rgba(0,0,0,0.45)", opacity: show }} />
      <div
        style={{
          position: "absolute",
          left: x - 46,
          top: 900,
          width: 92,
          height: 92,
          borderRadius: 46,
          background: UI.paper,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          opacity: show,
        }}
      >
        <div style={{ width: 0, height: 0, borderTop: "13px solid transparent", borderBottom: "13px solid transparent", borderRight: `18px solid ${UI.onPaper}` }} />
        <div style={{ width: 0, height: 0, borderTop: "13px solid transparent", borderBottom: "13px solid transparent", borderLeft: `18px solid ${UI.onPaper}` }} />
      </div>
      {x > 230 ? chip("قبل", "before") : null}
      {x < 850 ? chip("بعد", "after") : null}
      <div style={{ position: "absolute", top: SAFE.top + 190, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: show }}>
        <div dir="rtl" lang="fa" style={{ background: UI.surface, color: UI.onSurface, fontFamily: PERSIAN, fontWeight: 800, fontSize: 46, padding: "8px 30px 12px", borderRadius: 40, boxShadow: "0 10px 24px rgba(0,0,0,0.3)" }}>
          همون ۶ متر
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Brand close                                                          */
/* ------------------------------------------------------------------ */

/**
 * The logo slot. With BRAND.logo.file set, the official asset is shown untouched (no
 * recolouring, no distortion). Without it, the exact brand name is set as plain text in
 * the film's own text face — a stand-in, deliberately not a designed mark.
 */
export const LogoSlot: React.FC<{ width?: number }> = ({ width = BRAND.logo.width }) => {
  if (BRAND.logo.file) {
    return <Img src={staticFile(BRAND.logo.file)} style={{ width, height: "auto", display: "block" }} />;
  }
  return (
    <div dir="ltr" style={{ fontFamily: LATIN, fontWeight: 800, fontSize: width * 0.33, lineHeight: 1, letterSpacing: "0", color: UI.onPaper }}>
      {BRAND.name}
    </div>
  );
};

export const BrandLockup: React.FC<{ f: number; nameAt: number; taglineAt: number; ctaAt: number }> = ({ f, nameAt, taglineAt, ctaAt }) => {
  if (f < nameAt - 6) return null;
  const card = E.outCubic(prog(f, nameAt - 6, 10));
  const name = E.outExpo(prog(f, nameAt, 12));
  const tag = E.outCubic(prog(f, taglineAt, 10));
  const cta = E.outCubic(prog(f, ctaAt, 10));
  const accent = UI.accent ?? UI.onPaper;
  return (
    <div style={{ position: "absolute", top: SAFE.top + 20, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          width: 800,
          background: UI.paper,
          borderRadius: 34,
          boxShadow: "0 30px 70px rgba(30,24,16,0.28)",
          padding: `${BRAND.logo.width * BRAND.logo.clearSpace}px 50px 46px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: card,
          translate: `0 ${(1 - card) * -40}px`,
        }}
      >
        <div style={{ opacity: clamp(name * 1.5), translate: `0 ${(1 - name) * 26}px`, scale: String(0.94 + 0.06 * name) }}>
          <LogoSlot />
        </div>
        <div style={{ width: lerp(0, 150, tag), height: 6, borderRadius: 3, background: accent, margin: "30px 0 20px" }} />
        <div dir="rtl" lang="fa" style={{ fontFamily: PERSIAN, fontWeight: 800, fontSize: 70, lineHeight: 1.45, color: UI.onPaper, opacity: tag, translate: `0 ${(1 - tag) * 20}px`, textAlign: "center" }}>
          {BRAND.taglineFa}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 30, opacity: cta, translate: `0 ${(1 - cta) * 18}px` }}>
          <div dir="ltr" style={{ fontFamily: LATIN, fontWeight: 800, fontSize: 50, color: UI.onSurface, background: UI.surface, borderRadius: 60, padding: "10px 38px 14px" }}>
            {BRAND.website}
          </div>
          <div dir="rtl" lang="fa" style={{ fontFamily: PERSIAN, fontWeight: 700, fontSize: 44, color: UI.onPaper }}>
            {BRAND.ctaFa}
          </div>
        </div>
      </div>
    </div>
  );
};
