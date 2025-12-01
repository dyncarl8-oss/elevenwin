import { useGameStore } from "@/lib/stores/useGameStore";
import { WEAPONS } from "@/lib/weapons";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

export default function WeaponHUD() {
  const { currentWeapon, ammo, isReloading } = useGameStore();
  const weaponConfig = WEAPONS[currentWeapon];

  const ammoPercentage = (ammo / weaponConfig.maxAmmo) * 100;
  const isLowAmmo = ammoPercentage <= 30;

  return (
    <motion.div 
      className="fixed bottom-2 sm:bottom-3 left-2 sm:left-3 z-50"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div 
        className="rounded-xl overflow-hidden min-w-[140px] sm:min-w-[160px]"
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.9) 100%)",
          border: isLowAmmo && !isReloading 
            ? "1px solid rgba(239, 68, 68, 0.4)" 
            : "1px solid rgba(79, 209, 255, 0.25)",
        }}
      >
        <div className="p-2.5 sm:p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs uppercase">{weaponConfig.name}</span>
            <AnimatePresence mode="wait">
              {isReloading ? (
                <motion.div
                  key="reloading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  >
                    <Zap className="w-3 h-3 text-yellow-400" />
                  </motion.div>
                  <span className="text-yellow-400 font-bold text-xs">RELOAD</span>
                </motion.div>
              ) : (
                <motion.span 
                  key="ammo-count"
                  className={`font-bold text-sm ${isLowAmmo ? "text-red-400" : "text-white"}`}
                >
                  {ammo}
                  <span className="text-gray-500 text-xs">/{weaponConfig.maxAmmo}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="relative h-1.5 rounded-full overflow-hidden bg-gray-800/80">
            <motion.div
              className={`h-full rounded-full ${
                isReloading 
                  ? "bg-gradient-to-r from-yellow-500 to-amber-400" 
                  : isLowAmmo 
                    ? "bg-gradient-to-r from-red-600 to-red-400" 
                    : "bg-gradient-to-r from-cyan-500 to-blue-400"
              }`}
              animate={{ 
                width: isReloading ? ["0%", "100%"] : `${ammoPercentage}%`
              }}
              transition={isReloading ? {
                duration: weaponConfig.reloadTime / 1000,
                ease: "linear"
              } : { duration: 0.15 }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-500">
            <span className="px-1 py-0.5 rounded bg-gray-800 text-cyan-400 font-mono text-[10px]">R</span>
            <span>reload</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
