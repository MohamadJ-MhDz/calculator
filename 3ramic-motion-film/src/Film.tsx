import React from "react";
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, COLORS, END_CARD_AT, SCENES } from "./brand";
import { DISPLAY, MONO, SERIF } from "./fonts";
import { E, prog } from "./anim";
import { Scene01Incident } from "./scenes/Scene01Incident";
import { Scene02Resignation } from "./scenes/Scene02Resignation";
import { Scene03Investigation } from "./scenes/Scene03Investigation";
import { Scene04System } from "./scenes/Scene04System";
import { Scene05Transformation } from "./scenes/Scene05Transformation";
import { Scene06Ending } from "./scenes/Scene06Ending";
import { EditFX, GlitchHit, TileWipe, Whip } from "./ui/Overlays";
import { S1_CUT } from "./scenes/Scene01Incident";
import { SHOT_B, SHOT_C } from "./scenes/Scene02Resignation";
import { CUT_A, CUT_B, CUT_C } from "./scenes/Scene03Investigation";
import { MACRO_FROM, MACRO_LEN } from "./scenes/Scene05Transformation";
import { Subtitles } from "./ui/Subtitles";
import { SoundDesign } from "./audio/SoundDesign";

export type FilmProps = {
  readonly showSubtitles: boolean;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly narrationVolume: number;
};

