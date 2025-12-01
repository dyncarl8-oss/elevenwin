import { useRef, useEffect, useMemo, memo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { sharedMaterials } from "@/lib/sharedGeometries";

const treeData = [
  { pos: [-55, 0, -55], seed: 1 },
  { pos: [-55, 0, 55], seed: 2 },
  { pos: [55, 0, -55], seed: 3 },
  { pos: [55, 0, 55], seed: 4 },
  { pos: [-60, 0, -30], seed: 5 },
  { pos: [-60, 0, 0], seed: 6 },
  { pos: [-60, 0, 30], seed: 7 },
  { pos: [60, 0, -30], seed: 8 },
  { pos: [60, 0, 0], seed: 9 },
  { pos: [60, 0, 30], seed: 10 },
  { pos: [-30, 0, -60], seed: 11 },
  { pos: [0, 0, -60], seed: 12 },
  { pos: [30, 0, -60], seed: 13 },
  { pos: [-30, 0, 60], seed: 14 },
  { pos: [0, 0, 60], seed: 15 },
  { pos: [30, 0, 60], seed: 16 },
];

const mountainData = [
  { pos: [-75, 0, -75], size: 18 },
  { pos: [75, 0, -75], size: 20 },
  { pos: [-75, 0, 75], size: 19 },
  { pos: [75, 0, 75], size: 21 },
  { pos: [0, 0, -80], size: 22 },
  { pos: [0, 0, 80], size: 21 },
  { pos: [-80, 0, 0], size: 17 },
  { pos: [80, 0, 0], size: 18 },
];

const wallData = [
  { pos: [-25, 1.5, 0], size: [1, 3, 10], rot: 0 },
  { pos: [25, 1.5, 0], size: [1, 3, 10], rot: 0 },
  { pos: [0, 1.5, -25], size: [10, 3, 1], rot: 0 },
  { pos: [0, 1.5, 25], size: [10, 3, 1], rot: 0 },
  { pos: [-35, 1.5, -20], size: [8, 3, 1], rot: Math.PI / 4 },
  { pos: [35, 1.5, -20], size: [8, 3, 1], rot: -Math.PI / 4 },
  { pos: [-35, 1.5, 20], size: [8, 3, 1], rot: -Math.PI / 4 },
  { pos: [35, 1.5, 20], size: [8, 3, 1], rot: Math.PI / 4 },
];

const crateData = [
  { pos: [-15, 0.75, -15], rot: 0 },
  { pos: [15, 0.75, 15], rot: Math.PI / 4 },
  { pos: [0, 0.75, 20], rot: Math.PI / 3 },
  { pos: [0, 0.75, -20], rot: -Math.PI / 6 },
  { pos: [-10, 0.75, -25], rot: 0 },
  { pos: [10, 0.75, 25], rot: 0 },
  { pos: [-30, 0.75, -30], rot: Math.PI / 6 },
  { pos: [30, 0.75, 30], rot: -Math.PI / 4 },
];

const barrelData = [
  { pos: [-15, 0.6, 15] },
  { pos: [15, 0.6, -15] },
  { pos: [-20, 0.6, 0] },
  { pos: [20, 0.6, 0] },
  { pos: [-25, 0.6, -10] },
  { pos: [25, 0.6, 10] },
  { pos: [-30, 0.6, 30] },
  { pos: [30, 0.6, -30] },
];

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1, 6);
const foliageLargeGeometry = new THREE.ConeGeometry(1, 1.5, 6);
const foliageSmallGeometry = new THREE.ConeGeometry(0.7, 1.2, 6);
const mountainGeometry = new THREE.ConeGeometry(1, 1, 4);
const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
const crateGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const barrelGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.8);
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const arenaCircleGeometry = new THREE.CircleGeometry(55, 32);

const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#8B4513" });
const foliageDarkMaterial = new THREE.MeshStandardMaterial({ color: "#2d5016" });
const foliageLightMaterial = new THREE.MeshStandardMaterial({ color: "#3d6b1f" });

