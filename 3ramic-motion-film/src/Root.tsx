import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { FORMAT } from "./config/art";
import { FilmProps, ThreeRamicFilm } from "./Film";
import { SceneHook } from "./scenes/SceneHook";
import { DURATION, FilmFrameOffset, scene, SceneId } from "./timeline";

/** A single scene as its own composition, for previewing and test renders. */
const solo = (id: SceneId, Component: React.FC): React.FC => {
  const Solo: React.FC = () => (
    <FilmFrameOffset offset={scene(id).from}>
      <Component />
    </FilmFrameOffset>
  );
  return Solo;
};
const HookSolo = solo("hook", SceneHook);

const defaults: FilmProps = { showSubtitles: true, musicVolume: 0.5, sfxVolume: 0.9, voiceVolume: 1 };

export const RemotionRoot: React.FC = () => {
  const len = (id: SceneId) => scene(id).to - scene(id).from;
  return (
    <>
      {/* «پروندهٔ استعفای سرامیک‌ها» — 1080×1920 · 30 fps · length set by the recorded dialogue */}
      <Composition id="ThreeRamicFilm" component={ThreeRamicFilm} durationInFrames={DURATION} fps={FORMAT.fps} width={FORMAT.width} height={FORMAT.height} defaultProps={defaults} />
      <Folder name="Scenes">
        <Composition id="S1-Hook" component={HookSolo} durationInFrames={len("hook")} fps={FORMAT.fps} width={FORMAT.width} height={FORMAT.height} />
      </Folder>
    </>
  );
};
