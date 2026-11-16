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

/** Persian text and the Latin brand name share one family, so the two scripts sit on one baseline. */
export const PERSIAN = stack("Vazirmatn", "sans-serif");
/** Heavy Persian display face for the few big words (the letter heading, the case stamp). */
export const PERSIAN_DISPLAY = stack("Lalezar", '"Vazirmatn", sans-serif');
export const LATIN = PERSIAN;
