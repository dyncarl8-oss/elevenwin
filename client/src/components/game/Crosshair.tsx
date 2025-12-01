import { motion } from "framer-motion";

interface CrosshairProps {
  isReloading?: boolean;
  skinId?: string | null;
}

interface SkinTheme {
  primary: string;
  secondary: string;
  glow: string;
  glowRgba: string;
}

const skinThemes: Record<string, SkinTheme> = {
  sniper_basic: {
    primary: "rgba(79, 209, 255, 0.9)",
    secondary: "rgba(255, 255, 255, 0.9)",
    glow: "rgba(79, 209, 255, 0.5)",
    glowRgba: "79, 209, 255",
  },
  sniper_arctic_white: {
    primary: "rgba(200, 230, 255, 0.95)",
    secondary: "rgba(140, 200, 255, 0.9)",
    glow: "rgba(180, 220, 255, 0.6)",
    glowRgba: "180, 220, 255",
  },
  sniper_blood_moon: {
    primary: "rgba(255, 50, 50, 0.95)",
    secondary: "rgba(180, 0, 0, 0.9)",
    glow: "rgba(255, 0, 0, 0.5)",
    glowRgba: "255, 50, 50",
  },
  sniper_cyber_strike: {
    primary: "rgba(0, 255, 65, 0.95)",
    secondary: "rgba(50, 255, 120, 0.9)",
    glow: "rgba(0, 255, 65, 0.6)",
    glowRgba: "0, 255, 65",
  },
  sniper_void_reaper: {
    primary: "rgba(120, 0, 255, 0.95)",
    secondary: "rgba(255, 0, 180, 0.9)",
    glow: "rgba(100, 0, 200, 0.7)",
    glowRgba: "120, 0, 255",
  },
};

function BasicCrosshair({ isReloading, theme }: { isReloading: boolean; theme: SkinTheme }) {
  return (
    <motion.div
      className="relative w-16 h-16 flex items-center justify-center"
      animate={{
        scale: isReloading ? 1.2 : 1,
        rotate: isReloading ? 360 : 0,
      }}
      transition={{
        scale: { duration: 0.2 },
        rotate: { duration: 1, repeat: isReloading ? Infinity : 0, ease: "linear" },
      }}
    >
      <motion.div
        className="absolute w-6 h-0.5 rounded-full left-0"
        style={{
          backgroundColor: theme.secondary,
          boxShadow: `0 0 10px ${theme.glow}, 0 0 20px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 0.8, 0.3] : 0.9, scaleX: isReloading ? 0.5 : 1 }}
        transition={{ duration: 0.5, repeat: isReloading ? Infinity : 0 }}
      />
      <motion.div
        className="absolute w-6 h-0.5 rounded-full right-0"
        style={{
          backgroundColor: theme.secondary,
          boxShadow: `0 0 10px ${theme.glow}, 0 0 20px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 0.8, 0.3] : 0.9, scaleX: isReloading ? 0.5 : 1 }}
        transition={{ duration: 0.5, repeat: isReloading ? Infinity : 0, delay: 0.1 }}
      />
      <motion.div
        className="absolute h-6 w-0.5 rounded-full top-0"
        style={{
          backgroundColor: theme.secondary,
          boxShadow: `0 0 10px ${theme.glow}, 0 0 20px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 0.8, 0.3] : 0.9, scaleY: isReloading ? 0.5 : 1 }}
        transition={{ duration: 0.5, repeat: isReloading ? Infinity : 0, delay: 0.2 }}
      />
      <motion.div
        className="absolute h-6 w-0.5 rounded-full bottom-0"
        style={{
          backgroundColor: theme.secondary,
          boxShadow: `0 0 10px ${theme.glow}, 0 0 20px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 0.8, 0.3] : 0.9, scaleY: isReloading ? 0.5 : 1 }}
        transition={{ duration: 0.5, repeat: isReloading ? Infinity : 0, delay: 0.3 }}
      />
      <motion.div
        className="absolute w-2 h-2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${theme.primary} 0%, ${theme.glow} 50%, transparent 70%)`,
          boxShadow: `0 0 10px ${theme.glow}, 0 0 20px ${theme.glow}`,
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-8 h-8 rounded-full border-2"
        style={{ borderColor: theme.glow }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg className="absolute w-12 h-12" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.4 }}>
        <motion.circle
          cx="24" cy="24" r="20"
          stroke={theme.glow}
          strokeWidth="1"
          strokeDasharray="4 4"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        />
      </svg>
    </motion.div>
  );
}

