import * as THREE from "three";

/**
 * Procedural, deterministic ceramic textures.
 * Every texture is painted on a 2D canvas from a seeded PRNG so each render
 * (and each Chrome tab during parallel rendering) produces identical pixels.
 */

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

const makeCanvas = (w: number, h = w): [HTMLCanvasElement, Ctx] => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
};

/** Smooth value-noise layer: random low-res pixels upscaled with bilinear smoothing. */
const noiseLayer = (
  ctx: Ctx,
  size: number,
  cells: number,
  rng: Rng,
  alpha: number,
  mode: GlobalCompositeOperation = "overlay",
  tint: [number, number, number] | null = null,
) => {
  const [small, sctx] = makeCanvas(cells);
  const img = sctx.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) {
    const v = Math.floor(rng() * 255);
    img.data[i * 4] = tint ? tint[0] * (v / 255) : v;
    img.data[i * 4 + 1] = tint ? tint[1] * (v / 255) : v;
    img.data[i * 4 + 2] = tint ? tint[2] * (v / 255) : v;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = mode;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, size, size);
  ctx.restore();
};

const speckle = (
  ctx: Ctx,
  size: number,
  rng: Rng,
  count: number,
  colors: string[],
  rMin: number,
  rMax: number,
  alpha = 1,
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const r = rMin + rng() * (rMax - rMin);
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, r, r * (0.6 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/** Wandering vein drawn as many short segments (marble). */
const vein = (ctx: Ctx, size: number, rng: Rng, color: string, width: number, blur: number, alpha: number) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.filter = `blur(${blur}px)`;
  let x = rng() * size * 0.3 - size * 0.1;
  let y = rng() * size;
  let ang = -0.5 + rng() * 1.0;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < 90; i++) {
    ang += (rng() - 0.5) * 0.55;
    ang = Math.max(-1.1, Math.min(1.1, ang));
    x += Math.cos(ang) * size * 0.018;
    y += Math.sin(ang) * size * 0.018;
    ctx.lineTo(x, y);
    if (rng() < 0.05) {
      // branch
      ctx.stroke();
      ctx.lineWidth = Math.max(0.6, ctx.lineWidth * 0.7);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
};

/** Thin bevel/grout darkening at the tile border for realism. */
const edgeShade = (ctx: Ctx, size: number, strength = 0.22) => {
  const g = ctx.createLinearGradient(0, 0, size, 0);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = strength;
  const b = size * 0.018;
  g.addColorStop(0, "#6f6a62");
  g.addColorStop(b / size, "#ffffff");
  g.addColorStop(1 - b / size, "#ffffff");
  g.addColorStop(1, "#6f6a62");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const g2 = ctx.createLinearGradient(0, 0, 0, size);
  g2.addColorStop(0, "#6f6a62");
  g2.addColorStop(b / size, "#ffffff");
  g2.addColorStop(1 - b / size, "#ffffff");
  g2.addColorStop(1, "#6f6a62");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
};

/* ------------------------------------------------------------------ */
/* Premium (correct) materials                                          */
/* ------------------------------------------------------------------ */

/** Back of a tile: unglazed biscuit with the classic grid of raised lugs. */
const paintClayBack = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#D7B596";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 20, rng, 0.18, "overlay");
  noiseLayer(ctx, s, 70, rng, 0.12, "overlay");
  const n = 7;
  const cell = s / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = i * cell + cell * 0.18;
      const y = j * cell + cell * 0.18;
      const w = cell * 0.64;
      ctx.fillStyle = "rgba(120,80,50,0.32)";
      ctx.fillRect(x + 3, y + 3, w, w);
      ctx.fillStyle = "rgba(240,215,190,0.55)";
      ctx.fillRect(x, y, w, w);
    }
  // manufacturer's ring stamp
  ctx.strokeStyle = "rgba(110,70,45,0.45)";
  ctx.lineWidth = s * 0.012;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  edgeShade(ctx, s, 0.25);
};

const paintOak = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#B88A5E";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 160; i++) {
    ctx.strokeStyle = rng() > 0.5 ? "rgba(120,80,45,0.35)" : "rgba(215,175,130,0.3)";
    ctx.lineWidth = 0.5 + rng() * 2;
    const y = rng() * s;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(s * 0.3, y + (rng() - 0.5) * 20, s * 0.7, y + (rng() - 0.5) * 20, s, y + (rng() - 0.5) * 10);
    ctx.stroke();
  }
};

