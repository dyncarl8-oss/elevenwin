import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { Controls } from "./Game";
import type { Player } from "@/lib/stores/useGameStore";
import { useGameStore } from "@/lib/stores/useGameStore";
import { WEAPONS, WEAPON_ORDER, type WeaponType } from "@/lib/weapons";
import { playSniperShoot, playPistolShoot, playSniperReload, playPistolReload, playHit, playSniperScope } from "@/lib/sounds";
import { checkPointCollision } from "@/lib/collisionData";

interface LocalPlayerProps {
  player: Player;
  sendMessage: (type: string, payload: any) => void;
}

const reusableVelocityVec = new THREE.Vector3();
const reusableDirection = new THREE.Vector3();
const reusableEuler = new THREE.Euler();
const shootDirection = new THREE.Vector3();
const shootEuler = new THREE.Euler();
const bulletDirection = new THREE.Vector3();
const hitscanRayOrigin = new THREE.Vector3();
const hitscanRayDir = new THREE.Vector3();
const hitscanTestPoint = new THREE.Vector3();

export default function LocalPlayer({ player, sendMessage }: LocalPlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [, getKeys] = useKeyboardControls<Controls>();

  const currentWeapon = useGameStore((s) => s.currentWeapon);
  const ammo = useGameStore((s) => s.ammo);
  const isReloading = useGameStore((s) => s.isReloading);
  const isScoping = useGameStore((s) => s.isScoping);
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const setCurrentWeapon = useGameStore((s) => s.setCurrentWeapon);
  const setAmmo = useGameStore((s) => s.setAmmo);
  const setReloading = useGameStore((s) => s.setReloading);
  const setScoping = useGameStore((s) => s.setScoping);
  const triggerShot = useGameStore((s) => s.triggerShot);
  const equippedSkins = useGameStore((s) => s.equippedSkins);
  const weaponConfig = WEAPONS[currentWeapon];

  const velocity = useRef(new THREE.Vector3());
  const verticalVelocity = useRef(0);
  const isOnGround = useRef(true);
  const isCrouching = useRef(false);
  const lastUpdate = useRef(Date.now());
  const shootCooldown = useRef(0);
  const lastWeaponSwitch = useRef(0);
  const isMouseDown = useRef(false);
  const isRightMouseDown = useRef(false);
  const defaultFov = 75;
  const scopedFov = 25;
  
  const yaw = useRef(player.rotation.y);
  const pitch = useRef(player.rotation.x || 0);
  const [isLocked, setIsLocked] = useState(false);
  const hasInitialized = useRef(false);

  const walls = useMemo(() => [
    { pos: [-25, 1.5, 0], size: [1, 3, 10] },
    { pos: [25, 1.5, 0], size: [1, 3, 10] },
    { pos: [0, 1.5, -25], size: [10, 3, 1] },
    { pos: [0, 1.5, 25], size: [10, 3, 1] },
    { pos: [-35, 1.5, -20], size: [6, 3, 6] },
    { pos: [35, 1.5, -20], size: [6, 3, 6] },
    { pos: [-35, 1.5, 20], size: [6, 3, 6] },
    { pos: [35, 1.5, 20], size: [6, 3, 6] },
  ], []);

  const covers = useMemo(() => [
    { pos: [-15, 0, -15], size: [1.5, 1.5, 1.5] },
    { pos: [15, 0, 15], size: [1.5, 1.5, 1.5] },
    { pos: [-15, 0, 15], size: [0.8, 1.2, 0.8] },
    { pos: [15, 0, -15], size: [0.8, 1.2, 0.8] },
    { pos: [0, 0, 20], size: [1.5, 1.5, 1.5] },
    { pos: [0, 0, -20], size: [1.5, 1.5, 1.5] },
    { pos: [-20, 0, 0], size: [0.8, 1.2, 0.8] },
    { pos: [20, 0, 0], size: [0.8, 1.2, 0.8] },
    { pos: [-10, 0, -25], size: [1.5, 1.5, 1.5] },
    { pos: [10, 0, 25], size: [1.5, 1.5, 1.5] },
    { pos: [-25, 0, -10], size: [0.8, 1.2, 0.8] },
    { pos: [25, 0, 10], size: [0.8, 1.2, 0.8] },
    { pos: [-30, 0, -30], size: [1.5, 1.5, 1.5] },
    { pos: [30, 0, 30], size: [1.5, 1.5, 1.5] },
    { pos: [-30, 0, 30], size: [0.8, 1.2, 0.8] },
    { pos: [30, 0, -30], size: [0.8, 1.2, 0.8] },
  ], []);

  const checkCollision = (newX: number, newZ: number) => {
    const playerRadius = 0.5;
    
    for (const wall of walls) {
      const [wx, wy, wz] = wall.pos;
      const [w, h, d] = wall.size;
      
      if (
        newX + playerRadius > wx - w / 2 &&
        newX - playerRadius < wx + w / 2 &&
        newZ + playerRadius > wz - d / 2 &&
        newZ - playerRadius < wz + d / 2
      ) {
        return true;
      }
    }
    
    for (const cover of covers) {
      const [cx, cy, cz] = cover.pos;
      const [w, h, d] = cover.size;
      
      if (
        newX + playerRadius > cx - w / 2 &&
        newX - playerRadius < cx + w / 2 &&
        newZ + playerRadius > cz - d / 2 &&
        newZ - playerRadius < cz + d / 2
      ) {
        return true;
      }
    }
    
    return false;
  };

  useEffect(() => {
    if (!hasInitialized.current || !isLocked) {
      yaw.current = player.rotation.y;
      if (player.rotation.x !== undefined) {
        pitch.current = player.rotation.x;
      }
      hasInitialized.current = true;
    }
  }, [player.rotation.y, player.rotation.x, isLocked]);

  useEffect(() => {
    if (groupRef.current && player) {
      groupRef.current.position.set(player.position.x, player.position.y, player.position.z);
    }
  }, [player.position]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        const sensitivity = 0.002;
        yaw.current -= event.movementX * sensitivity;
        pitch.current -= event.movementY * sensitivity;
        pitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.current));
      }
    };

    const handlePointerLockChange = () => {
      setIsLocked(document.pointerLockElement === gl.domElement);
    };

    const handleClick = () => {
      if (document.pointerLockElement !== gl.domElement) {
        gl.domElement.requestPointerLock();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        if (event.button === 0) {
          isMouseDown.current = true;
        }
        if (event.button === 2) {
          isRightMouseDown.current = true;
          if (currentWeapon === "sniper" && !isReloading) {
            const newScopingState = !isScoping;
            setScoping(newScopingState);
            if (newScopingState) {
              playSniperScope(equippedSkins.sniper);
            }
          }
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        isMouseDown.current = false;
      }
      if (event.button === 2) {
        isRightMouseDown.current = false;
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("contextmenu", handleContextMenu);
    gl.domElement.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("contextmenu", handleContextMenu);
      gl.domElement.removeEventListener("click", handleClick);
    };
  }, [gl, setScoping, currentWeapon, isReloading, isScoping, equippedSkins.sniper]);

  useFrame((state, delta) => {
    if (!groupRef.current || !player.isAlive) return;

    const keys = getKeys();
    const baseSpeed = 10;
    const crouchSpeed = 4;
    const gravity = -20;
    const jumpPower = 8;
    const groundLevel = 0;
    const normalHeight = 1.6;
    const crouchHeight = 0.8;

    isCrouching.current = keys.crouch;
    const currentSpeed = isCrouching.current ? crouchSpeed : baseSpeed;

    const movement = new THREE.Vector3();

    if (keys.forward) movement.z -= 1;
    if (keys.back) movement.z += 1;
    if (keys.left) movement.x -= 1;
    if (keys.right) movement.x += 1;

    if (movement.length() > 0) {
      movement.normalize();
      movement.multiplyScalar(currentSpeed * delta);

      const rotatedMovement = movement.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current);

      const newX = groupRef.current.position.x + rotatedMovement.x;
      const newZ = groupRef.current.position.z + rotatedMovement.z;

      if (!checkCollision(newX, newZ)) {
        groupRef.current.position.add(rotatedMovement);
      }

      groupRef.current.position.x = Math.max(-65, Math.min(65, groupRef.current.position.x));
      groupRef.current.position.z = Math.max(-65, Math.min(65, groupRef.current.position.z));
    }

    if (groupRef.current.position.y <= groundLevel) {
      groupRef.current.position.y = groundLevel;
      verticalVelocity.current = 0;
      isOnGround.current = true;
    } else {
      isOnGround.current = false;
    }

    if (keys.jump && isOnGround.current && !isCrouching.current) {
      verticalVelocity.current = jumpPower;
      isOnGround.current = false;
      console.log("Player jumping!");
    }

    verticalVelocity.current += gravity * delta;
    groupRef.current.position.y += verticalVelocity.current * delta;

    if (groupRef.current.position.y < groundLevel) {
      groupRef.current.position.y = groundLevel;
      verticalVelocity.current = 0;
      isOnGround.current = true;
    }

    groupRef.current.rotation.y = yaw.current;

    const newPosition = {
      x: groupRef.current.position.x,
      y: groupRef.current.position.y,
      z: groupRef.current.position.z,
    };
    const newRotation = {
      x: pitch.current,
      y: yaw.current,
    };

    const now = Date.now();
    if (now - lastUpdate.current > 50) {
      sendMessage("player_update", {
        position: newPosition,
        rotation: newRotation,
        ammo,
        isReloading,
      });
      lastUpdate.current = now;
    }

    const eyeHeight = isCrouching.current ? 0.8 : 1.6;
    camera.position.set(
      newPosition.x,
      newPosition.y + eyeHeight,
      newPosition.z
    );
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");

    if (isScoping && (currentWeapon !== "sniper" || isReloading)) {
      setScoping(false);
    }
    
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = isScoping ? scopedFov : defaultFov;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.25);
      }
      camera.near = 0.1;
      camera.far = 1000;
      camera.updateProjectionMatrix();
    }

    if (shootCooldown.current > 0) {
      shootCooldown.current -= delta;
    }

    if ((keys.weapon1 || keys.weapon2) && now - lastWeaponSwitch.current > 500 && !isReloading) {
      let newWeapon: WeaponType | null = null;
      if (keys.weapon1) newWeapon = "sniper";
      else if (keys.weapon2) newWeapon = "pistol";

      if (newWeapon && newWeapon !== currentWeapon) {
        setCurrentWeapon(newWeapon);
        const newAmmo = WEAPONS[newWeapon].maxAmmo;
        setAmmo(newAmmo);
        setReloading(false);
        lastWeaponSwitch.current = now;
        sendMessage("weapon_switch", { weapon: newWeapon, ammo: newAmmo });
      }
    }

    if (keys.reload && !isReloading && ammo < weaponConfig.maxAmmo) {
      handleReload();
    }

    const shouldShoot = (keys.shoot || isMouseDown.current) && shootCooldown.current <= 0 && !isReloading && ammo > 0;
    if (shouldShoot) {
      console.log("Shooting! Ammo:", ammo, "Cooldown:", shootCooldown.current);
      handleShoot();
      shootCooldown.current = weaponConfig.fireRate / 1000;
      const newAmmo = ammo - 1;
      setAmmo(newAmmo);
      
      if (currentWeapon === "sniper" && isScoping) {
        setScoping(false);
      }
      
      if (newAmmo === 0) {
        handleReload();
      }
    }
  });

  const handleShoot = () => {
    if (!groupRef.current) return;

    triggerShot();
    
    if (currentWeapon === "sniper") {
      playSniperShoot(equippedSkins.sniper);
    } else {
      playPistolShoot(equippedSkins.pistol);
    }

    shootDirection.set(0, 0, -1);
    shootEuler.set(pitch.current, yaw.current, 0, "YXZ");
    shootDirection.applyEuler(shootEuler);
    shootDirection.normalize();

    const eyeHeight = isCrouching.current ? 0.8 : 1.6;
    const basePosition = {
      x: groupRef.current.position.x + shootDirection.x * 1.5,
      y: groupRef.current.position.y + eyeHeight,
      z: groupRef.current.position.z + shootDirection.z * 1.5,
    };

    const shotSeed = Date.now();

    const seededRandom = (seed: number, index: number) => {
      const x = Math.sin(seed + index * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    if (currentWeapon === "sniper") {
      hitscanRayOrigin.set(basePosition.x, basePosition.y, basePosition.z);
      hitscanRayDir.copy(shootDirection);
      
      const maxDistance = 200;
      const stepSize = 0.5;
      let hitPlayer: Player | null = null;
      
      const playersArray = Array.from(players.values());
      
      for (let dist = 0; dist < maxDistance; dist += stepSize) {
        hitscanTestPoint.copy(hitscanRayOrigin).addScaledVector(hitscanRayDir, dist);
        
        if (checkPointCollision(hitscanTestPoint.x, hitscanTestPoint.y, hitscanTestPoint.z)) {
          break;
        }
        
        for (const targetPlayer of playersArray) {
          if (targetPlayer.id === playerId || !targetPlayer.isAlive) continue;
          
          const playerBaseY = targetPlayer.position.y;
          const playerFeetY = playerBaseY + 0.1;
          const playerHeadY = playerBaseY + 1.8;
          const bodyRadius = 0.7;
          
          const clampedY = Math.max(playerFeetY, Math.min(playerHeadY, hitscanTestPoint.y));
          
          const dx = hitscanTestPoint.x - targetPlayer.position.x;
          const dy = hitscanTestPoint.y - clampedY;
          const dz = hitscanTestPoint.z - targetPlayer.position.z;
          const distanceToCapsule = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distanceToCapsule < bodyRadius) {
            hitPlayer = targetPlayer;
            break;
          }
        }
        
        if (hitPlayer) break;
      }
      
      if (hitPlayer) {
        console.log("HITSCAN HIT!", hitPlayer.username);
        playHit();
        sendMessage("hit", {
          targetPlayerId: hitPlayer.id,
          damage: weaponConfig.damage,
        });
      }
      
      sendMessage("shoot", {
        position: basePosition,
        direction: { x: shootDirection.x, y: shootDirection.y, z: shootDirection.z },
        weaponType: currentWeapon,
        damage: weaponConfig.damage,
        speed: 500,
        size: weaponConfig.bulletSize,
        pelletIndex: 0,
        shotSeed,
        isHitscan: true,
      });
    } else {
      const spreadX = (seededRandom(shotSeed, 0) - 0.5) * weaponConfig.spread;
      const spreadY = (seededRandom(shotSeed, 1) - 0.5) * weaponConfig.spread;
      const spreadZ = (seededRandom(shotSeed, 2) - 0.5) * weaponConfig.spread;

      const dirX = shootDirection.x + spreadX;
      const dirY = shootDirection.y + spreadY;
      const dirZ = shootDirection.z + spreadZ;
      const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
      const finalDir = { x: dirX / len, y: dirY / len, z: dirZ / len };

      hitscanRayOrigin.set(basePosition.x, basePosition.y, basePosition.z);
      hitscanRayDir.set(finalDir.x, finalDir.y, finalDir.z);
      
      const maxDistance = 80;
      const stepSize = 0.5;
      let hitPlayer: Player | null = null;
      
      const playersArray = Array.from(players.values());
      
      for (let dist = 0; dist < maxDistance; dist += stepSize) {
        hitscanTestPoint.copy(hitscanRayOrigin).addScaledVector(hitscanRayDir, dist);
        
        if (checkPointCollision(hitscanTestPoint.x, hitscanTestPoint.y, hitscanTestPoint.z)) {
          break;
        }
        
        for (const targetPlayer of playersArray) {
          if (targetPlayer.id === playerId || !targetPlayer.isAlive) continue;
          
          const playerBaseY = targetPlayer.position.y;
          const playerFeetY = playerBaseY + 0.1;
          const playerHeadY = playerBaseY + 1.8;
          const bodyRadius = 0.7;
          
          const clampedY = Math.max(playerFeetY, Math.min(playerHeadY, hitscanTestPoint.y));
          
          const dx = hitscanTestPoint.x - targetPlayer.position.x;
          const dy = hitscanTestPoint.y - clampedY;
          const dz = hitscanTestPoint.z - targetPlayer.position.z;
          const distanceToCapsule = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distanceToCapsule < bodyRadius) {
            hitPlayer = targetPlayer;
            break;
          }
        }
        
        if (hitPlayer) break;
      }
      
      if (hitPlayer) {
        console.log("PISTOL HITSCAN HIT!", hitPlayer.username);
        playHit();
        sendMessage("hit", {
          targetPlayerId: hitPlayer.id,
          damage: weaponConfig.damage,
        });
      }
      
      sendMessage("shoot", {
        position: basePosition,
        direction: finalDir,
        weaponType: currentWeapon,
        damage: weaponConfig.damage,
        speed: 300,
        size: weaponConfig.bulletSize,
        pelletIndex: 0,
        shotSeed,
        isHitscan: true,
      });
    }
  };

  const handleReload = () => {
    if (isReloading) {
      console.log("Already reloading, skipping");
      return;
    }
    
    console.log("Starting reload for", currentWeapon, "- reload time:", weaponConfig.reloadTime, "ms, max ammo:", weaponConfig.maxAmmo);
    
    if (currentWeapon === "sniper") {
      playSniperReload(equippedSkins.sniper);
    } else {
      playPistolReload(equippedSkins.pistol);
    }
    
    setReloading(true);
    sendMessage("reload_start", {
      reloadTime: weaponConfig.reloadTime,
      maxAmmo: weaponConfig.maxAmmo,
      weapon: currentWeapon,
    });
  };

  if (!player.isAlive) {
    return null;
  }

  return <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]} />;
}
