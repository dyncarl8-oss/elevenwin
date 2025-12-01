import * as THREE from "three";
import { useRef, MutableRefObject, memo, useMemo } from "react";
import { useFrame } from "@react-three/fiber";

interface BlockyCharacterProps {
  color?: string;
  isLocal?: boolean;
  weaponType?: "sniper" | "pistol" | "none";
  isMoving?: boolean;
  isJumping?: boolean;
  isMovingRef?: MutableRefObject<boolean>;
  isJumpingRef?: MutableRefObject<boolean>;
}

const headGeometry = new THREE.BoxGeometry(0.55, 0.55, 0.55);
const faceGeometry = new THREE.BoxGeometry(0.35, 0.35, 0.08);
const eyeGeometry = new THREE.BoxGeometry(0.08, 0.06, 0.02);
const torsoGeometry = new THREE.BoxGeometry(0.7, 0.8, 0.35);
const armGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.2);
const handGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const legGeometry = new THREE.BoxGeometry(0.25, 0.5, 0.25);
const footGeometry = new THREE.BoxGeometry(0.22, 0.12, 0.28);

const skinMaterial = new THREE.MeshStandardMaterial({ color: "#ffe4c4" });
const eyesMaterial = new THREE.MeshStandardMaterial({ color: "#222222" });
const pantsMaterial = new THREE.MeshStandardMaterial({ color: "#444444" });
const shoesMaterial = new THREE.MeshStandardMaterial({ color: "#333333" });

const blueMaterials = {
  head: new THREE.MeshStandardMaterial({ color: "#4a90e2" }),
  arm: new THREE.MeshStandardMaterial({ color: "#4a90e2" }),
  torso: new THREE.MeshStandardMaterial({ color: "#2c5aa0" }),
};

const redMaterials = {
  head: new THREE.MeshStandardMaterial({ color: "#ef4444" }),
  arm: new THREE.MeshStandardMaterial({ color: "#ef4444" }),
  torso: new THREE.MeshStandardMaterial({ color: "#991b1b" }),
};

const BlockyCharacter = memo(function BlockyCharacter({
  color = "#4a90e2",
  isLocal = false,
  weaponType = "none",
  isMoving = false,
  isJumping = false,
  isMovingRef,
  isJumpingRef,
}: BlockyCharacterProps) {
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const animTime = useRef(0);

  const materials = color === "#4a90e2" ? blueMaterials : redMaterials;

  const armRotations = useMemo(() => {
    if (weaponType === "sniper") {
      return {
        leftArm: [-1.6, -0.5, 0.5] as [number, number, number],
        rightArm: [-1.45, 0.6, -0.6] as [number, number, number],
      };
    } else if (weaponType === "pistol") {
      return {
        leftArm: [0, 0, 0.05] as [number, number, number],
        rightArm: [-1.25, 0.1, -0.3] as [number, number, number],
      };
    }
    return {
      leftArm: [0, 0, 0.1] as [number, number, number],
      rightArm: [0, 0, -0.1] as [number, number, number],
    };
  }, [weaponType]);

  useFrame((state, delta) => {
    const moving = isMovingRef?.current ?? isMoving;
    const jumping = isJumpingRef?.current ?? isJumping;

    if (moving && !jumping) {
      animTime.current += delta * 8;
      const swing = Math.sin(animTime.current) * 0.6;

      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = swing;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = -swing;
      }
      if (leftArmRef.current) {
        if (weaponType === "pistol" || weaponType === "none") {
          leftArmRef.current.rotation.x = armRotations.leftArm[0] + -swing * 0.5;
        }
      }
    } else if (jumping) {
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -0.3;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = -0.3;
      }
    } else {
      animTime.current = 0;
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = 0;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = 0;
      }
    }

    if (leftArmRef.current && !moving) {
      leftArmRef.current.rotation.x = armRotations.leftArm[0];
      leftArmRef.current.rotation.y = armRotations.leftArm[1];
      leftArmRef.current.rotation.z = armRotations.leftArm[2];
    }
  });

  return (
    <group>
      <mesh castShadow position={[0, 1.5, 0]} geometry={headGeometry} material={materials.head} />
      <mesh castShadow position={[0, 1.5, 0.3]} geometry={faceGeometry} material={skinMaterial} />
      <mesh position={[-0.1, 1.55, 0.35]} geometry={eyeGeometry} material={eyesMaterial} />
      <mesh position={[0.1, 1.55, 0.35]} geometry={eyeGeometry} material={eyesMaterial} />
      <mesh castShadow position={[0, 0.95, 0]} geometry={torsoGeometry} material={materials.torso} />

      <group ref={leftArmRef} position={[-0.38, 1.15, 0.02]} rotation={armRotations.leftArm}>
        <mesh castShadow position={[0, -0.25, 0]} geometry={armGeometry} material={materials.arm} />
        <mesh castShadow position={[0, -0.55, 0.05]} geometry={handGeometry} material={skinMaterial} />
      </group>

      <group position={[0.38, 1.15, 0.02]} rotation={armRotations.rightArm}>
        <mesh castShadow position={[0, -0.25, 0]} geometry={armGeometry} material={materials.arm} />
        <mesh castShadow position={[0, -0.55, 0.05]} geometry={handGeometry} material={skinMaterial} />
      </group>

      <group ref={leftLegRef} position={[-0.18, 0.55, 0]}>
        <mesh castShadow position={[0, -0.2, 0]} geometry={legGeometry} material={pantsMaterial} />
        <mesh castShadow position={[0, -0.47, 0.05]} geometry={footGeometry} material={shoesMaterial} />
      </group>

      <group ref={rightLegRef} position={[0.18, 0.55, 0]}>
        <mesh castShadow position={[0, -0.2, 0]} geometry={legGeometry} material={pantsMaterial} />
        <mesh castShadow position={[0, -0.47, 0.05]} geometry={footGeometry} material={shoesMaterial} />
      </group>
    </group>
  );
});

export default BlockyCharacter;