/** Suspect 1 — a loud encaustic-style wall tile: saturated, high-contrast, busy on purpose. */
const paintBusy = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#F1E2BE";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 16, rng, 0.06, "multiply");
  const c = s / 2;
  const star = (r: number, inner: number, n = 16, rot = -Math.PI / 2) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const rr = i % 2 === 0 ? r : r * inner;
      const x = c + Math.cos(a) * rr;
      const y = c + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  // lattice of diagonal bands
  ctx.strokeStyle = "#16181B";
  ctx.lineWidth = s * 0.022;
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.1 + k * s * 0.5, -s * 0.1);
    ctx.lineTo(s * 1.1 + k * s * 0.5, s * 1.1);
    ctx.moveTo(s * 1.1 + k * s * 0.5, -s * 0.1);
    ctx.lineTo(-s * 0.1 + k * s * 0.5, s * 1.1);
    ctx.stroke();
  }
  // corner medallions (they join into full circles across tiles)
  for (const [x, y] of [
    [0, 0],
    [s, 0],
    [0, s],
    [s, s],
  ]) {
    ctx.fillStyle = "#B4302A";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#16181B";
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    ctx.fillStyle = "#E2A91C";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  // edge diamonds
  ctx.fillStyle = "#E2A91C";
  for (const [x, y] of [
    [c, 0],
    [c, s],
    [0, c],
    [s, c],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-s * 0.075, -s * 0.075, s * 0.15, s * 0.15);
    ctx.restore();
  }
  // central star
  ctx.fillStyle = "#0E7C86";
  star(s * 0.34, 0.6);
  ctx.fill();
  ctx.strokeStyle = "#16181B";
  ctx.lineWidth = s * 0.018;
  ctx.stroke();
  ctx.fillStyle = "#F1E2BE";
  star(s * 0.2, 0.6, 16, -Math.PI / 2 + Math.PI / 8);
  ctx.fill();
  ctx.fillStyle = "#B4302A";
  ctx.beginPath();
  ctx.arc(c, c, s * 0.075, 0, Math.PI * 2);
  ctx.fill();
  edgeShade(ctx, s, 0.2);
};

/** Heavy fake brown marble with gold veins — clashes with everything around it. */
const paintVeinBrown = (ctx: Ctx, s: number, rng: Rng) => {
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, "#7A5234");
  g.addColorStop(1, "#553622");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 9, rng, 0.35, "overlay");
  noiseLayer(ctx, s, 36, rng, 0.14, "multiply");
  for (let i = 0; i < 4; i++) vein(ctx, s, rng, "#E9D9BE", s * 0.012, s * 0.004, 0.7);
  for (let i = 0; i < 5; i++) vein(ctx, s, rng, "#D4A43A", s * 0.005, 0.6, 0.85);
  for (let i = 0; i < 8; i++) vein(ctx, s, rng, "#2E1C10", s * 0.004, 0.6, 0.55);
  edgeShade(ctx, s, 0.3);
};

/** The floor tile (and the main character): plain glossy white. Nothing wrong with it. */
const paintGloss = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#F6F4F0";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 6, rng, 0.05, "multiply");
  speckle(ctx, s, rng, 500, ["#E9E6E0", "#FFFFFF"], 0.5, 1.6, 0.5);
  edgeShade(ctx, s, 0.16);
};

/** The coordinated "after" wall: large-format warm-white matte porcelain, almost featureless. */
const paintCalm = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#E2D8CA";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 5, rng, 0.07, "overlay");
  noiseLayer(ctx, s, 22, rng, 0.035, "multiply");
  ctx.save();
  for (let i = 0; i < 160; i++) {
    ctx.strokeStyle = rng() > 0.5 ? "#D8CDBE" : "#ECE4D8";
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 0.6 + rng() * 1.6;
    const y = rng() * s;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.bezierCurveTo(s * 0.3, y + (rng() - 0.5) * 10, s * 0.6, y + (rng() - 0.5) * 10, s + 10, y + (rng() - 0.5) * 8);
    ctx.stroke();
  }
  ctx.restore();
  edgeShade(ctx, s, 0.1);
};

/* ------------------------------------------------------------------ */

export type TexKey = "clay" | "oak" | "busy" | "veinBrown" | "gloss" | "calm";

const PAINTERS: Record<TexKey, (ctx: Ctx, s: number, rng: Rng) => void> = {
  clay: paintClayBack,
  oak: paintOak,
  busy: paintBusy,
  veinBrown: paintVeinBrown,
  gloss: paintGloss,
  calm: paintCalm,
};

const SEEDS: Record<TexKey, number> = {
  clay: 151,
  oak: 191,
  busy: 211,
  veinBrown: 223,
  gloss: 227,
  calm: 229,
};

const cache = new Map<string, THREE.CanvasTexture>();

export const getTexture = (key: TexKey, size = 512, repeat = 1): THREE.CanvasTexture => {
  const id = `${key}:${size}:${repeat}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(size);
  PAINTERS[key](ctx, size, mulberry32(SEEDS[key]));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  tex.needsUpdate = true;
  cache.set(id, tex);
  return tex;
};

/** Grayscale bump derived from a colour texture. */
export const getBump = (key: TexKey, size = 512): THREE.CanvasTexture => {
  const id = `bump:${key}:${size}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const src = getTexture(key, size).image as HTMLCanvasElement;
  const [canvas, ctx] = makeCanvas(size);
  ctx.filter = "grayscale(1) contrast(1.6)";
  ctx.drawImage(src, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cache.set(id, tex);
  return tex;
};
