import { useRef, useMemo, memo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "@/lib/stores/useGameStore";

const reusableCameraPos = new THREE.Vector3();
const reusableCameraQuat = new THREE.Quaternion();
const reusableOffset = new THREE.Vector3();
const smoothPosition = new THREE.Vector3();
const smoothQuaternion = new THREE.Quaternion();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

interface SkinConfig {
  model: string;
  rotation: [number, number, number];
  scale: number;
  position: [number, number, number];
}

const sniperSkinConfigs: Record<string, SkinConfig> = {
  "sniper_basic": {
    model: "/models/sniper.glb",
    rotation: [0, Math.PI / 2, 0],
    scale: 0.90,
    position: [0.05, -0.08, -0.05],
  },
  "sniper_arctic_white": {
    model: "/models/arctic white.glb",
    rotation: [0, Math.PI, 0],
    scale: 1.70,
    position: [0.05, -0.08, -0.05],
  },
  "sniper_blood_moon": {
    model: "/models/blood moon.glb",
    rotation: [0, Math.PI, 0],
    scale: 1.70,
    position: [0.05, -0.08, -0.05],
  },
  "sniper_cyber_strike": {
    model: "/models/cyber strike.glb",
    rotation: [0, Math.PI, 0],
    scale: 1.70,
    position: [0.05, -0.08, -0.05],
  },
  "sniper_void_reaper": {
    model: "/models/void reaper.glb",
    rotation: [0, Math.PI, 0],
    scale: 1.70,
    position: [0.05, -0.08, -0.05],
  },
};

const pistolSkinConfigs: Record<string, SkinConfig> = {
  "pistol_basic": {
    model: "/models/pistol.glb",
    rotation: [0, -Math.PI / 2, 0],
    scale: 0.35,
    position: [0.05, -0.05, 0.05],
  },
  "pistol_carbon_black": {
    model: "/models/carbon black.glb",
    rotation: [0, Math.PI, 0],
    scale: 0.45,
    position: [0.05, -0.05, 0.05],
  },
  "pistol_gold_plated": {
    model: "/models/gold plated.glb",
    rotation: [0, Math.PI, 0],
    scale: 0.45,
    position: [0.05, -0.05, 0.05],
  },
  "pistol_dragon_fire": {
    model: "/models/dragon fire.glb",
    rotation: [0, Math.PI, 0],
    scale: 0.55,
    position: [0.05, -0.05, 0.05],
  },
  "pistol_neon_pulse": {
    model: "/models/neon pulse.glb",
    rotation: [0, Math.PI, 0],
    scale: 0.45,
    position: [0.05, -0.05, 0.05],
  },
};

const DEFAULT_SNIPER_CONFIG: SkinConfig = sniperSkinConfigs["sniper_basic"];
const DEFAULT_PISTOL_CONFIG: SkinConfig = pistolSkinConfigs["pistol_basic"];

function SniperModel({ config }: { config: SkinConfig }) {
  const { scene } = useGLTF(config.model);
  
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <primitive 
      object={clonedScene} 
      scale={config.scale} 
      rotation={config.rotation}
      position={config.position}
    />
  );
}

function PistolModel({ config }: { config: SkinConfig }) {
  const { scene } = useGLTF(config.model);
  
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <primitive 
      object={clonedScene} 
      scale={config.scale} 
      rotation={config.rotation}
      position={config.position}
    />
  );
}

useGLTF.preload("/models/sniper.glb");
useGLTF.preload("/models/arctic white.glb");
useGLTF.preload("/models/blood moon.glb");
useGLTF.preload("/models/cyber strike.glb");
useGLTF.preload("/models/void reaper.glb");
useGLTF.preload("/models/pistol.glb");
useGLTF.preload("/models/carbon black.glb");
useGLTF.preload("/models/gold plated.glb");
useGLTF.preload("/models/dragon fire.glb");
useGLTF.preload("/models/neon pulse.glb");

const WeaponViewModel = memo(function WeaponViewModel() {
  const currentWeapon = useGameStore((s) => s.currentWeapon);
  const isScoping = useGameStore((s) => s.isScoping);
  const lastShotTime = useGameStore((s) => s.lastShotTime);
  const equippedSkins = useGameStore((s) => s.equippedSkins);
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bobTime = useRef(0);
  const recoilProgress = useRef(0);
  const lastShotTimeRef = useRef(0);

  const sniperConfig = useMemo(() => {
    const skinId = equippedSkins.sniper;
    if (skinId && sniperSkinConfigs[skinId]) {
      console.log("Using sniper skin config:", skinId, sniperSkinConfigs[skinId].model);
      return sniperSkinConfigs[skinId];
    }
    return DEFAULT_SNIPER_CONFIG;
  }, [equippedSkins.sniper]);

  const pistolConfig = useMemo(() => {
    const skinId = equippedSkins.pistol;
    if (skinId && pistolSkinConfigs[skinId]) {
      console.log("Using pistol skin config:", skinId, pistolSkinConfigs[skinId].model);
      return pistolSkinConfigs[skinId];
    }
    return DEFAULT_PISTOL_CONFIG;
  }, [equippedSkins.pistol]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (lastShotTime !== lastShotTimeRef.current) {
      lastShotTimeRef.current = lastShotTime;
      recoilProgress.current = 1;
    }

    if (recoilProgress.current > 0) {
      recoilProgress.current -= delta * 10;
      if (recoilProgress.current < 0) recoilProgress.current = 0;
    }

    const recoilAmount = recoilProgress.current;
    const recoilKickback = currentWeapon === "sniper" ? 0.12 : 0.06;
    const recoilRotation = currentWeapon === "sniper" ? 0.15 : 0.1;

    camera.getWorldPosition(reusableCameraPos);
    camera.getWorldQuaternion(reusableCameraQuat);

    if (isScoping && currentWeapon === "sniper") {
      groupRef.current.visible = false;
    } else {
      groupRef.current.visible = true;

      if (currentWeapon === "sniper") {
        reusableOffset.set(0.25, -0.2 + recoilAmount * 0.04, -0.5 + recoilAmount * recoilKickback);
      } else {
        reusableOffset.set(0.3, -0.2 + recoilAmount * 0.02, -0.4 + recoilAmount * recoilKickback);
      }
      
      reusableOffset.applyQuaternion(reusableCameraQuat);
      
      smoothPosition.copy(reusableCameraPos).add(reusableOffset);
      groupRef.current.position.copy(smoothPosition);
      
      smoothQuaternion.copy(reusableCameraQuat);
      if (currentWeapon === "sniper") {
        tempEuler.set(0.05 - recoilAmount * recoilRotation, -0.1, 0);
      } else {
        tempEuler.set(-recoilAmount * recoilRotation, -0.05, 0);
      }
      tempQuaternion.setFromEuler(tempEuler);
      smoothQuaternion.multiply(tempQuaternion);
      groupRef.current.quaternion.copy(smoothQuaternion);
    }
  });

  return (
    <group ref={groupRef} renderOrder={999}>
      <Suspense fallback={null}>
        {currentWeapon === "sniper" ? (
          <SniperModel key={sniperConfig.model} config={sniperConfig} />
        ) : (
          <PistolModel key={pistolConfig.model} config={pistolConfig} />
        )}
      </Suspense>
    </group>
  );
});

export default WeaponViewModel;
