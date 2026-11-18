import type { V3 } from "../anim";
import { SLOT_POS } from "../three/Bathroom";
import type { CamSpec } from "./stage";

/**
 * THE MASTER ANGLE — the whole room from the open front, a little above eye level.
 * It is used three times on purpose: when we first see the "combination", for the whole
 * makeover, and for the before/after comparison. Same lens, same position, same walls:
 * the viewer can see that only the choices changed, not the six square metres.
 */
export const MASTER: CamSpec = { pos: [0.5, 12.5, 21.5], target: [0, 3.2, -1.0], fov: 36 };
/** Where the slow push during the makeover ends (and where the comparison is held). */
export const MASTER_IN: CamSpec = { pos: [0.42, 11.9, 20.3], target: [0, 3.2, -1.0], fov: 36 };

/** Marks on the floor. */
export const TILE_STAND: V3 = [SLOT_POS[0], 0, SLOT_POS[2] + 0.5]; // beside its own empty place
export const DUCK_STAND: V3 = [-0.78, 0, 5.55];
