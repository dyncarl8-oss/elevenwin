export type WeaponType = "pistol" | "sniper";

export interface WeaponConfig {
  name: string;
  damage: number;
  fireRate: number;
  bulletsPerShot: number;
  spread: number;
  bulletSpeed: number;
  bulletSize: number;
  maxAmmo: number;
  reloadTime: number;
  color: string;
}

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  pistol: {
    name: "Pistol",
    damage: 25,
    fireRate: 350,
    bulletsPerShot: 1,
    spread: 0.03,
    bulletSpeed: 55,
    bulletSize: 0.15,
    maxAmmo: 12,
    reloadTime: 1500,
    color: "#ffff00",
  },
  sniper: {
    name: "Sniper Rifle",
    damage: 80,
    fireRate: 1200,
    bulletsPerShot: 1,
    spread: 0.005,
    bulletSpeed: 100,
    bulletSize: 0.18,
    maxAmmo: 5,
    reloadTime: 2800,
    color: "#00ffff",
  },
};

export const WEAPON_ORDER: WeaponType[] = ["sniper", "pistol"];
