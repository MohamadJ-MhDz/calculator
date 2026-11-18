import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { FORMAT } from "./config/art";
import { FilmProps, SCENES, ThreeRamicFilm } from "./Film";
import { Cover } from "./cover/Cover";
import { qaFrames } from "./qa/frames";
import { QAFrames, QAProps } from "./qa/QAFrames";
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
const SOLOS = SCENES.map((s, k) => ({ id: `S${k + 1}-${s.id[0].toUpperCase()}${s.id.slice(1)}`, scene: s.id, Component: solo(s.id, s.Component) }));

const defaults: FilmProps = { showSubtitles: true, withAudio: true };

export const RemotionRoot: React.FC = () => {
  const len = (id: SceneId) => scene(id).to - scene(id).from;
  return (
    <>
      {/* «پروندهٔ استعفای سرامیک‌ها» — 1080×1920 · 30 fps · length set by the recorded dialogue */}
      <Composition id="ThreeRamicFilm" component={ThreeRamicFilm} durationInFrames={DURATION} fps={FORMAT.fps} width={FORMAT.width} height={FORMAT.height} defaultProps={defaults} />
      <Folder name="Scenes">
        {SOLOS.map((s) => (
          <Composition key={s.id} id={s.id} component={s.Component} durationInFrames={len(s.scene)} fps={FORMAT.fps} width={FORMAT.width} height={FORMAT.height} />
        ))}
      </Folder>
      <Folder name="Instagram">
        {/* cover image: npm run cover */}
        <Composition id="Cover" component={Cover} durationInFrames={1} fps={FORMAT.fps} width={FORMAT.width} height={FORMAT.height} />
      </Folder>
      <Folder name="QA">
        {/* key moments as a sequence of stills: npm run stills */}
        <Composition
          id="QAFrames"
          component={QAFrames}
          durationInFrames={qaFrames().length}
          fps={FORMAT.fps}
          width={FORMAT.width}
          height={FORMAT.height}
          defaultProps={{ frames: qaFrames() } as QAProps}
          calculateMetadata={({ props }) => ({ durationInFrames: props.frames.length })}
        />
      </Folder>
    </>
  );
};
