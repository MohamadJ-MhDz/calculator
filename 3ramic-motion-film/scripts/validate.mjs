// 3RAMIC — release checks (no dependencies; Windows, macOS, Linux).
//
//     node scripts/validate.mjs        (npm run validate)
//
// ✘ = release-blocking (exit code 1)   ⚠ = needs a human decision   ✔ = checked and fine
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (...p) => join(root, ...p);
const json = (...p) => JSON.parse(readFileSync(P(...p), "utf8"));
let fails = 0;
let warns = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const warn = (m) => (warns++, console.log(`  ⚠ ${m}`));
const fail = (m) => (fails++, console.log(`  ✘ ${m}`));
const section = (t) => console.log(`\n${t}`);

/** Minimal RIFF/WAVE reader: format and duration. */
const wavInfo = (path) => {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV file");
  let o = 12;
  let fmt = null;
  let dataBytes = 0;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === "data") dataBytes = size;
    o += 8 + size + (size % 2);
  }
  if (!fmt) throw new Error("no fmt chunk");
  return { ...fmt, seconds: dataBytes / (fmt.rate * fmt.channels * (fmt.bits / 8)) };
};
const sha1 = (path) => createHash("sha1").update(readFileSync(path)).digest("hex");

/* ------------------------------------------------------------------ files */
section("1 · Source files");
const required = [
  "package.json", "package-lock.json", "remotion.config.ts", "src/index.ts", "src/Root.tsx", "src/Film.tsx",
  "src/config/brand.ts", "src/config/art.ts", "src/cues.ts", "src/timeline.ts", "src/data/timeline.json",
  "production/screenplay.json", "production/phonemes.json", "production/cast.json", "production/cues.json", "production/acting-direction.fa.md",
  "public/audio/mix.wav", "public/subtitles/dialogue-fa.srt", "public/subtitles/dialogue-fa.json", "src/fonts-manifest.json", "public/fonts/LICENSES.md",
];
const missing = required.filter((f) => !existsSync(P(f)));
missing.length ? missing.forEach((f) => fail(`missing ${f}`)) : ok(`${required.length} core files present`);
if (missing.includes("src/data/timeline.json") || missing.includes("production/screenplay.json")) process.exit(1);
const fonts = json("src", "fonts-manifest.json");
const fontFiles = (Array.isArray(fonts) ? fonts : fonts.fonts ?? []).map((f) => f.file ?? f.src ?? f.path).filter(Boolean);
const missingFonts = fontFiles.filter((f) => ![P("public", "fonts", f), P("public", f), P(f)].some((x) => existsSync(x)));
missingFonts.length ? missingFonts.forEach((f) => fail(`font file missing: ${f}`)) : ok(`${fontFiles.length} font files present (licences in public/fonts/LICENSES.md)`);

/* ------------------------------------------------------------------ timeline */
section("2 · Timeline (audio-first)");
const tl = json("src", "data", "timeline.json");
const sp = json("production", "screenplay.json");
tl.fps === 30 ? ok("30 fps") : fail(`fps is ${tl.fps}, expected 30`);
const secs = tl.durationInFrames / tl.fps;
secs >= 32 && secs <= 38 ? ok(`length ${secs.toFixed(2)} s (target 32–38 s)`) : warn(`length ${secs.toFixed(2)} s is outside the 32–38 s creative target (dialogue is not sped up to fit)`);
let contiguous = tl.scenes[0].from === 0 && tl.scenes.at(-1).to === tl.durationInFrames;
for (let i = 1; i < tl.scenes.length; i++) contiguous &&= tl.scenes[i].from === tl.scenes[i - 1].to;
contiguous ? ok(`${tl.scenes.length} scenes cover the film without gaps`) : fail("scene spans are not contiguous");
const ids = new Set(tl.lines.map((l) => l.id));
const notPlaced = sp.lines.filter((l) => !ids.has(l.id));
notPlaced.length ? notPlaced.forEach((l) => fail(`screenplay line ${l.id} is not in the timeline`)) : ok(`all ${sp.lines.length} screenplay lines are placed`);
const sorted = [...tl.lines].sort((a, b) => a.from - b.from);
let overlaps = 0;
for (let i = 1; i < sorted.length; i++) if (sorted[i].from < sorted[i - 1].to) (overlaps++, fail(`${sorted[i - 1].id} and ${sorted[i].id} overlap`));
if (!overlaps) ok("no two lines overlap");
const cut = tl.lines.filter((l) => l.to > tl.durationInFrames || l.from < 0);
cut.length ? cut.forEach((l) => fail(`${l.id} is cut off by the film's edges`)) : ok("every line ends before the film ends (no speech cut off)");
const badLip = tl.lines.filter((l) => l.open.length !== l.to - l.from || l.round.length !== l.to - l.from);
badLip.length ? badLip.forEach((l) => fail(`${l.id}: mouth track length does not match the line`)) : ok("a mouth-shape value for every frame of every line");
const byId = Object.fromEntries(sp.lines.map((l) => [l.id, l]));
const textDrift = tl.lines.filter((l) => byId[l.id] && (byId[l.id].displayText !== l.text || byId[l.id].speechText !== l.speech));
textDrift.length ? textDrift.forEach((l) => fail(`${l.id}: timeline text differs from the screenplay — run npm run timeline`)) : ok("timeline text matches the screenplay");

