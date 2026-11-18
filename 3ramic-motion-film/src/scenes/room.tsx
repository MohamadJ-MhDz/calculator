import React from "react";
import { blink } from "../anim";
import { BathroomProps, NICHE, TILE } from "../three/Bathroom";
import { TileCharacter } from "../three/TileCharacter";

/** The bathroom after the makeover (the patterned tile itself fills the fourth inlay place). */
export const finishedRoom = (f: number): BathroomProps => ({
  f,
  slotEmpty: true,
  grout: 1,
  walls: 1,
  oldVanity: 1,
  newVanity: 1,
  fixtures: 1,
  glass: 1,
  warm: 1,
  niche: 3,
});

/** Where the patterned tile sits once it has become the framed accent. */
export const NICHE_CHAR = [NICHE[3][0], NICHE[3][1] - 0.47, -5.9] as [number, number, number];

/** The patterned tile in its frame: still a character, now a calm one. */
export const PatternInNiche: React.FC<{ f: number; jaw?: number; lipRound?: number; mouth?: number; look?: [number, number] }> = ({ f, jaw = 0, lipRound = 0, mouth = 0.8, look = [0.3, -0.4] }) => (
  <TileCharacter
    position={NICHE_CHAR}
    scale={TILE}
    facing={0}
    tex="busy"
    legs={0}
    arms={0}
    eyes={blink(f, [f - (f % 97) + 40])}
    look={look}
    brow={-0.3}
    mouth={mouth}
    jaw={jaw}
    lipRound={lipRound}
    castShadow={false}
  />
);
