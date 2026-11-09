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

const paintMarble = (ctx: Ctx, s: number, rng: Rng) => {
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, "#F7F4EE");
  g.addColorStop(1, "#ECE7DE");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 10, rng, 0.18, "multiply");
  noiseLayer(ctx, s, 40, rng, 0.08, "multiply");
  for (let i = 0; i < 3; i++) vein(ctx, s, rng, "#9A9389", s * 0.012, s * 0.006, 0.35);
  for (let i = 0; i < 6; i++) vein(ctx, s, rng, "#7E776D", s * 0.0035, 0.6, 0.55);
  vein(ctx, s, rng, "#B89A6A", s * 0.004, 0.8, 0.6); // gold vein
  for (let i = 0; i < 10; i++) vein(ctx, s, rng, "#A8A196", s * 0.0018, 0.4, 0.35);
};

const paintTravertine = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#D9C7A8";
  ctx.fillRect(0, 0, s, s);
  // horizontal sedimentary bands
  for (let i = 0; i < 70; i++) {
    const y = rng() * s;
    const h = s * (0.004 + rng() * 0.03);
    const tones = ["#CDB792", "#E6D7BC", "#C4AA82", "#EADFC9", "#D2BD99"];
    ctx.save();
    ctx.globalAlpha = 0.25 + rng() * 0.45;
    ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
    ctx.filter = `blur(${1 + rng() * 3}px)`;
    ctx.beginPath();
    ctx.ellipse(s / 2 + (rng() - 0.5) * s * 0.4, y, s * (0.4 + rng() * 0.5), h, (rng() - 0.5) * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  noiseLayer(ctx, s, 24, rng, 0.15, "multiply");
  // characteristic pits (elongated horizontally)
  ctx.save();
  for (let i = 0; i < 120; i++) {
    const x = rng() * s;
    const y = rng() * s;
    const w = s * (0.004 + rng() * 0.02);
    ctx.fillStyle = rng() > 0.5 ? "#9C8664" : "#B39C76";
    ctx.globalAlpha = 0.5 + rng() * 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const paintTerrazzo = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#EEE8DD";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 30, rng, 0.08, "multiply");
  const chipColors = ["#FF703D", "#121820", "#8E98A3", "#C9BBA5", "#5B6571", "#E2582A", "#D8CFC1", "#2E3946"];
  const weights = [0.12, 0.14, 0.18, 0.2, 0.12, 0.06, 0.1, 0.08];
  const pick = () => {
    let r = rng();
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return chipColors[i];
    }
    return chipColors[0];
  };
  const chip = (sizeMin: number, sizeMax: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const cx = rng() * s;
      const cy = rng() * s;
      const r = sizeMin + rng() * (sizeMax - sizeMin);
      const n = 4 + Math.floor(rng() * 4);
      ctx.fillStyle = pick();
      ctx.beginPath();
      const rot = rng() * Math.PI * 2;
      for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * Math.PI * 2 + (rng() - 0.5) * 0.6;
        const rr = r * (0.55 + rng() * 0.6);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr * (0.7 + rng() * 0.3);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  };
  chip(s * 0.004, s * 0.009, 900);
  chip(s * 0.012, s * 0.024, 140);
  chip(s * 0.03, s * 0.05, 14);
};

const paintStone = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#A9A497";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 6, rng, 0.35, "overlay");
  noiseLayer(ctx, s, 18, rng, 0.3, "overlay");
  noiseLayer(ctx, s, 64, rng, 0.25, "overlay");
  noiseLayer(ctx, s, 8, rng, 0.25, "multiply", [190, 176, 150]);
  speckle(ctx, s, rng, 1400, ["#7D776B", "#C8C2B4", "#8D8778", "#5F5A50"], 0.5, s * 0.004, 0.5);
  // fossil-ish fragments
  for (let i = 0; i < 18; i++) {
    ctx.save();
    ctx.strokeStyle = "#D6D0C2";
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const x = rng() * s;
    const y = rng() * s;
    ctx.arc(x, y, s * (0.005 + rng() * 0.012), rng() * 3, rng() * 3 + 2);
    ctx.stroke();
    ctx.restore();
  }
};

const paintPorcelain = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#BDB6AC";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 12, rng, 0.12, "overlay");
  speckle(ctx, s, rng, 2600, ["#A39C92", "#CEC8BF", "#948D83"], 0.4, 1.4, 0.55);
};

