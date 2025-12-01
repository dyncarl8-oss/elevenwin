export interface CollisionBox {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: number;
}

export const wallData: CollisionBox[] = [
  { pos: [-25, 1.5, 0], size: [1, 3, 10], rot: 0 },
  { pos: [25, 1.5, 0], size: [1, 3, 10], rot: 0 },
  { pos: [0, 1.5, -25], size: [10, 3, 1], rot: 0 },
  { pos: [0, 1.5, 25], size: [10, 3, 1], rot: 0 },
  { pos: [-35, 1.5, -20], size: [8, 3, 1], rot: Math.PI / 4 },
  { pos: [35, 1.5, -20], size: [8, 3, 1], rot: -Math.PI / 4 },
  { pos: [-35, 1.5, 20], size: [8, 3, 1], rot: -Math.PI / 4 },
  { pos: [35, 1.5, 20], size: [8, 3, 1], rot: Math.PI / 4 },
];

export const crateData: CollisionBox[] = [
  { pos: [-15, 0.75, -15], size: [1.5, 1.5, 1.5], rot: 0 },
  { pos: [15, 0.75, 15], size: [1.5, 1.5, 1.5], rot: Math.PI / 4 },
  { pos: [0, 0.75, 20], size: [1.5, 1.5, 1.5], rot: Math.PI / 3 },
  { pos: [0, 0.75, -20], size: [1.5, 1.5, 1.5], rot: -Math.PI / 6 },
  { pos: [-10, 0.75, -25], size: [1.5, 1.5, 1.5], rot: 0 },
  { pos: [10, 0.75, 25], size: [1.5, 1.5, 1.5], rot: 0 },
  { pos: [-30, 0.75, -30], size: [1.5, 1.5, 1.5], rot: Math.PI / 6 },
  { pos: [30, 0.75, 30], size: [1.5, 1.5, 1.5], rot: -Math.PI / 4 },
];

export const barrelData: CollisionBox[] = [
  { pos: [-15, 0.6, 15], size: [0.8, 1.2, 0.8] },
  { pos: [15, 0.6, -15], size: [0.8, 1.2, 0.8] },
  { pos: [-20, 0.6, 0], size: [0.8, 1.2, 0.8] },
  { pos: [20, 0.6, 0], size: [0.8, 1.2, 0.8] },
  { pos: [-25, 0.6, -10], size: [0.8, 1.2, 0.8] },
  { pos: [25, 0.6, 10], size: [0.8, 1.2, 0.8] },
  { pos: [-30, 0.6, 30], size: [0.8, 1.2, 0.8] },
  { pos: [30, 0.6, -30], size: [0.8, 1.2, 0.8] },
];

export const allCollisionBoxes: CollisionBox[] = [...wallData, ...crateData, ...barrelData];

export function checkPointCollision(
  px: number,
  py: number,
  pz: number,
  bulletRadius: number = 0.1
): boolean {
  for (const box of allCollisionBoxes) {
    const [bx, by, bz] = box.pos;
    const [w, h, d] = box.size;
    const rot = box.rot || 0;

    if (rot !== 0) {
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const dx = px - bx;
      const dz = pz - bz;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      if (
        localX + bulletRadius > -w / 2 &&
        localX - bulletRadius < w / 2 &&
        py + bulletRadius > by - h / 2 &&
        py - bulletRadius < by + h / 2 &&
        localZ + bulletRadius > -d / 2 &&
        localZ - bulletRadius < d / 2
      ) {
        return true;
      }
    } else {
      if (
        px + bulletRadius > bx - w / 2 &&
        px - bulletRadius < bx + w / 2 &&
        py + bulletRadius > by - h / 2 &&
        py - bulletRadius < by + h / 2 &&
        pz + bulletRadius > bz - d / 2 &&
        pz - bulletRadius < bz + d / 2
      ) {
        return true;
      }
    }
  }

  return false;
}
