import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { ART } from "./config/art";
import { SceneHook } from "./scenes/SceneHook";
import { FilmFrameOffset, scene, SceneId } from "./timeline";
import { Subtitles } from "./ui/Subtitles";

export type FilmProps = {
  readonly showSubtitles: boolean;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly voiceVolume: number;
};

const SCENES: { id: SceneId; name: string; Component: React.FC }[] = [
  { id: "hook", name: "1 · The resignation", Component: SceneHook },
];

/** «پروندهٔ استعفای سرامیک‌ها» — the whole film. Scene boundaries come from the timeline. */
export const ThreeRamicFilm: React.FC<FilmProps> = ({ showSubtitles }) => {
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
    </AbsoluteFill>
  );
};