/** Title card that rides over the tile-flip transition between scenes 02 and 03. */
const TitleCard: React.FC = () => {
  const f = useCurrentFrame();
  if (f < 0 || f > 44) return null;
  const inP = E.outExpo(prog(f, 0, 12));
  const out = E.inExpo(prog(f, 34, 10));
  const [a, b] = ["THE FLOOR", "THAT QUIT"];
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 30% at 50% 50%, rgba(12,16,22,0.88), rgba(12,16,22,0) 100%)",
          opacity: inP * (1 - out),
        }}
      />
      <div
        style={{
          textAlign: "center",
          opacity: 1 - out,
          scale: String(1 + out * 0.08),
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            letterSpacing: "0.3em",
            color: COLORS.orange,
            marginBottom: 18,
            opacity: inP,
          }}
        >
          A 3RAMIC FILM
        </div>
        {[a, b].map((line, i) => (
          <div
            key={line}
            style={{ overflow: "hidden", lineHeight: 0.92, paddingBottom: 10 }}
          >
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: 158,
                letterSpacing: "-0.05em",
                color: i === 1 ? COLORS.orange : COLORS.ivory,
                translate: `0 ${(1 - E.outExpo(prog(f, i * 3, 12))) * 105}%`,
                textShadow: "0 10px 40px rgba(0,0,0,0.35)",
              }}
            >
              {line}
            </div>
          </div>
        ))}
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 54,
            color: COLORS.ivory,
            marginTop: 10,
            opacity: E.outCubic(prog(f, 10, 10)),
          }}
        >
          or: a bad case of wrong rooms
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Ivory sheet with an orange scan line sweeping down into the 3ramic system scene. */
const ScanWipe: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const p = E.inOutCubic(prog(f, 0, dur));
  const y = p * 1920;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: y,
          background: COLORS.ivory,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y - 3,
          height: 6,
          background: COLORS.orange,
          boxShadow: `0 0 30px 6px rgba(255,112,61,0.55)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          top: Math.max(60, y - 44),
          fontFamily: MONO,
          fontSize: 20,
          letterSpacing: "0.2em",
          color: COLORS.charcoal,
          opacity: p > 0.05 ? 0.8 : 0,
        }}
      >
        SCANNING FOR BETTER MATCHES · {Math.round(p * 100)}%
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- the edit: whip pans and glitch hits (global frames) ---------------- */
const S2 = SCENES.resignation.from;
const S3 = SCENES.investigation.from;
const S5 = SCENES.transformation.from;
const S6 = SCENES.ending.from;

export const WHIPS: Whip[] = [
  { at: S2, half: 4, dir: 1 }, // CCTV wide → the floor stands up
  { at: S2 + SHOT_B, half: 4, dir: -1 }, // room → hallway tracking shot
  { at: S6, half: 4, dir: 1, axis: "y" }, // apartment → the hero comes home
];

export const GLITCHES: GlitchHit[] = [
  { at: 0, dur: 5, amp: 0.8 }, // CCTV feed boots
  { at: S1_CUT, dur: 5, amp: 1 }, // the abrupt cut back to the CCTV wide
  { at: S2 + SHOT_C, dur: 3, amp: 0.7 }, // hallway → doorway
  { at: S3 + CUT_A, dur: 4, amp: 0.8 }, // exhibit A
  { at: S3 + CUT_B, dur: 4, amp: 0.8 }, // exhibit B
  { at: S3 + CUT_C, dur: 4, amp: 0.8 }, // exhibit C
  { at: S5 + MACRO_FROM, dur: 3, amp: 0.6 }, // macro montage: one cut per beat
  { at: S5 + MACRO_FROM + MACRO_LEN, dur: 3, amp: 0.5 },
  { at: S5 + MACRO_FROM + MACRO_LEN * 2, dur: 3, amp: 0.5 },
  { at: S5 + MACRO_FROM + MACRO_LEN * 3, dur: 3, amp: 0.6 }, // …and back to the apartment
];

export const ThreeRamicFilm: React.FC<FilmProps> = ({
  showSubtitles,
  musicVolume,
  sfxVolume,
  narrationVolume,
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: COLORS.charcoal }}>
      {/* ---------------- picture ---------------- */}
      <EditFX whips={WHIPS} glitches={GLITCHES}>
        <Sequence
          name="01 · The Incident"
          from={SCENES.incident.from}
          durationInFrames={SCENES.incident.dur}
          premountFor={fps}
        >
          <Scene01Incident />
        </Sequence>
        <Sequence
          name="02 · The Resignation"
          from={SCENES.resignation.from}
          durationInFrames={SCENES.resignation.dur}
          premountFor={fps}
        >
          <Scene02Resignation />
        </Sequence>
        <Sequence
          name="03 · The Investigation"
          from={SCENES.investigation.from}
          durationInFrames={SCENES.investigation.dur}
          premountFor={fps}
        >
          <Scene03Investigation />
        </Sequence>
        <Sequence
          name="04 · The 3ramic System"
          from={SCENES.system.from}
          durationInFrames={SCENES.system.dur}
          premountFor={fps}
        >
          <Scene04System />
        </Sequence>
        <Sequence
          name="05 · The Transformation"
          from={SCENES.transformation.from}
          durationInFrames={SCENES.transformation.dur}
          premountFor={fps}
        >
          <Scene05Transformation />
        </Sequence>
        <Sequence
          name="06 · The Ending"
          from={SCENES.ending.from}
          durationInFrames={SCENES.ending.dur}
          premountFor={fps}
        >
          <Scene06Ending />
        </Sequence>
      </EditFX>

      {/* ---------------- transitions & titles ---------------- */}
      <TileWipe at={SCENES.investigation.from} half={8} origin="br" />
      <Sequence
        name="Title card"
        from={SCENES.investigation.from - 8}
        durationInFrames={46}
        layout="none"
      >
        <TitleCard />
      </Sequence>
      <Sequence
        name="Scan wipe"
        from={SCENES.system.from - 14}
        durationInFrames={14}
      >
        <ScanWipe dur={14} />
      </Sequence>
      {/* the frame is re-tiled in midnight blue, then the tiles fold away into the clean logo card */}
      <TileWipe
        at={END_CARD_AT}
        half={8}
        origin="bottom"
        palette={[
          COLORS.midnight,
          COLORS.midnightDeep,
          COLORS.orange,
          COLORS.midnightLift,
        ]}
      />

      {/* ---------------- Persian subtitles ---------------- */}
      {showSubtitles ? <Subtitles /> : null}

      {/* ---------------- sound ---------------- */}
      <Audio
        name="Music · original score (synthesised)"
        src={staticFile("audio/score.wav")}
        volume={musicVolume}
      />
      <Audio
        name={`Narration · PLACEHOLDER (silent) — replace with recorded Persian VO for ${BRAND.name}`}
        src={staticFile("audio/narration-PLACEHOLDER.wav")}
        volume={narrationVolume}
      />
      <SoundDesign volume={sfxVolume} />
    </AbsoluteFill>
  );
};
