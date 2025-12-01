import * as THREE from "three";

export const sharedGeometries = {
  box1x1x1: new THREE.BoxGeometry(1, 1, 1),
  crate: new THREE.BoxGeometry(1.5, 1.5, 1.5),
  barrel: new THREE.BoxGeometry(0.8, 1.2, 0.8),
  trunk: new THREE.CylinderGeometry(0.3, 0.4, 4, 8),
  foliageLarge: new THREE.ConeGeometry(2.5, 3.75, 8),
  foliageSmall: new THREE.ConeGeometry(1.75, 3, 8),
  mountain: new THREE.ConeGeometry(1, 1, 4),
  wall: new THREE.BoxGeometry(1, 1, 1),
  bulletPistol: (() => {
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6);
    geo.rotateX(Math.PI / 2);
    return geo;
  })(),
  bulletSniper: (() => {
    const geo = new THREE.CylinderGeometry(0.04, 0.03, 0.4, 6);
    geo.rotateX(Math.PI / 2);
    return geo;
  })(),
};

export const sharedMaterials = {
  crate: new THREE.MeshStandardMaterial({ color: "#8B4513" }),
  barrel: new THREE.MeshStandardMaterial({ color: "#4A4A4A" }),
  wall: new THREE.MeshStandardMaterial({ color: "#8b7355", roughness: 0.9 }),
  foliageDark: new THREE.MeshStandardMaterial({ color: "#2d5016" }),
  foliageLight: new THREE.MeshStandardMaterial({ color: "#3d6b1f" }),
  mountain: new THREE.MeshStandardMaterial({ color: "#5a6670" }),
  ground: new THREE.MeshStandardMaterial({ color: "#7cb342" }),
  bulletPistol: new THREE.MeshStandardMaterial({
    color: "#ffcc00",
    emissive: "#ff8800",
    emissiveIntensity: 1.5,
    metalness: 0.9,
    roughness: 0.1,
  }),
  bulletSniper: new THREE.MeshStandardMaterial({
    color: "#00ffff",
    emissive: "#00aaff",
    emissiveIntensity: 2,
    metalness: 0.9,
    roughness: 0.1,
  }),
  characterBlue: new THREE.MeshStandardMaterial({ color: "#4a90e2" }),
  characterRed: new THREE.MeshStandardMaterial({ color: "#ef4444" }),
  torsoBlue: new THREE.MeshStandardMaterial({ color: "#2c5aa0" }),
  torsoRed: new THREE.MeshStandardMaterial({ color: "#991b1b" }),
  skin: new THREE.MeshStandardMaterial({ color: "#ffe4c4" }),
  eyes: new THREE.MeshStandardMaterial({ color: "#222222" }),
  pants: new THREE.MeshStandardMaterial({ color: "#444444" }),
  shoes: new THREE.MeshStandardMaterial({ color: "#333333" }),
};

export const characterGeometries = {
  head: new THREE.BoxGeometry(0.55, 0.55, 0.55),
  face: new THREE.BoxGeometry(0.35, 0.35, 0.08),
  eye: new THREE.BoxGeometry(0.08, 0.06, 0.02),
  torso: new THREE.BoxGeometry(0.7, 0.8, 0.35),
  arm: new THREE.BoxGeometry(0.2, 0.5, 0.2),
  hand: new THREE.BoxGeometry(0.15, 0.15, 0.15),
  leg: new THREE.BoxGeometry(0.25, 0.5, 0.25),
  foot: new THREE.BoxGeometry(0.22, 0.12, 0.28),
};

export function disposeGeometries() {
  Object.values(sharedGeometries).forEach((geo) => geo.dispose());
  Object.values(characterGeometries).forEach((geo) => geo.dispose());
}

export function disposeMaterials() {
  Object.values(sharedMaterials).forEach((mat) => mat.dispose());
}
