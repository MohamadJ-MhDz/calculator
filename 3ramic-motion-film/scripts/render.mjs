// 3RAMIC — resumable full render (Windows, macOS, Linux).
//
//     node scripts/render.mjs                    # 1080×1920 H.264 + AAC -> out/3ramic-reel-1080x1920.mp4
//     node scripts/render.mjs --chunk 120 --concurrency 4
//     node scripts/render.mjs --scale 0.5 --out out/3ramic-preview-540x960.mp4
//
// The picture is rendered in chunks of frames (out/chunks/…). A chunk that already exists is
// skipped, so if the computer sleeps or the render is stopped, running the same command again
// continues where it stopped. The chunks are then joined without re-encoding and the finished
// mix (public/audio/mix.wav) is added as stereo AAC.
//
// Delete out/chunks after changing anything in the film, or the old chunks will be reused.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const chunk = Number(arg("chunk", 120));
const concurrency = arg("concurrency", null);
const scale = Number(arg("scale", 1));
const crf = Number(arg("crf", 18));
const tag = scale === 1 ? "1080x1920" : `${Math.round(1080 * scale)}x${Math.round(1920 * scale)}`;
const out = resolve(root, arg("out", `out/3ramic-reel-${tag}.mp4`));
const chunkDir = join(root, "out", "chunks", tag);
const bundleDir = join(root, "out", ".bundle");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args, label) => {
  const t0 = Date.now();
  const r = spawnSync(npx, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\n✘ ${label} failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
  return ((Date.now() - t0) / 1000).toFixed(0);
};

const timeline = JSON.parse(readFileSync(join(root, "src", "data", "timeline.json"), "utf8"));
const total = timeline.durationInFrames;
const mix = join(root, "public", "audio", "mix.wav");
if (!existsSync(mix)) {
  console.error("✘ public/audio/mix.wav is missing — run: npm run audio");
  process.exit(1);
}
mkdirSync(chunkDir, { recursive: true });

console.log(`3ramic render: ${total} frames (${(total / timeline.fps).toFixed(2)} s) at ${tag}, chunks of ${chunk}`);
if (!existsSync(join(bundleDir, "index.html"))) {
  console.log("• bundling the project once…");
  run(["remotion", "bundle", "--out-dir", bundleDir], "bundle");
}

const parts = [];
for (let a = 0; a < total; a += chunk) {
  const b = Math.min(total - 1, a + chunk - 1);
  const file = join(chunkDir, `frames-${String(a).padStart(5, "0")}-${String(b).padStart(5, "0")}.mp4`);
  parts.push(file);
  if (existsSync(file)) {
    console.log(`• frames ${a}–${b}: already rendered`);
    continue;
  }
  const tmp = file.replace(/\.mp4$/, ".part.mp4");
  rmSync(tmp, { force: true });
  const args = ["remotion", "render", bundleDir, "ThreeRamicFilm", tmp, `--frames=${a}-${b}`, "--muted", "--codec=h264", `--crf=${crf}`, "--pixel-format=yuv420p"];
  if (scale !== 1) args.push(`--scale=${scale}`);
  if (concurrency) args.push(`--concurrency=${concurrency}`);
  console.log(`• frames ${a}–${b}…`);
  const s = run(args, `frames ${a}-${b}`);
  // rename only when complete, so an interrupted chunk is redone next time
  writeFileSync(file, readFileSync(tmp));
  rmSync(tmp, { force: true });
  console.log(`  done in ${s} s`);
}

const list = join(chunkDir, "list.txt");
writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n") + "\n");
mkdirSync(dirname(out), { recursive: true });
console.log("• joining chunks and adding the mix…");
run(
  ["remotion", "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", mix,
   "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
   "-shortest", "-movflags", "+faststart", out],
  "join",
);
console.log(`✔ ${out}`);
