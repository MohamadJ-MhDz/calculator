/**
 * 3RAMIC — BRAND CONFIGURATION (single source of truth for brand identity).
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ VERIFICATION STATUS: NOT VERIFIED.                                           │
 * │                                                                              │
 * │ The official site (https://3ramic.ir/fa) could not be opened from the        │
 * │ production machine: the server reset every connection during the TLS         │
 * │ handshake (checked 2026-11-15), and no logo file or brand guide was supplied.│
 * │ So this file contains NO official colour and NO official logo.               │
 * │ Nothing below is claimed to be the 3ramic corporate identity.                │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * What to do when the real assets are available (two minutes, no other file changes):
 *   1. Copy the official logo into public/brand/ (SVG preferred; PNG with transparency
 *      is fine). Provide the version meant for LIGHT backgrounds — the end card sits on
 *      the finished, light bathroom wall.
 *   2. Set `logo.file` to its path inside public/, e.g. "brand/3ramic-logo.svg".
 *   3. Fill in `colors.*` with the hex values from the brand guide / website CSS and set
 *      `verification.status` to "verified".
 *   4. Render again. The end card, the call-to-action, the sample box and the cover all
 *      read these values.
 *
 * Until then every 2D graphic in the film is drawn in neutral ink-on-paper tones, which
 * is a deliberate "no invented colour" fallback, not a proposal for the brand.
 */

export type Hex = `#${string}`;

export const BRAND = {
  /** Written form. Always exactly this, in Latin script. */
  name: "3ramic",
  /** Spoken form. The digit is the Persian word «سه»: se-râ-mik. Never "three-ramic". */
  spokenFa: "سه‌رامیک",
  spokenIpa: "serɒːmik",
  taglineFa: "هر سرامیکی، جای خودش.",
  /** Short call to action shown next to the web address. */
  ctaFa: "مدل‌های هماهنگ رو ببین",
  website: "3ramic.ir",
  websiteUrl: "https://3ramic.ir/fa",

  verification: {
    status: "unverified" as "unverified" | "verified",
    checkedOn: "2026-11-15",
    attempts: [
      "https://3ramic.ir/fa and https://www.3ramic.ir/fa — connection reset by the server during the TLS handshake (TLS 1.2 and 1.3, with and without a browser user agent).",
      "Web search for the brand name — no result from or about the site.",
      "No logo file, brand guide or screenshot was supplied with the brief.",
    ],
  },

  logo: {
    /** Path inside public/ of the OFFICIAL logo, or null. null → the name is set as plain text. */
    file: null as string | null,
    /** On-screen width in px on the 1080-wide frame. */
    width: 520,
    /** Clear space kept around the logo, as a fraction of its width. */
    clearSpace: 0.12,
  },

  /** OFFICIAL colour tokens. null = not verified; the neutral UI tokens below are used instead. */
  colors: {
    primary: null as Hex | null,
    secondary: null as Hex | null,
    accent: null as Hex | null,
    background: null as Hex | null,
    text: null as Hex | null,
  },
} as const;

/**
 * Neutral interface tones used while the official palette is unverified.
 * Ink, paper and two greys — no hue. They are NOT brand colours.
 */
const NEUTRAL = {
  ink: "#15181C" as Hex,
  inkSoft: "#2B3037" as Hex,
  paper: "#F5F2EC" as Hex,
  paperShade: "#E6E1D8" as Hex,
  grey: "#8B8F96" as Hex,
};

/**
 * What the 2D graphics actually use: the official token when it exists, the neutral tone otherwise.
 * Contrast rule: text on `surface` must be `onSurface` (and the reverse); never grey on grey.
 */
export const UI = {
  /** Dark plates: subtitle pills, tags. */
  surface: BRAND.colors.primary ?? NEUTRAL.ink,
  onSurface: BRAND.colors.background ?? NEUTRAL.paper,
  /** Light plates: the resignation letter, the end-card text block. */
  paper: BRAND.colors.background ?? NEUTRAL.paper,
  onPaper: BRAND.colors.text ?? NEUTRAL.ink,
  /** Emphasis inside text and thin rules. Falls back to ink/paper weight contrast, not to a colour. */
  accent: BRAND.colors.accent ?? null,
  muted: NEUTRAL.grey,
  inkSoft: NEUTRAL.inkSoft,
  paperShade: NEUTRAL.paperShade,
} as const;

export const BRAND_VERIFIED = BRAND.verification.status === "verified";
