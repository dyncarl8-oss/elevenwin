import { useRef, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "@/lib/stores/useGameStore";
import { checkPointCollision } from "@/lib/collisionData";

const checkRayCollision = (
  startX: number, startY: number, startZ: number,
  endX: number, endY: number, endZ: number
): boolean => {
  const dx = endX - startX;
  const dy = endY - startY;
  const dz = endZ - startZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  if (distance < 0.1) {
    return checkPointCollision(endX, endY, endZ);
  }
  
  const stepSize = 0.3;
  const steps = Math.ceil(distance / stepSize);
  
  const stepX = dx / steps;
  const stepY = dy / steps;
  const stepZ = dz / steps;
  
  for (let i = 1; i <= steps; i++) {
    const checkX = startX + stepX * i;
    const checkY = startY + stepY * i;
    const checkZ = startZ + stepZ * i;
    
    if (checkPointCollision(checkX, checkY, checkZ)) {
      return true;
    }
  }
  
  return false;
};

interface BulletsProps {
  sendMessage: (type: string, payload: any) => void;
}

const reusableDirection = new THREE.Vector3();
const reusableMovement = new THREE.Vector3();
const reusablePlayerPos = new THREE.Vector3();
const reusableMatrix = new THREE.Matrix4();
const reusableQuaternion = new THREE.Quaternion();
const reusableScale = new THREE.Vector3(1, 1, 1);
const reusableLookAt = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

const pistolBulletGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6);
pistolBulletGeometry.rotateX(Math.PI / 2);

const sniperBulletGeometry = new THREE.CylinderGeometry(0.04, 0.03, 0.4, 6);
sniperBulletGeometry.rotateX(Math.PI / 2);

const pistolMaterial = new THREE.MeshStandardMaterial({
  color: "#ffcc00",
  emissive: "#ff8800",
  emissiveIntensity: 1.5,
  metalness: 0.9,
  roughness: 0.1,
});

const sniperMaterial = new THREE.MeshStandardMaterial({
  color: "#00ffff",
  emissive: "#00aaff",
  emissiveIntensity: 2,
  metalness: 0.9,
  roughness: 0.1,
});

const MAX_BULLETS = 50;

const Bullets = memo(function Bullets({ sendMessage }: BulletsProps) {
  const bullets = useGameStore((s) => s.bullets);
  const players = useGameStore((s) => s.players);
  const removeBullet = useGameStore((s) => s.removeBullet);
  
  const pistolMeshRef = useRef<THREE.InstancedMesh>(null);
  const sniperMeshRef = useRef<THREE.InstancedMesh>(null);
  const bulletPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const processedHits = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentBulletIds = new Set(bullets.map((b) => b.id));
    
    bulletPositions.current.forEach((_, id) => {
      if (!currentBulletIds.has(id)) {
        bulletPositions.current.delete(id);
        processedHits.current.delete(id);
      }
    });

    bullets.forEach((bullet) => {
      if (!bulletPositions.current.has(bullet.id)) {
        bulletPositions.current.set(
          bullet.id,
          new THREE.Vector3(bullet.position.x, bullet.position.y, bullet.position.z)
        );
      }
    });
  }, [bullets]);

  useFrame((state, delta) => {
    const bulletsToRemove: string[] = [];
    
    let pistolIndex = 0;
    let sniperIndex = 0;
    
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      const pos = bulletPositions.current.get(bullet.id);
      if (!pos) continue;

      const oldX = pos.x;
      const oldY = pos.y;
      const oldZ = pos.z;

      reusableDirection.set(bullet.direction.x, bullet.direction.y, bullet.direction.z).normalize();

      const speed = bullet.speed * delta * 2;
      reusableMovement.copy(reusableDirection).multiplyScalar(speed);
      pos.add(reusableMovement);

      if (
        Math.abs(pos.x) > 50 ||
        Math.abs(pos.z) > 50 ||
        pos.y < -1 ||
        pos.y > 20
      ) {
        bulletsToRemove.push(bullet.id);
        continue;
      }

      if (checkRayCollision(oldX, oldY, oldZ, pos.x, pos.y, pos.z)) {
        bulletsToRemove.push(bullet.id);
        continue;
      }

      if (!processedHits.current.has(bullet.id) && bullet.weaponType !== "sniper") {
        const playersArray = Array.from(players.values());
        for (let j = 0; j < playersArray.length; j++) {
          const player = playersArray[j];
          if (player.id === bullet.playerId || !player.isAlive) continue;

          const playerBaseY = player.position.y;
          const playerFeetY = playerBaseY + 0.1;
          const playerHeadY = playerBaseY + 1.8;
          const bodyRadius = 0.6;
          
          const clampedY = Math.max(playerFeetY, Math.min(playerHeadY, pos.y));
          
          const dx = pos.x - player.position.x;
          const dy = pos.y - clampedY;
          const dz = pos.z - player.position.z;
          const distanceToCapsule = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distanceToCapsule < bodyRadius) {
            processedHits.current.add(bullet.id);
            sendMessage("hit", {
              targetPlayerId: player.id,
              damage: bullet.damage,
            });
            bulletsToRemove.push(bullet.id);
            break;
          }
        }
      }

      reusableLookAt.copy(pos).add(reusableDirection);
      reusableQuaternion.setFromRotationMatrix(
        reusableMatrix.lookAt(pos, reusableLookAt, upVector)
      );

      reusableMatrix.compose(pos, reusableQuaternion, reusableScale);

      if (bullet.weaponType === "sniper") {
        if (sniperMeshRef.current && sniperIndex < MAX_BULLETS) {
          sniperMeshRef.current.setMatrixAt(sniperIndex, reusableMatrix);
          sniperIndex++;
        }
      } else {
        if (pistolMeshRef.current && pistolIndex < MAX_BULLETS) {
          pistolMeshRef.current.setMatrixAt(pistolIndex, reusableMatrix);
          pistolIndex++;
        }
      }
    }

    if (pistolMeshRef.current) {
      for (let i = pistolIndex; i < MAX_BULLETS; i++) {
        pistolMeshRef.current.setMatrixAt(i, hiddenMatrix);
      }
      pistolMeshRef.current.instanceMatrix.needsUpdate = true;
      pistolMeshRef.current.count = pistolIndex;
    }

    if (sniperMeshRef.current) {
      for (let i = sniperIndex; i < MAX_BULLETS; i++) {
        sniperMeshRef.current.setMatrixAt(i, hiddenMatrix);
      }
      sniperMeshRef.current.instanceMatrix.needsUpdate = true;
      sniperMeshRef.current.count = sniperIndex;
    }

    for (let i = 0; i < bulletsToRemove.length; i++) {
      removeBullet(bulletsToRemove[i]);
    }
  });

  return (
    <group>
      <instancedMesh
        ref={pistolMeshRef}
        args={[pistolBulletGeometry, pistolMaterial, MAX_BULLETS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sniperMeshRef}
        args={[sniperBulletGeometry, sniperMaterial, MAX_BULLETS]}
        frustumCulled={false}
      />
    </group>
  );
});

export default Bullets;
