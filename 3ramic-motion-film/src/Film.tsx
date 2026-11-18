import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { ART } from "./config/art";
import { SceneBrand } from "./scenes/SceneBrand";
import { SceneHook } from "./scenes/SceneHook";
import { SceneMakeover } from "./scenes/SceneMakeover";
import { ScenePayoff } from "./scenes/ScenePayoff";
import { SceneSuspects } from "./scenes/SceneSuspects";
import { FilmFrameOffset, scene, SceneId } from "./timeline";
import { Subtitles } from "./ui/Subtitles";

export type FilmProps = {
  /** Burned-in Persian subtitles (Instagram plays many Reels muted). */
  readonly showSubtitles: boolean;
  /** The finished mix (dialogue, score, effects, room tone) from scripts/audio/build_audio.py. */
  readonly withAudio: boolean;
};

export const SCENES: { id: SceneId; name: string; Component: React.FC }[] = [
  { id: "hook", name: "1 · The resignation", Component: SceneHook },
  { id: "suspects", name: "2 · The suspects", Component: SceneSuspects },
  { id: "makeover", name: "3 · The makeover", Component: SceneMakeover },
  { id: "payoff", name: "4 · The payoff", Component: ScenePayoff },
  { id: "brand", name: "5 · Brand close", Component: SceneBrand },
];

/** «پروندهٔ استعفای سرامیک‌ها» — the whole film. Scene boundaries come from the timeline. */
export const ThreeRamicFilm: React.FC<FilmProps> = ({ showSubtitles, withAudio }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: ART.backdropBefore }}>
      {SCENES.map(({ id, name, Component }) => {
        const s = scene(id);
        return (
          <Sequence key={id} name={name} from={s.from} durationInFrames={s.to - s.from} premountFor={fps}>
            <FilmFrameOffset offset={s.from}>
              <Component />
            </FilmFrameOffset>
          </Sequence>
        );
      })}
      {showSubtitles ? <Subtitles /> : null}
      {withAudio ? <Audio src={staticFile("audio/mix.wav")} /> : null}
    </AbsoluteFill>
  );
};
