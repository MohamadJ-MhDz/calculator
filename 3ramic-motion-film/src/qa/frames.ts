import { BRAND_CUES, HOOK, MAKEOVER, PAYOFF, SUSPECTS } from "../cues";
import { hold, line, scene } from "../timeline";

const mid = (id: string) => Math.round((line(id).from + line(id).to) / 2);

/**
 * Key moments of the film, derived from the cue sheet (so they follow any re-timing).
 * Rendered by `npm run stills` as one image per moment for visual QA and the contact sheet.
 */
export const qaFrames = (): number[] => {
  const C = hold("compare");
  const T = hold("transform");
  return [
    HOOK.pop + 3, mid("L01"), HOOK.throwAt + 3, HOOK.hit + 3, HOOK.peel + 8, mid("L03"), HOOK.reveal + 14, HOOK.close + 12, HOOK.stamp + 3,
    SUSPECTS.patternPop + 7, mid("L05"), SUSPECTS.shades + 8, line("L06").to - 4, SUSPECTS.groutCut + 12, SUSPECTS.twitch + 6, SUSPECTS.vanityCut + 14, mid("L08"), SUSPECTS.bump + 3, SUSPECTS.smack + 3, mid("L09"), SUSPECTS.peel + 4,
    line("L10").from + 10, line("L10").to - 10, mid("L11"), MAKEOVER.boxOpen + 4, T.from + 8, Math.round((MAKEOVER.vanityOut[0] + MAKEOVER.vanityOut[1]) / 2), Math.round((MAKEOVER.grout[0] + MAKEOVER.grout[1]) / 2), Math.round((MAKEOVER.walls[0] + MAKEOVER.walls[1]) / 2), MAKEOVER.vanityIn[1], Math.round((MAKEOVER.warm[0] + MAKEOVER.warm[1]) / 2), Math.round((MAKEOVER.leap[0] + MAKEOVER.leap[1]) / 2), mid("L12"), C.from + 22, MAKEOVER.wipeOut[1] + 2,
    mid("L13"), mid("L14"), mid("L15"), PAYOFF.deadpan + 5,
    BRAND_CUES.nameAt + 8, BRAND_CUES.taglineAt + 10, Math.round((BRAND_CUES.lieDown[0] + BRAND_CUES.lieDown[1]) / 2), BRAND_CUES.click + 6, scene("brand").to - 2,
  ];
};
