/**
 * Vendors the Google Fonts used by the film into public/fonts (all SIL OFL 1.1),
 * so renders work offline and don't depend on the browser reaching fonts.gstatic.com.
 * Re-run with: node scripts/vendor-fonts.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const WANT = [
  { mod: "BricolageGrotesque", family: "Bricolage Grotesque", style: "normal", weights: ["400", "600", "800"], subsets: ["latin"] },
  { mod: "InstrumentSerif", family: "Instrument Serif", style: "italic", weights: ["400"], subsets: ["latin"] },
  { mod: "JetBrainsMono", family: "JetBrains Mono", style: "normal", weights: ["400", "700"], subsets: ["latin"] },
  { mod: "Vazirmatn", family: "Vazirmatn", style: "normal", weights: ["400", "700", "900"], subsets: ["arabic", "latin"] },
  { mod: "Lalezar", family: "Lalezar", style: "normal", weights: ["400"], subsets: ["arabic", "latin"] },
];

const outDir = path.resolve("public/fonts");
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
for (const w of WANT) {
  const m = await import(`@remotion/google-fonts/${w.mod}`);
  const info = m.getInfo();
  // Google serves these families as variable fonts: one file covers every weight.
  for (const subset of w.subsets) {
    const url = info.fonts[w.style][w.weights[0]][subset];
    const file = `${w.mod}-${w.style}-${subset}.woff2`;
    const dest = path.join(outDir, file);
    if (!fs.existsSync(dest)) {
      execFileSync("curl", ["-sSfL", "-o", dest, url]);
    }
    const sameForAll = w.weights.every((wt) => info.fonts[w.style][wt][subset] === url);
    const weight = sameForAll ? `${w.weights[0]} ${w.weights[w.weights.length - 1]}` : w.weights[0];
    manifest.push({ family: w.family, weight, style: w.style, subset, file, unicodeRange: info.unicodeRanges[subset] });
    console.log("ok", file, weight, fs.statSync(dest).size);
  }
}
fs.writeFileSync(path.join("src", "fonts-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} faces`);
