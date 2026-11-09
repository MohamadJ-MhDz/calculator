import * as THREE from "three";
import type { V3 } from "../anim";

const cam = new THREE.PerspectiveCamera();
const v = new THREE.Vector3();

/** Project a world point to composition pixels using the same camera parameters as <Cam/>. */
export const project = (pos: V3, target: V3, fov: number, point: V3, w = 1080, h = 1920): [number, number] => {
  cam.fov = fov;
  cam.aspect = w / h;
  cam.near = 0.05;
  cam.far = 300;
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.up.set(0, 1, 0);
  cam.lookAt(target[0], target[1], target[2]);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  v.set(point[0], point[1], point[2]).project(cam);
  return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
};

/** Local -> world for a group with position, Y rotation and uniform scale. */
export const toWorld = (local: V3, groupPos: V3, rotY = 0, scale = 1): V3 => {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const x = local[0] * scale;
  const y = local[1] * scale;
  const z = local[2] * scale;
  return [groupPos[0] + x * c + z * s, groupPos[1] + y, groupPos[2] - x * s + z * c];
};
