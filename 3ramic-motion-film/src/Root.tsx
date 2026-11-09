import { Composition, Folder } from "remotion";
import "./fonts";
import { ThreeRamicFilm } from "./Film";
import { CharacterLab } from "./dev/CharacterLab";
import { Scene01Incident } from "./scenes/Scene01Incident";
import { Scene02Resignation } from "./scenes/Scene02Resignation";
import { Scene03Investigation } from "./scenes/Scene03Investigation";
import { Scene04System } from "./scenes/Scene04System";
import { Scene05Transformation } from "./scenes/Scene05Transformation";
import { Scene06Ending } from "./scenes/Scene06Ending";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* THE FLOOR THAT QUIT — 40 s · 1080×1920 · 30 fps */}
      <Composition
        id="ThreeRamicFilm"
        component={ThreeRamicFilm}
        durationInFrames={1200}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ showSubtitles: true, musicVolume: 0.5, sfxVolume: 0.9, narrationVolume: 1 }}
      />
      <Folder name="Scenes">
        <Composition id="S01-Incident" component={Scene01Incident} durationInFrames={150} fps={30} width={1080} height={1920} />
        <Composition id="S02-Resignation" component={Scene02Resignation} durationInFrames={180} fps={30} width={1080} height={1920} />
        <Composition id="S03-Investigation" component={Scene03Investigation} durationInFrames={180} fps={30} width={1080} height={1920} />
        <Composition id="S04-System" component={Scene04System} durationInFrames={210} fps={30} width={1080} height={1920} />
        <Composition id="S05-Transformation" component={Scene05Transformation} durationInFrames={300} fps={30} width={1080} height={1920} />
        <Composition id="S06-Ending" component={Scene06Ending} durationInFrames={180} fps={30} width={1080} height={1920} />
      </Folder>
      <Folder name="Dev">
        <Composition id="CharacterLab" component={CharacterLab} durationInFrames={60} fps={30} width={1080} height={1920} />
      </Folder>
    </>
  );
};
