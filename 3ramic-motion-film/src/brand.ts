/**
 * 3RAMIC — brand tokens & editable copy.
 * Change colours / text here and the whole film updates.
 */

export const BRAND = {
  /** Exact brand name. Shown as plain text only while no official logo file is set in LOGO below. */
  name: "3ramic",
  /** Exact Persian tagline (ZWNJ-safe). */
  taglineFa: "هر سرامیکی، جای خودش.",
  filmTitle: "THE FLOOR THAT QUIT",
};

/**
 * OFFICIAL LOGO SLOT.
 * No logo asset was supplied with the brief, so `file` is null and the end card shows the brand
 * name as plain, neutral text (deliberately not a designed mark).
 * To insert the official logo: copy the supplied asset into public/ (SVG or PNG with transparency,
 * light version for a dark background) and set `file` to its name, e.g. "3ramic-logo.svg".
 * Nothing else needs to change; `width` is its on-screen width in px on the 1080-wide frame.
 */
export const LOGO: { file: string | null; width: number } = {
  file: null,
  width: 620,
};

export const COLORS = {
  charcoal: "#121820",
  charcoalSoft: "#1C2430",
  charcoalLift: "#273140",
  orange: "#FF703D",
  orangeDeep: "#E2582A",
  ivory: "#F2EDE4",
  ivoryShade: "#E4DDD1",
  coolGray: "#8E98A3",
  coolGrayDark: "#5B6571",
  stone: "#B8AE9F",
  stoneDark: "#8C8273",
  night: "#0A1124",
  midnight: "#0D1730",
  midnightLift: "#16254A",
  midnightDeep: "#070C1C",
  burnt: "#C8502A",
  moon: "#9DB4D6",
  warmLight: "#FFB98A",
};

export const FPS = 30;
export const DURATION = 1200;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Scene boundaries (frames). */
export const SCENES = {
  incident: { from: 0, dur: 150 },
  resignation: { from: 150, dur: 180 },
  investigation: { from: 330, dur: 180 },
  system: { from: 510, dur: 210 },
  transformation: { from: 720, dur: 300 },
  ending: { from: 1020, dur: 180 },
} as const;

/** Frame where the end card replaces the final 3D shot. */
export const END_CARD_AT = 1095;