function ArcticWhiteCrosshair({ isReloading, theme }: { isReloading: boolean; theme: SkinTheme }) {
  return (
    <motion.div
      className="relative w-20 h-20 flex items-center justify-center"
      animate={{ scale: isReloading ? 1.15 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute w-8 h-[2px]"
        style={{
          left: 0,
          background: `linear-gradient(90deg, transparent, ${theme.primary})`,
          boxShadow: `0 0 15px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.4, 1, 0.4] : 0.95 }}
        transition={{ duration: 0.4, repeat: isReloading ? Infinity : 0 }}
      />
      <motion.div
        className="absolute w-8 h-[2px]"
        style={{
          right: 0,
          background: `linear-gradient(270deg, transparent, ${theme.primary})`,
          boxShadow: `0 0 15px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.4, 1, 0.4] : 0.95 }}
        transition={{ duration: 0.4, repeat: isReloading ? Infinity : 0, delay: 0.1 }}
      />
      <motion.div
        className="absolute h-8 w-[2px]"
        style={{
          top: 0,
          background: `linear-gradient(180deg, transparent, ${theme.primary})`,
          boxShadow: `0 0 15px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.4, 1, 0.4] : 0.95 }}
        transition={{ duration: 0.4, repeat: isReloading ? Infinity : 0, delay: 0.2 }}
      />
      <motion.div
        className="absolute h-8 w-[2px]"
        style={{
          bottom: 0,
          background: `linear-gradient(0deg, transparent, ${theme.primary})`,
          boxShadow: `0 0 15px ${theme.glow}`,
        }}
        animate={{ opacity: isReloading ? [0.4, 1, 0.4] : 0.95 }}
        transition={{ duration: 0.4, repeat: isReloading ? Infinity : 0, delay: 0.3 }}
      />
      <motion.div
        className="absolute w-3 h-3"
        style={{
          background: theme.primary,
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          boxShadow: `0 0 20px ${theme.glow}, 0 0 40px ${theme.glow}`,
        }}
        animate={{ scale: [1, 1.2, 1], rotate: isReloading ? [0, 180, 360] : 0 }}
        transition={{
          scale: { duration: 1.5, repeat: Infinity },
          rotate: { duration: 1, repeat: isReloading ? Infinity : 0, ease: "linear" },
        }}
      />
      <motion.div
        className="absolute w-6 h-6"
        style={{
          border: `1px solid ${theme.secondary}`,
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <svg className="absolute w-16 h-16" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.3 }}>
        <motion.path
          d="M32 4 L60 32 L32 60 L4 32 Z"
          stroke={theme.glow}
          strokeWidth="1"
          fill="none"
          strokeDasharray="8 4"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        />
      </svg>
    </motion.div>
  );
}

function BloodMoonCrosshair({ isReloading, theme }: { isReloading: boolean; theme: SkinTheme }) {
  return (
    <motion.div
      className="relative w-20 h-20 flex items-center justify-center"
      animate={{ scale: isReloading ? 1.2 : 1, rotate: isReloading ? 360 : 0 }}
      transition={{
        scale: { duration: 0.2 },
        rotate: { duration: 2, repeat: isReloading ? Infinity : 0, ease: "linear" },
      }}
    >
      <motion.div
        className="absolute w-7 h-[3px] rounded-full"
        style={{
          left: 2,
          backgroundColor: theme.primary,
          boxShadow: `0 0 15px ${theme.glow}, 0 0 30px ${theme.secondary}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 1, 0.3] : 0.9 }}
        transition={{ duration: 0.3, repeat: isReloading ? Infinity : 0 }}
      />
      <motion.div
        className="absolute w-7 h-[3px] rounded-full"
        style={{
          right: 2,
          backgroundColor: theme.primary,
          boxShadow: `0 0 15px ${theme.glow}, 0 0 30px ${theme.secondary}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 1, 0.3] : 0.9 }}
        transition={{ duration: 0.3, repeat: isReloading ? Infinity : 0, delay: 0.1 }}
      />
      <motion.div
        className="absolute h-7 w-[3px] rounded-full"
        style={{
          top: 2,
          backgroundColor: theme.primary,
          boxShadow: `0 0 15px ${theme.glow}, 0 0 30px ${theme.secondary}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 1, 0.3] : 0.9 }}
        transition={{ duration: 0.3, repeat: isReloading ? Infinity : 0, delay: 0.2 }}
      />
      <motion.div
        className="absolute h-7 w-[3px] rounded-full"
        style={{
          bottom: 2,
          backgroundColor: theme.primary,
          boxShadow: `0 0 15px ${theme.glow}, 0 0 30px ${theme.secondary}`,
        }}
        animate={{ opacity: isReloading ? [0.3, 1, 0.3] : 0.9 }}
        transition={{ duration: 0.3, repeat: isReloading ? Infinity : 0, delay: 0.3 }}
      />
      <motion.div
        className="absolute w-4 h-4 rounded-full"
        style={{
          background: `radial-gradient(circle, ${theme.primary} 0%, ${theme.secondary} 60%, transparent 100%)`,
          boxShadow: `0 0 20px ${theme.glow}, 0 0 40px ${theme.secondary}`,
        }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <svg className="absolute w-14 h-14" viewBox="0 0 56 56" fill="none">
        <motion.circle
          cx="28" cy="28" r="24"
          stroke={theme.secondary}
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 6"
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        />
        <motion.circle
          cx="28" cy="28" r="18"
          stroke={theme.primary}
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="12 4"
          animate={{ rotate: [0, 360], opacity: [0.4, 0.8, 0.4] }}
          transition={{
            rotate: { duration: 6, repeat: Infinity, ease: "linear" },
            opacity: { duration: 2, repeat: Infinity },
          }}
          style={{ transformOrigin: "center" }}
        />
      </svg>
    </motion.div>
  );
}

