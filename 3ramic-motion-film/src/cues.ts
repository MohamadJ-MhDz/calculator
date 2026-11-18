import { hold, line, scene } from "./timeline";

/**
 * ACTION CUES — every non-dialogue beat of the film as an absolute frame, derived from
 * the timeline (and therefore from the recorded dialogue). Scenes animate to these and
 * the sound design fires on the same numbers, so picture and sound cannot drift apart.
 */

const L1 = line("L01");
const L3 = line("L03");
const L4 = line("L04");
const L6 = line("L06");
const L7 = line("L07");
const L8 = line("L08");
const L9 = line("L09");
const L11 = line("L11");
const L12 = line("L12");
const L13 = line("L13");
const L14 = line("L14");
const L15 = line("L15");
const L16 = line("L16");

const sHook = scene("hook");
const sSus = scene("suspects");
const sMake = scene("makeover");
const sPay = scene("payoff");
const sBrand = scene("brand");

const hBox = hold("box");
const hT = hold("transform");
const hC = hold("compare");

/* ---------------- 1 · hook ---------------- */
const hit = L1.to + 1; // the letter hits the lens right after the last word
export const HOOK = {
  pop: sHook.from, // the tile springs out of the floor
  letterOut: sHook.from + 9, // it produces the letter
  throwAt: hit - 6,
  hit,
  peel: hit + 9, // the paper starts to slide down the glass
  clear: hit + 22, // …and is gone; the detective is standing there
  reveal: L3.from + Math.round((L3.to - L3.from) * 0.3), // «این چه ترکیبیه؟!» — we look at the room
  close: L4.from - 6, // close-up: the detective takes the case
  stamp: L4.to + 1, // the case stamp punctuates «…باز شد.»
};

/* ---------------- 2 · suspects ---------------- */
export const SUSPECTS = {
  patternPop: sSus.from + 2, // suspect 1 jumps off the wall
  tag1: sSus.from + 8,
  shades: L6.from - 3, // the detective's sunglasses drop
  groutCut: L7.from - 10,
  tag2: L7.from - 5,
  twitch: L7.words[3].from, // «هزار تیکه» — the floor twitches piece by piece
  vanityCut: L8.from - 10,
  tag3: L8.from - 4,
  bump: L8.to - 3, // the drawer shoots out…
  smack: L8.to + 3, // …and the detective is flat against the lens
  peel: L9.to + 3,
  out: sSus.to,
};

/* ---------------- 3 · makeover ---------------- */
// The transformation is choreographed on a 140-beat grid and stretched to the hold's real
// length, so shortening or lengthening the hold in the screenplay keeps every change in order.
const T0 = hT.from;
const u = (beat: number) => T0 + Math.round((beat * (hT.to - hT.from)) / 140);
export const MAKEOVER = {
  brandCut: L11.from - 3, // «کارِ سه‌رامیکه!»
  wideCut: L11.to - 2, // the master angle: from here to the end of the comparison the camera barely moves
  boxIn: L11.to - 2,
  boxLand: hBox.from + 6,
  boxOpen: hBox.from + 9,
  T0,
  samplesUp: [T0 - 6, u(14)] as const,
  vanityOut: [u(6), u(34)] as const,
  grout: [u(26), u(66)] as const,
  walls: [u(34), u(96)] as const,
  glass: [u(44), u(66)] as const,
  vanityIn: [u(62), u(80)] as const,
  warm: [u(70), u(112)] as const,
  fixtures: [u(82), u(98)] as const,
  nicheTrim: u(78),
  nicheTiles: [u(80), u(83), u(86)] as const,
  // the patterned tile jumps into its frame, lands, THEN says «این‌جا جای منه!» (no hit under the words)
  leap: [L12.from - 22, L12.from - 8] as const,
  done: L12.to + 1,
  C0: hC.from,
  wipeIn: [hC.from + 2, hC.from + 15] as const,
  wipeOut: [hC.to - 17, hC.to - 5] as const,
  end: sMake.to,
};

/* ---------------- 4 · payoff ---------------- */
export const PAYOFF = {
  from: sPay.from,
  twoShot: L14.from - 5,
  letterUp: L14.from - 2,
  think: L14.to + 1,
  cross: L15.from - 3,
  deadpan: L15.to + 3,
  squeak: L15.to + 8,
  end: sPay.to,
};

/* ---------------- 5 · brand ---------------- */
// «…هر سرامیکی، جای خودش.» — *click*: the tile drops into its own place right after the words
const click = L16.to + 1;
export const BRAND_CUES = {
  from: sBrand.from,
  walk: [sBrand.from + 2, click - 14] as const,
  lieDown: [click - 12, click] as const,
  click,
  hatTip: click + 4,
  nameAt: L16.from - 2,
  taglineAt: L16.words[1].from - 2,
  ctaAt: Math.min(L16.to - 4, L16.words[1].from + 28), // readable for well over a second before the end
  end: sBrand.to,
};

export const SPOKEN = { L13, L14, L15 };