const paintNeutral = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#DCD5CA";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 8, rng, 0.12, "overlay");
  // subtle linear "cement-look" brushing
  ctx.save();
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = rng() > 0.5 ? "#CFC7BB" : "#E6E0D6";
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 0.6 + rng() * 1.5;
    const y = rng() * s;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.bezierCurveTo(s * 0.3, y + (rng() - 0.5) * 8, s * 0.6, y + (rng() - 0.5) * 8, s + 10, y + (rng() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.restore();
};

/** Hero tile: ivory glaze with an orange 8-point star (khatam-inspired geometric motif). */
const paintHero = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#F4EFE6";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 14, rng, 0.07, "multiply");
  const c = s / 2;
  const star = (r: number, inner: number) => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * inner;
      const x = c + Math.cos(a) * rr;
      const y = c + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  // corner quarter-circles -> forms a continuous pattern when tiled
  ctx.strokeStyle = "#FF703D";
  ctx.lineWidth = s * 0.035;
  for (const [x, y] of [
    [0, 0],
    [s, 0],
    [0, s],
    [s, s],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#FF703D";
  star(s * 0.36, 0.72);
  ctx.fill();
  ctx.fillStyle = "#F4EFE6";
  star(s * 0.25, 0.72);
  ctx.fill();
  ctx.fillStyle = "#121820";
  star(s * 0.12, 0.72);
  ctx.fill();
  // glaze pooling at edges
  edgeShade(ctx, s, 0.18);
};

/* ------------------------------------------------------------------ */
/* Wrong / clashing materials (for the investigation)                  */
/* ------------------------------------------------------------------ */

const paintPool = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#E9F1F2";
  ctx.fillRect(0, 0, s, s);
  const n = 8;
  const cell = s / n;
  const blues = ["#2F86B8", "#3A9BCB", "#1F6E9E", "#5BB3D6", "#2A7CAE", "#7CC6E0"];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = blues[Math.floor(rng() * blues.length)];
      ctx.fillRect(i * cell + cell * 0.06, j * cell + cell * 0.06, cell * 0.88, cell * 0.88);
    }
};

const paintChecker = (ctx: Ctx, s: number) => {
  const n = 4;
  const cell = s / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? "#141414" : "#F7F7F2";
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
};

const paintFloral = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#7B3F8C";
  ctx.fillRect(0, 0, s, s);
  const petal = (x: number, y: number, r: number, col: string) => {
    ctx.fillStyle = col;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, r * 0.3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#F5D21E";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < 9; i++) {
    petal(rng() * s, rng() * s, s * (0.06 + rng() * 0.08), rng() > 0.5 ? "#4CC25A" : "#F25A8C");
  }
};

const paintStripe = (ctx: Ctx, s: number) => {
  const n = 10;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#E8C21A" : "#1B6F4A";
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-s, -s + (i * 2 * s) / n, 2 * s, s / n);
    ctx.restore();
  }
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#E8C21A" : "#1B6F4A";
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-s, -s + ((i * 2 + 1) * s) / n, 2 * s, s / n);
    ctx.restore();
  }
};

const paintTerracotta = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#B4532E";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 10, rng, 0.3, "overlay");
  noiseLayer(ctx, s, 50, rng, 0.2, "overlay");
  speckle(ctx, s, rng, 500, ["#8E3B1E", "#C96A41", "#7A2F17"], 0.6, 2.2, 0.6);
  edgeShade(ctx, s, 0.3);
};

const paintGlossyGreen = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#3E8E66";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 8, rng, 0.2, "overlay");
  edgeShade(ctx, s, 0.35);
};

const paintBlueWhite = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#F3F1EA";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 12, rng, 0.06, "multiply");
  ctx.strokeStyle = "#2B4C8C";
  ctx.lineWidth = s * 0.03;
  ctx.strokeRect(s * 0.08, s * 0.08, s * 0.84, s * 0.84);
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.15);
  ctx.lineTo(s * 0.85, s * 0.5);
  ctx.lineTo(s * 0.5, s * 0.85);
  ctx.lineTo(s * 0.15, s * 0.5);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "#2B4C8C";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  edgeShade(ctx, s, 0.2);
};

const paintGrayCheap = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#9EA3A6";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 16, rng, 0.25, "overlay");
  speckle(ctx, s, rng, 900, ["#7D8285", "#B9BEC0"], 0.5, 1.8, 0.6);
  edgeShade(ctx, s, 0.25);
};

/* ------------------------------------------------------------------ */
/* Utility surfaces                                                     */
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

