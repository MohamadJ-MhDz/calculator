import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ART } from "../config/art";
import { SCENES } from "../Film";
import { FilmFrameOffset, scene } from "../timeline";
export { qaFrames } from "./frames";
import { Subtitles } from "../ui/Subtitles";

export type QAProps = { frames: number[] };

/** Frame i of this composition shows the film at frames[i] (scene + subtitles, no audio). */
export const QAFrames: React.FC<QAProps> = ({ frames }) => {
  const i = useCurrentFrame();
  const f = frames[Math.min(i, frames.length - 1)];
  const sc = SCENES.find((s) => f >= scene(s.id).from && f < scene(s.id).to) ?? SCENES[SCENES.length - 1];
  return (
    <FilmFrameOffset offset={f - i}>
      <AbsoluteFill style={{ background: ART.backdropBefore }}>
        <sc.Component />
        <Subtitles />
      </AbsoluteFill>
    </FilmFrameOffset>
  );
};