const InstancedTrees = memo(function InstancedTrees() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageLargeRef = useRef<THREE.InstancedMesh>(null);
  const foliageSmallRef = useRef<THREE.InstancedMesh>(null);
  
  const treeParams = useMemo(() => {
    return treeData.map((tree) => ({
      pos: tree.pos,
      trunkHeight: 3 + seededRandom(tree.seed) * 2,
      foliageSize: 2 + seededRandom(tree.seed + 100) * 1,
    }));
  }, []);

  useEffect(() => {
    if (!trunkRef.current || !foliageLargeRef.current || !foliageSmallRef.current) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    treeParams.forEach((tree, i) => {
      position.set(tree.pos[0], tree.trunkHeight / 2, tree.pos[2]);
      scale.set(1, tree.trunkHeight, 1);
      matrix.compose(position, quaternion, scale);
      trunkRef.current!.setMatrixAt(i, matrix);

      position.set(tree.pos[0], tree.trunkHeight + tree.foliageSize / 2, tree.pos[2]);
      scale.set(tree.foliageSize, tree.foliageSize, tree.foliageSize);
      matrix.compose(position, quaternion, scale);
      foliageLargeRef.current!.setMatrixAt(i, matrix);

      position.set(tree.pos[0], tree.trunkHeight + tree.foliageSize, tree.pos[2]);
      scale.set(tree.foliageSize, tree.foliageSize, tree.foliageSize);
      matrix.compose(position, quaternion, scale);
      foliageSmallRef.current!.setMatrixAt(i, matrix);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    foliageLargeRef.current.instanceMatrix.needsUpdate = true;
    foliageSmallRef.current.instanceMatrix.needsUpdate = true;
  }, [treeParams]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, trunkMaterial, treeData.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={foliageLargeRef} args={[foliageLargeGeometry, foliageDarkMaterial, treeData.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={foliageSmallRef} args={[foliageSmallGeometry, foliageLightMaterial, treeData.length]} castShadow frustumCulled={false} />
    </>
  );
});

const InstancedMountains = memo(function InstancedMountains() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    mountainData.forEach((mountain, i) => {
      const height = mountain.size * (0.8 + seededRandom(i + 200) * 0.4);
      position.set(mountain.pos[0], height / 2, mountain.pos[2]);
      scale.set(mountain.size, height, mountain.size);
      matrix.compose(position, quaternion, scale);
      meshRef.current!.setMatrixAt(i, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[mountainGeometry, sharedMaterials.mountain, mountainData.length]} 
      castShadow 
      receiveShadow 
      frustumCulled={false}
    />
  );
});

const InstancedWalls = memo(function InstancedWalls() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();

    wallData.forEach((wall, i) => {
      position.set(wall.pos[0], wall.pos[1], wall.pos[2]);
      euler.set(0, wall.rot, 0);
      quaternion.setFromEuler(euler);
      scale.set(wall.size[0], wall.size[1], wall.size[2]);
      matrix.compose(position, quaternion, scale);
      meshRef.current!.setMatrixAt(i, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[wallGeometry, sharedMaterials.wall, wallData.length]} 
      castShadow 
      receiveShadow 
      frustumCulled={false}
    />
  );
});

const InstancedCrates = memo(function InstancedCrates() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3(1, 1, 1);

    crateData.forEach((crate, i) => {
      position.set(crate.pos[0], crate.pos[1], crate.pos[2]);
      euler.set(0, crate.rot, 0);
      quaternion.setFromEuler(euler);
      matrix.compose(position, quaternion, scale);
      meshRef.current!.setMatrixAt(i, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[crateGeometry, sharedMaterials.crate, crateData.length]} 
      castShadow 
      receiveShadow 
      frustumCulled={false}
    />
  );
});

const InstancedBarrels = memo(function InstancedBarrels() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    barrelData.forEach((barrel, i) => {
      position.set(barrel.pos[0], barrel.pos[1], barrel.pos[2]);
      matrix.compose(position, quaternion, scale);
      meshRef.current!.setMatrixAt(i, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[barrelGeometry, sharedMaterials.barrel, barrelData.length]} 
      castShadow 
      receiveShadow 
      frustumCulled={false}
    />
  );
});

const Ground = memo(function Ground() {
  const grassTexture = useTexture("/textures/grass.png");
  
  useMemo(() => {
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(40, 40);
  }, [grassTexture]);

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]} geometry={groundGeometry} frustumCulled={false}>
        <meshStandardMaterial map={grassTexture} />
      </mesh>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} geometry={arenaCircleGeometry} frustumCulled={false}>
        <meshStandardMaterial color="#7cb342" />
      </mesh>
    </>
  );
});

const Arena = memo(function Arena() {
  return (
    <group>
      <Ground />
      <InstancedWalls />
      <InstancedTrees />
      <InstancedMountains />
      <InstancedCrates />
      <InstancedBarrels />
    </group>
  );
});

export default Arena;
