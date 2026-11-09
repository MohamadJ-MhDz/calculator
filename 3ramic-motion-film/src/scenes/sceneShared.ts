import type { V3 } from "../anim";
import type { TexKey } from "../three/textures";

/**
 * Shared layout for the three miniature rooms so Scene 03 → 04 → 05 keep
 * compositional continuity (same positions, same camera at the hand-offs).
 */
export type RoomSlot = {
  kind: "kitchen" | "bathroom" | "living";
  pos: V3;
  rotY: number;
};

export const ROOM_SLOTS: RoomSlot[] = [
  { kind: "kitchen", pos: [-0.7, 3.44, -0.6], rotY: 0.3 },
  { kind: "living", pos: [0.7, 0, 0], rotY: -0.18 },
  { kind: "bathroom", pos: [-0.5, -3.44, 0.6], rotY: 0.22 },
];

/** Hand-off camera between Scene 04 (end) and Scene 05 (start). */
export const HANDOFF_CAM = { pos: [10.2, 10.8, 23.5] as V3, target: [0, 2.9, 0] as V3, fov: 38 };

/** The correct material plan produced by the (fictional) 3ramic system. */
export const PLAN: Record<RoomSlot["kind"], { floor: TexKey; wall: TexKey; side: TexKey | null; counter: TexKey }> = {
  kitchen: { floor: "terrazzo", wall: "porcelain", side: null, counter: "terrazzo" },
  bathroom: { floor: "travertine", wall: "marble", side: "marble", counter: "terrazzo" },
  living: { floor: "neutral", wall: "stone", side: null, counter: "terrazzo" },
};

export type Sample = { key: TexKey; name: string; spec: string; room: RoomSlot["kind"]; surface: "floor" | "wall" };

export const SAMPLES: Sample[] = [
  { key: "stone", name: "Natural Stone", spec: "SPLIT FACE · TEXTURED", room: "living", surface: "wall" },
  { key: "travertine", name: "Travertine", spec: "HONED · WARM VEIN", room: "bathroom", surface: "floor" },
  { key: "terrazzo", name: "Terrazzo", spec: "CHIP BLEND · DURABLE", room: "kitchen", surface: "floor" },
  { key: "porcelain", name: "Matte Porcelain", spec: "MATTE · EASY-CLEAN", room: "kitchen", surface: "wall" },
  { key: "marble", name: "Marble-Look", spec: "GLOSS · CALACATTA LOOK", room: "bathroom", surface: "wall" },
  { key: "neutral", name: "Modern Neutral", spec: "LARGE FORMAT · CALM", room: "living", surface: "floor" },
];

/** Landing frame (Scene 04 local) of each sample in its room. */
export const LAND_AT: Record<string, number> = {
  terrazzo: 134,
  porcelain: 140,
  travertine: 152,
  marble: 158,
  neutral: 170,
  stone: 176,
};

/* ---------------- Scene 05/06: the re-assembled apartment ---------------- */

/** Rooms re-joined along Z (the reverse of the Scene 03 split). */
export const JOINED: Record<RoomSlot["kind"], V3> = {
  kitchen: [0, 0, -4.45],
  living: [0, 0, 0],
  bathroom: [0, 0, 4.45],
};

/** Each room has a door in its side wall (room-local z) — tiles come home through it. */
export const DOOR_Z: Record<RoomSlot["kind"], number> = { kitchen: -0.5, living: 1.5, bathroom: 0.5 };
export const DOOR = { w: 1.2, h: 1.75 };

/** Floor slots the returning tile characters lie back into (room-local i, j) — all on their door's row, far ones first. */
export const HOLES: { kind: RoomSlot["kind"]; ij: [number, number] }[] = [
  { kind: "bathroom", ij: [3, 2] },
  { kind: "bathroom", ij: [2, 2] },
  { kind: "bathroom", ij: [1, 2] },
  { kind: "living", ij: [3, 3] },
  { kind: "living", ij: [1, 3] },
  { kind: "living", ij: [0, 3] },
  { kind: "kitchen", ij: [3, 1] },
  { kind: "kitchen", ij: [2, 1] },
  { kind: "kitchen", ij: [1, 1] }, // the macro shot
];

/** The hero's own accent spot — left empty until the very end. */
export const HERO_HOLE = { kind: "living" as const, ij: [2, 3] as [number, number] };

export const STUDIO_FLOOR_Y = -0.42;

/** Room-local tile centre → world (joined layout, w = d = 4). */
export const holeWorld = (kind: RoomSlot["kind"], ij: [number, number]): V3 => {
  const r = JOINED[kind];
  return [r[0] - 2 + 0.5 + ij[0], 0, r[2] - 2 + 0.5 + ij[1]];
};
