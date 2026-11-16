/**
 * Art direction of the story world (the 3D set, props and characters).
 * These are material and object colours — a rubber duck is yellow, oak is oak — and have
 * nothing to do with the brand palette, which lives in ./brand.ts.
 */
export const ART = {
  // the "before" bathroom: loud on purpose
  before: {
    grout: "#15171A",
    floor: "#F4F2EE",
    vanity: "#5B1E22",
    vanityTrim: "#C9A227",
    towel: "#D6336C",
    ceilingLight: "#DCEBFF",
    ambient: "#BFD0E6",
  },
  // the "after" bathroom: one calm, coordinated palette
  after: {
    grout: "#D4CEC3",
    wall: "#EFEAE1",
    vanity: "#B88A5B",
    basin: "#FAF8F4",
    metal: "#23262B",
    towel: "#A9B5A6",
    plant: "#4F7A57",
    warmLight: "#FFD9A8",
    ambient: "#FFF1DF",
  },
  duck: { body: "#F6C624", beak: "#E8792B", hat: "#2B2F36", band: "#11141A", coat: "#C9A46B" },
  paper: "#FBF8F0",
  kraft: "#B98F5E",
  backdropBefore: "#1B2230",
  backdropAfter: "#EDE4D6",
} as const;

/** Film format. */
export const FORMAT = { width: 1080, height: 1920, fps: 30 } as const;

/**
 * Instagram Reels safe area on the 1080×1920 frame. The app covers the top with its
 * header and the bottom/right with the caption, audio label and action buttons, so
 * anything that must be read stays inside this box.
 */
export const SAFE = { top: 250, bottom: 1500, left: 70, right: 930 } as const;