function CyberStrikeCrosshair({ isReloading, theme }: { isReloading: boolean; theme: SkinTheme }) {
  return (
    <motion.div
      className="relative w-12 h-12 flex items-center justify-center"
      animate={{ scale: isReloading ? 1.1 : 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute w-4 h-[1px]"
        style={{
          left: 0,
          background: `linear-gradient(90deg, transparent 0%, ${theme.primary} 50%, ${theme.primary} 100%)`,
          boxShadow: `0 0 6px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.3, 1, 0.3] : 1,
        }}
        transition={{ duration: 0.3, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-4 h-[1px]"
        style={{
          right: 0,
          background: `linear-gradient(270deg, transparent 0%, ${theme.primary} 50%, ${theme.primary} 100%)`,
          boxShadow: `0 0 6px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.3, 1, 0.3] : 1,
        }}
        transition={{ duration: 0.3, repeat: Infinity, delay: 0.05 }}
      />
      <motion.div
        className="absolute h-4 w-[1px]"
        style={{
          top: 0,
          background: `linear-gradient(180deg, transparent 0%, ${theme.primary} 50%, ${theme.primary} 100%)`,
          boxShadow: `0 0 6px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.3, 1, 0.3] : 1,
        }}
        transition={{ duration: 0.3, repeat: Infinity, delay: 0.1 }}
      />
      <motion.div
        className="absolute h-4 w-[1px]"
        style={{
          bottom: 0,
          background: `linear-gradient(0deg, transparent 0%, ${theme.primary} 50%, ${theme.primary} 100%)`,
          boxShadow: `0 0 6px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.3, 1, 0.3] : 1,
        }}
        transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
      />

      <motion.div
        className="absolute w-1.5 h-1.5"
        style={{
          background: theme.primary,
          boxShadow: `0 0 8px ${theme.glow}, 0 0 16px ${theme.primary}`,
        }}
        animate={{ 
          scale: [1, 1.3, 1],
          rotate: [0, 90, 180, 270, 360],
        }}
        transition={{ 
          scale: { duration: 0.5, repeat: Infinity },
          rotate: { duration: 2, repeat: Infinity, ease: "linear" },
        }}
      />

      <motion.div
        className="absolute w-4 h-4"
        style={{
          border: `1px solid ${theme.primary}`,
          boxShadow: `0 0 6px ${theme.glow}`,
        }}
        animate={{ 
          rotate: isReloading ? [0, 360] : [0, 45, 90],
          scale: [1, 0.95, 1],
        }}
        transition={{ 
          rotate: { duration: isReloading ? 0.3 : 3, repeat: Infinity, ease: "linear" },
          scale: { duration: 1, repeat: Infinity },
        }}
      />

      {isReloading && (
        <motion.div
          className="absolute w-10 h-10"
          style={{
            border: `2px solid ${theme.primary}`,
            borderRadius: '50%',
            borderTopColor: 'transparent',
            borderRightColor: 'transparent',
            boxShadow: `0 0 10px ${theme.glow}`,
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

function VoidReaperCrosshair({ isReloading, theme }: { isReloading: boolean; theme: SkinTheme }) {
  return (
    <motion.div
      className="relative w-12 h-12 flex items-center justify-center"
      animate={{ scale: isReloading ? 1.15 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute w-4 h-[1px]"
        style={{
          left: 0,
          background: `linear-gradient(90deg, transparent, ${theme.secondary}, ${theme.primary})`,
          boxShadow: `0 0 8px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.2, 1, 0.2] : [0.6, 1, 0.6],
        }}
        transition={{ duration: 0.6, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-4 h-[1px]"
        style={{
          right: 0,
          background: `linear-gradient(270deg, transparent, ${theme.secondary}, ${theme.primary})`,
          boxShadow: `0 0 8px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.2, 1, 0.2] : [0.6, 1, 0.6],
        }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      <motion.div
        className="absolute h-4 w-[1px]"
        style={{
          top: 0,
          background: `linear-gradient(180deg, transparent, ${theme.secondary}, ${theme.primary})`,
          boxShadow: `0 0 8px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.2, 1, 0.2] : [0.6, 1, 0.6],
        }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
      <motion.div
        className="absolute h-4 w-[1px]"
        style={{
          bottom: 0,
          background: `linear-gradient(0deg, transparent, ${theme.secondary}, ${theme.primary})`,
          boxShadow: `0 0 8px ${theme.glow}`,
        }}
        animate={{ 
          opacity: isReloading ? [0.2, 1, 0.2] : [0.6, 1, 0.6],
        }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.45 }}
      />

      <motion.div
        className="absolute w-3 h-3 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(0,0,0,0.8) 0%, ${theme.primary} 60%, transparent 100%)`,
          boxShadow: `0 0 10px ${theme.glow}, 0 0 20px ${theme.secondary}`,
        }}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 360],
        }}
        transition={{ 
          scale: { duration: 1, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 6, repeat: Infinity, ease: "linear" },
        }}
      />

      <motion.div
        className="absolute w-1.5 h-1.5 rounded-full"
        style={{
          background: '#fff',
          boxShadow: `0 0 6px #fff, 0 0 12px ${theme.secondary}`,
        }}
        animate={{ scale: [1, 0.6, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {isReloading && (
        <>
          <motion.div
            className="absolute w-10 h-10 rounded-full"
            style={{
              border: `2px solid ${theme.secondary}`,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              boxShadow: `0 0 12px ${theme.glow}`,
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute w-8 h-8 rounded-full"
            style={{
              border: `1px solid ${theme.primary}`,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              boxShadow: `0 0 8px ${theme.secondary}`,
            }}
            animate={{ rotate: [0, -360] }}
            transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}
    </motion.div>
  );
}

export default function Crosshair({ isReloading = false, skinId = null }: CrosshairProps) {
  const theme = skinThemes[skinId || "sniper_basic"] || skinThemes.sniper_basic;

  const renderCrosshair = () => {
    switch (skinId) {
      case "sniper_arctic_white":
        return <ArcticWhiteCrosshair isReloading={isReloading} theme={theme} />;
      case "sniper_blood_moon":
        return <BloodMoonCrosshair isReloading={isReloading} theme={theme} />;
      case "sniper_cyber_strike":
        return <CyberStrikeCrosshair isReloading={isReloading} theme={theme} />;
      case "sniper_void_reaper":
        return <VoidReaperCrosshair isReloading={isReloading} theme={theme} />;
      default:
        return <BasicCrosshair isReloading={isReloading} theme={theme} />;
    }
  };

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
      {renderCrosshair()}
    </div>
  );
}
