import * as THREE from "three";
import { memo, useMemo } from "react";

interface WeaponProps {
  weaponType: "sniper" | "pistol";
}

const sniperBarrelGeo = new THREE.BoxGeometry(0.06, 0.06, 1.2);
const sniperBodyGeo = new THREE.BoxGeometry(0.1, 0.12, 0.4);
const sniperStockGeo = new THREE.BoxGeometry(0.08, 0.14, 0.4);
const sniperScopeMountGeo = new THREE.BoxGeometry(0.04, 0.06, 0.2);
const sniperScopeBodyGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.25, 6);
const sniperScopeLensGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6);
const sniperTriggerGuardGeo = new THREE.BoxGeometry(0.04, 0.06, 0.12);
const sniperMagazineGeo = new THREE.BoxGeometry(0.06, 0.1, 0.08);
const sniperMuzzleGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);

const pistolSlideGeo = new THREE.BoxGeometry(0.05, 0.06, 0.22);
const pistolBarrelGeo = new THREE.BoxGeometry(0.03, 0.03, 0.08);
const pistolFrameGeo = new THREE.BoxGeometry(0.05, 0.14, 0.1);
const pistolGripTextureGeo = new THREE.BoxGeometry(0.052, 0.12, 0.08);
const pistolTriggerGuardGeo = new THREE.BoxGeometry(0.04, 0.04, 0.06);
const pistolMagazineBaseGeo = new THREE.BoxGeometry(0.04, 0.02, 0.06);
const pistolFrontSightGeo = new THREE.BoxGeometry(0.015, 0.02, 0.015);
const pistolRearSightGeo = new THREE.BoxGeometry(0.04, 0.02, 0.02);

const metalDark = new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.8, roughness: 0.3 });
const metalBlack = new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.7, roughness: 0.4 });
const metalGray = new THREE.MeshStandardMaterial({ color: "#333333", metalness: 0.6, roughness: 0.4 });
const wood = new THREE.MeshStandardMaterial({ color: "#4a3728", roughness: 0.8 });
const metalShiny = new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.9, roughness: 0.2 });
const scopeLens = new THREE.MeshStandardMaterial({ color: "#4488ff", metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.8 });
const metalMatte = new THREE.MeshStandardMaterial({ color: "#2a2a2a", metalness: 0.6, roughness: 0.5 });
const gripMatte = new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.9 });
const sightRed = new THREE.MeshStandardMaterial({ color: "#ff4444", emissive: "#ff2222", emissiveIntensity: 0.3 });

const ProceduralSniper = memo(function ProceduralSniper() {
  return (
    <group>
      <mesh castShadow position={[0, 0, 0.6]} geometry={sniperBarrelGeo} material={metalDark} />
      <mesh castShadow position={[0, -0.02, 0]} geometry={sniperBodyGeo} material={metalBlack} />
      <mesh castShadow position={[0, -0.04, -0.35]} geometry={sniperStockGeo} material={wood} />
      <mesh castShadow position={[0, 0.08, 0.1]} geometry={sniperScopeMountGeo} material={metalGray} />
      <mesh castShadow position={[0, 0.14, 0.1]} geometry={sniperScopeBodyGeo} material={metalShiny} />
      <mesh position={[0, 0.14, 0.23]} geometry={sniperScopeLensGeo} material={scopeLens} />
      <mesh castShadow position={[0, -0.1, -0.05]} geometry={sniperTriggerGuardGeo} material={metalDark} />
      <mesh castShadow position={[0, -0.14, 0.02]} geometry={sniperMagazineGeo} material={metalGray} />
      <mesh castShadow position={[0, 0, 1.25]} geometry={sniperMuzzleGeo} material={metalShiny} />
    </group>
  );
});

const ProceduralPistol = memo(function ProceduralPistol() {
  return (
    <group>
      <mesh castShadow position={[0, 0.02, 0.08]} geometry={pistolSlideGeo} material={metalBlack} />
      <mesh castShadow position={[0, 0.02, 0.22]} geometry={pistolBarrelGeo} material={metalDark} />
      <mesh castShadow position={[0, -0.08, -0.02]} geometry={pistolFrameGeo} material={metalMatte} />
      <mesh castShadow position={[0, -0.08, -0.025]} geometry={pistolGripTextureGeo} material={gripMatte} />
      <mesh castShadow position={[0, -0.04, 0.04]} geometry={pistolTriggerGuardGeo} material={metalDark} />
      <mesh castShadow position={[0, -0.16, -0.02]} geometry={pistolMagazineBaseGeo} material={metalGray} />
      <mesh position={[0, 0.06, 0.15]} geometry={pistolFrontSightGeo} material={sightRed} />
      <mesh position={[0, 0.06, 0]} geometry={pistolRearSightGeo} material={metalBlack} />
    </group>
  );
});

const ProceduralWeapon = memo(function ProceduralWeapon({ weaponType }: WeaponProps) {
  if (weaponType === "sniper") {
    return <ProceduralSniper />;
  }
  return <ProceduralPistol />;
});

export { ProceduralSniper, ProceduralPistol };
export default ProceduralWeapon;