/** Cement mortar bed with notched-trowel ridges (what's left when the floor quits). */
const paintMortar = (ctx: Ctx, s: number, rng: Rng) => {
  ctx.fillStyle = "#6E6A64";
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 16, rng, 0.35, "overlay");
  noiseLayer(ctx, s, 80, rng, 0.3, "overlay");
  for (let i = 0; i < 14; i++) {
    const y = (i + 0.5) * (s / 14);
    ctx.strokeStyle = "rgba(40,38,35,0.45)";
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= s; x += s / 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(160,155,148,0.35)";
    ctx.lineWidth = s * 0.008;
    ctx.beginPath();
    ctx.moveTo(0, y - s * 0.014);
    for (let x = 0; x <= s; x += s / 20) ctx.lineTo(x, y - s * 0.014 + Math.sin(x * 0.05 + i) * 2);
    ctx.stroke();
  }
};

const paintPlaster = (ctx: Ctx, s: number, rng: Rng, base: string) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  noiseLayer(ctx, s, 12, rng, 0.08, "overlay");
  noiseLayer(ctx, s, 60, rng, 0.05, "overlay");
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

/** Fabric weave for sofas. */
const paintFabric = (ctx: Ctx, s: number, rng: Rng, base: string) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < s; i += 3) {
    ctx.fillStyle = i % 6 === 0 ? "#000" : "#fff";
    ctx.fillRect(0, i, s, 1);
    ctx.fillRect(i, 0, 1, s);
  }
  ctx.globalAlpha = 1;
  noiseLayer(ctx, s, 20, rng, 0.1, "overlay");
};

/** Protest sign: a bold hand-painted ✕ (drawn with strokes — no font dependency). */
const paintSign = (ctx: Ctx, s: number) => {
  ctx.fillStyle = "#F2EDE4";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#FF703D";
  ctx.lineCap = "round";
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(s * 0.26, s * 0.26);
  ctx.lineTo(s * 0.74, s * 0.74);
  ctx.moveTo(s * 0.74, s * 0.26);
  ctx.lineTo(s * 0.26, s * 0.74);
  ctx.stroke();
  ctx.strokeStyle = "#121820";
  ctx.lineWidth = s * 0.035;
  ctx.strokeRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
};

/* ------------------------------------------------------------------ */

export type TexKey =
  | "marble"
  | "travertine"
  | "terrazzo"
  | "stone"
  | "porcelain"
  | "neutral"
  | "hero"
  | "pool"
  | "checker"
  | "floral"
  | "stripe"
  | "terracotta"
  | "green"
  | "bluewhite"
  | "gray"
  | "clay"
  | "mortar"
  | "plasterIvory"
  | "plasterNight"
  | "plasterStone"
  | "oak"
  | "fabricCharcoal"
  | "fabricIvory"
  | "sign";

const PAINTERS: Record<TexKey, (ctx: Ctx, s: number, rng: Rng) => void> = {
  marble: paintMarble,
  travertine: paintTravertine,
  terrazzo: paintTerrazzo,
  stone: paintStone,
  porcelain: paintPorcelain,
  neutral: paintNeutral,
  hero: paintHero,
  pool: paintPool,
  checker: (c, s) => paintChecker(c, s),
  floral: paintFloral,
  stripe: (c, s) => paintStripe(c, s),
  terracotta: paintTerracotta,
  green: paintGlossyGreen,
  bluewhite: paintBlueWhite,
  gray: paintGrayCheap,
  clay: paintClayBack,
  mortar: paintMortar,
  plasterIvory: (c, s, r) => paintPlaster(c, s, r, "#EAE3D8"),
  plasterNight: (c, s, r) => paintPlaster(c, s, r, "#C9C3BA"),
  plasterStone: (c, s, r) => paintPlaster(c, s, r, "#D8CFC2"),
  oak: paintOak,
  fabricCharcoal: (c, s, r) => paintFabric(c, s, r, "#2B3442"),
  fabricIvory: (c, s, r) => paintFabric(c, s, r, "#E9E2D6"),
  sign: (c, s) => paintSign(c, s),
};

const SEEDS: Record<TexKey, number> = {
  marble: 11,
  travertine: 23,
  terrazzo: 37,
  stone: 41,
  porcelain: 53,
  neutral: 67,
  hero: 71,
  pool: 83,
  checker: 97,
  floral: 101,
  stripe: 113,
  terracotta: 127,
  green: 131,
  bluewhite: 139,
  gray: 149,
  clay: 151,
  mortar: 163,
  plasterIvory: 173,
  plasterNight: 179,
  plasterStone: 181,
  oak: 191,
  fabricCharcoal: 193,
  fabricIvory: 197,
  sign: 199,
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
