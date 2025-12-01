import { useRef, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Player } from "@/lib/stores/useGameStore";
import BlockyCharacter from "./BlockyCharacter";
import ProceduralWeapon from "./ProceduralWeapons";

interface RemotePlayerProps {
  player: Player;
}

const RemotePlayer = memo(function RemotePlayer({ player }: RemotePlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const weaponGroupRef = useRef<THREE.Group>(null);
  const targetPosition = useRef(
    new THREE.Vector3(player.position.x, 0, player.position.z),
  );
  const targetRotation = useRef(player.rotation.y);
  const targetPitch = useRef(player.rotation.x || 0);
  const prevTargetPosition = useRef(
    new THREE.Vector3(player.position.x, 0, player.position.z),
  );
  const lastTargetY = useRef(0);
  const isAirborne = useRef(false);
  const stableFrames = useRef(0);
  const lastMovementTime = useRef(0);
  const isMovingRef = useRef(false);
  const isJumpingRef = useRef(false);
  const MOVEMENT_DECAY_MS = 400;

  useEffect(() => {
    const groundY = 0;
    const newY = player.position.y || 0;
    const yDelta = newY - lastTargetY.current;
    const absYDelta = Math.abs(yDelta);

    if (absYDelta > 0.04) {
      isAirborne.current = true;
      stableFrames.current = 0;
    } else {
      stableFrames.current++;
      if (stableFrames.current > 8) {
        isAirborne.current = false;
      }
    }

    const horizontalDist = Math.sqrt(
      Math.pow(player.position.x - prevTargetPosition.current.x, 2) +
        Math.pow(player.position.z - prevTargetPosition.current.z, 2),
    );

    if (horizontalDist > 0.01) {
      lastMovementTime.current = Date.now();
    }

    prevTargetPosition.current.set(
      player.position.x,
      groundY,
      player.position.z,
    );
    lastTargetY.current = newY;
    targetPosition.current.set(
      player.position.x,
      groundY,
      player.position.z,
    );
    targetRotation.current = player.rotation.y;
    targetPitch.current = player.rotation.x || 0;
  }, [player.position, player.rotation]);

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.position.lerp(targetPosition.current, 0.2);

    const currentRotation = groupRef.current.rotation.y;
    const diff = targetRotation.current - currentRotation;
    const shortestDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    groupRef.current.rotation.y += shortestDiff * 0.15;

    if (weaponGroupRef.current) {
      weaponGroupRef.current.rotation.x = targetPitch.current;
    }

    const timeSinceMovement = Date.now() - lastMovementTime.current;
    isMovingRef.current = timeSinceMovement < MOVEMENT_DECAY_MS;
    isJumpingRef.current = isAirborne.current;
  });

  if (!player.isAlive) {
    return null;
  }

  const weaponType = (player.weapon === "sniper" ? "sniper" : "pistol") as
    | "sniper"
    | "pistol";

  const weaponConfig =
    weaponType === "sniper"
      ? {
          position: [-0.05, 1.38, 0.5] as [number, number, number],
          rotation: [0, 0.15, 0] as [number, number, number],
          scale: 0.8,
        }
      : {
          position: [0.24, 1.1, 0.58] as [number, number, number],
          rotation: [0, -0.35, 0] as [number, number, number],
          scale: 1,
        };

  return (
    <group
      ref={groupRef}
      position={[player.position.x, 0, player.position.z]}
    >
      <BlockyCharacter
        color="#ef4444"
        weaponType={weaponType}
        isMovingRef={isMovingRef}
        isJumpingRef={isJumpingRef}
      />
      <group
        ref={weaponGroupRef}
        position={weaponConfig.position}
        rotation={weaponConfig.rotation}
      >
        <group scale={weaponConfig.scale}>
          <ProceduralWeapon weaponType={weaponType} />
        </group>
      </group>
    </group>
  );
});

export default RemotePlayer;
