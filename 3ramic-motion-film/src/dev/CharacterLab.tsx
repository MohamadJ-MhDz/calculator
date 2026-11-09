import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Cam, KeyLight, Slab, StudioEnv, DPR } from "../three/kit";
import { TileCharacter } from "../three/TileCharacter";

export const CharacterLab: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#121820" }}>
      <ThreeCanvas dpr={DPR} width={width} height={height} shadows>
        <StudioEnv intensity={0.6} />
        <ambientLight intensity={0.25} />
        <KeyLight position={[4, 8, 6]} intensity={2.2} />
        <Cam pos={[0, 2.2, 7.5]} target={[0, 0.9, 0]} fov={38} />
        {[-2, -1, 0, 1, 2].map((x) => [-1, 0, 1, 2].map((z) => (
          <Slab key={`${x}${z}`} tex={(["marble","travertine","terrazzo","stone","porcelain","neutral"] as const)[(x + 2 + z + 1) % 6]} position={[x, -0.04, z]} />
        )))}
        <TileCharacter position={[-1.3, 0, 0.4]} tex="hero" facing={0.3} stride={1} walk={frame * 0.35} brow={0.6} mouth={-0.8} carry="hand" luggage="#FF703D" shoes="#FF703D" shadowBlob={0.6} />
        <TileCharacter position={[0.1, 0, -0.6]} tex="marble" facing={-0.2} stride={0.6} walk={frame * 0.2 + 1} lean={0.2} eyes={0.45} brow={-0.4} mouth={-0.4} carry="trolley" luggage="#8E98A3" />
        <TileCharacter position={[1.4, 0, 0.6]} tex="terrazzo" facing={-0.4} happy={1} mouth={1} carry="box" />
        <TileCharacter position={[0.0, 0, 1.4]} scale={0.6} tex="travertine" carry="sign" wave={frame * 0.4} brow={0.8} mouth={-1} look={[0.6, 0.2]} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