/* ------------------------------------------------------------------ voices */
section("3 · Dialogue recordings");
let voiceOk = 0;
for (const l of tl.lines) {
  const wav = P("public", l.file);
  if (!existsSync(wav)) {
    fail(`${l.id}: recording missing (${l.file}) — the character would be silent`);
    continue;
  }
  const w = wavInfo(wav);
  if (Math.abs(w.seconds - l.seconds) > 1 / tl.fps) fail(`${l.id}: recording is ${w.seconds.toFixed(2)} s but the timeline expects ${l.seconds} s — run npm run timeline`);
  else voiceOk++;
  const al = P("production", "voice", `${l.id}.align.json`);
  if (existsSync(al) && JSON.parse(readFileSync(al, "utf8")).sha1 !== sha1(wav)) warn(`${l.id}: recording replaced; mouth timing comes from its speech energy (expected for human recordings)`);
}
if (voiceOk === tl.lines.length) ok(`${voiceOk} recordings present and in sync with the timeline`);
const sel = existsSync(P("production", "voice", "selection.json")) ? json("production", "voice", "selection.json") : null;
if (sel) sel.meanMatch >= 0.9 ? ok(`speech-recognition intelligibility of the chosen takes: ${sel.meanMatch}`) : warn(`intelligibility of the chosen takes is only ${sel.meanMatch}`);
const inMix = existsSync(P("production", "qa", "dialogue-in-mix.json")) ? json("production", "qa", "dialogue-in-mix.json") : null;
if (inMix) inMix.meanMatch >= 0.85 ? ok(`dialogue recognised through the finished mix: ${inMix.meanMatch}`) : warn(`dialogue through the mix: only ${inMix.meanMatch}`);
warn("acting quality (timing, warmth, comedy) can only be judged by listening — see docs/QA-REPORT.md");

/* ------------------------------------------------------------------ brand pronunciation */
section("4 · Brand: written 3ramic, spoken «سه‌رامیک»");
const ph = json("production", "phonemes.json");
const allPh = Object.entries(ph.lines).map(([id, v]) => [id, v.phrases.map((p) => p.ph).join(" | ")]);
const english = allPh.filter(([, s]) => /θ|θɹ|\bt[ɹr]iː?\b|\bsri\b|ðɹ/.test(s));
english.length ? english.forEach(([id]) => fail(`${id}: phonemes contain an English "three"`)) : ok("no line is pronounced Three-/Tri-/Sri-ramic");
for (const l of sp.lines.filter((x) => x.brand)) {
  const p = ph.lines[l.id].phrases.map((x) => x.ph).join(" ");
  /serˈɑmik/.test(p) ? ok(`${l.id}: spoken se-râ-mik (${p.match(/\S*serˈɑmik\S*/)[0]})`) : fail(`${l.id}: brand line without /serˈɑmik/`);
  /3ramic/.test(l.displayText) ? ok(`${l.id}: written «3ramic» on screen`) : fail(`${l.id}: brand line does not show «3ramic»`);
  /3ramic|تری|ثری/i.test(l.speechText) ? fail(`${l.id}: speechText must say «سه‌رامیک», not "${l.speechText}"`) : null;
}

