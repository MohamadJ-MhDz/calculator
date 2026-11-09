import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import manifest from "./fonts-manifest.json";

/**
 * Fonts are vendored into public/fonts (SIL OFL 1.1, from Google Fonts — see
 * public/fonts/LICENSES.md and scripts/vendor-fonts.mjs) so renders never depend
 * on network access. loadFont() blocks rendering until each face is ready.
 *
 * Persian is shaped by Chrome's HarfBuzz engine with a real Arabic-script font
 * (Vazirmatn) — no manual glyph shaping / letter splitting anywhere in the film.
 */
for (const face of manifest) {
  loadFont({
    family: face.family,
    url: staticFile(`fonts/${face.file}`),
    weight: face.weight,
    style: face.style,
    unicodeRange: face.unicodeRange,
    display: "block",
  });
}

const stack = (name: string, fallback: string) => `"${name}", ${fallback}`;

export const DISPLAY = stack("Bricolage Grotesque", "sans-serif");
export const SERIF = stack("Instrument Serif", "serif");
export const MONO = stack("JetBrains Mono", "monospace");
export const PERSIAN = stack("Vazirmatn", "sans-serif");
export const PERSIAN_DISPLAY = stack("Lalezar", '"Vazirmatn", sans-serif');