/* ------------------------------------------------------------------ brand identity */
section("5 · Brand identity (no invented colours or logo)");
const brandTs = readFileSync(P("src", "config", "brand.ts"), "utf8");
const status = (brandTs.match(/status:\s*"(\w+)"/) || [])[1];
const colorsBlock = (brandTs.match(/colors:\s*\{([\s\S]*?)\}/) || [])[1] ?? "";
const hexInColors = colorsBlock.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
if (status === "verified") ok("brand identity marked verified");
else {
  warn(`official colours/logo not verified (status "${status}") — film uses neutral ink/paper; see src/config/brand.ts`);
  hexInColors.length ? fail(`unverified brand but colours set: ${hexInColors.join(", ")}`) : ok("no brand colour is claimed while unverified");
}
const logo = (brandTs.match(/file:\s*("([^"]*)"|null)/) || [])[2];
if (logo) existsSync(P("public", logo)) ? ok(`official logo file present: public/${logo}`) : fail(`logo file set but missing: public/${logo}`);
else warn("no official logo file — the brand name is set as plain text (no invented logo)");
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const orange = walk(P("src")).filter((f) => /\.(tsx?|json|css)$/.test(f) && /#ff703d/i.test(readFileSync(f, "utf8")));
orange.length ? orange.forEach((f) => fail(`rejected orange #FF703D used in ${f.slice(root.length + 1)}`)) : ok("the rejected orange #FF703D is not used anywhere");

/* ------------------------------------------------------------------ format */
section("6 · Format");
const art = readFileSync(P("src", "config", "art.ts"), "utf8");
/width:\s*1080/.test(art) && /height:\s*1920/.test(art) ? ok("1080×1920 (9:16) native") : fail("composition is not 1080×1920");
/fps:\s*30/.test(art) ? ok("30 fps composition") : fail("composition is not 30 fps");

/* ------------------------------------------------------------------ audio */
section("7 · Audio master");
const mix = wavInfo(P("public", "audio", "mix.wav"));
mix.rate === 48000 && mix.channels === 2 ? ok("stereo 48 kHz") : fail(`mix is ${mix.channels} ch / ${mix.rate} Hz`);
Math.abs(mix.seconds - secs) <= 1 / tl.fps ? ok(`mix length ${mix.seconds.toFixed(2)} s = film length`) : fail(`mix is ${mix.seconds.toFixed(2)} s, film is ${secs.toFixed(2)} s — run npm run audio`);
if (existsSync(P("production", "qa", "audio-report.json"))) {
  const r = json("production", "qa", "audio-report.json");
  r.integratedLUFS >= -16 && r.integratedLUFS <= -14 ? ok(`loudness ${r.integratedLUFS} LUFS (target −16…−14)`) : fail(`loudness ${r.integratedLUFS} LUFS outside −16…−14`);
  r.truePeakDBTP <= -1 ? ok(`true peak ${r.truePeakDBTP} dBTP (≤ −1)`) : fail(`true peak ${r.truePeakDBTP} dBTP above −1`);
  r.mono.monoDropLU <= 3 ? ok(`mono fold-down loses ${r.mono.monoDropLU} LU (≤ 3)`) : warn(`mono fold-down loses ${r.mono.monoDropLU} LU`);
  const c = r.dialogueClarity;
  c.minOverMusicLU >= 8 && c.minOverSfxLU >= 6 ? ok(`every line ≥ ${c.minOverMusicLU} LU over music and ≥ ${c.minOverSfxLU} LU over effects`) : warn(`a line is close to the bed: ${c.minOverMusicLU} LU over music, ${c.minOverSfxLU} LU over effects`);
} else fail("production/qa/audio-report.json missing — run npm run audio");

/* ------------------------------------------------------------------ subtitles */
section("8 · Subtitles");
const srt = readFileSync(P("public", "subtitles", "dialogue-fa.srt"), "utf8");
const phrases = tl.lines.filter((l) => l.subtitle).flatMap((l) => l.phrases.map((p) => p.text));
const missingSub = phrases.filter((t) => !srt.includes(t));
missingSub.length ? missingSub.forEach((t) => fail(`subtitle missing: ${t}`)) : ok(`${phrases.length} subtitle phrases, timed from the recorded speech`);

console.log(`\n${fails ? `✘ ${fails} release-blocking problem(s)` : "✔ no release-blocking problems"}${warns ? `, ⚠ ${warns} item(s) need a human decision` : ""}\n`);
process.exit(fails ? 1 : 0);
