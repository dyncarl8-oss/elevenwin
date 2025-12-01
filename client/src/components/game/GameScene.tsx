import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState, useCallback, useRef, memo } from "react";
import { useTexture, Preload } from "@react-three/drei";
import { useGameStore } from "@/lib/stores/useGameStore";
import Arena from "./Arena";
import LocalPlayer from "./LocalPlayer";
import RemotePlayer from "./RemotePlayer";
import Bullets from "./Bullets";
import GameHUD from "./GameHUD";
import RoundOverlay from "./RoundOverlay";
import WeaponHUD from "./WeaponHUD";
import Crosshair from "./Crosshair";
import WeaponViewModel from "./WeaponViewModel";
import ErrorBoundary from "./ErrorBoundary";

useTexture.preload("/textures/grass.png");

const CrosshairWithStore = memo(function CrosshairWithStore() {
  const isReloading = useGameStore((s) => s.isReloading);
  const equippedSkins = useGameStore((s) => s.equippedSkins);
  return <Crosshair isReloading={isReloading} skinId={equippedSkins.sniper} />;
});

interface GameSceneProps {
  sendMessage: (type: string, payload: any) => void;
}

function LoadingFallback() {
  return (
    <group>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
}

function ScopeOverlay({ skinId }: { skinId: string | null }) {
  const getScopeStyles = () => {
    switch (skinId) {
      case "sniper_arctic_white":
        return {
          crosshairColor: "rgba(200, 230, 255, 0.9)",
          glowColor: "rgba(180, 220, 255, 0.6)",
          vignette: "radial-gradient(circle, transparent 25%, rgba(100, 150, 200, 0.3) 60%, rgba(20, 40, 60, 0.8) 100%)",
        };
      case "sniper_blood_moon":
        return {
          crosshairColor: "rgba(255, 50, 50, 0.9)",
          glowColor: "rgba(255, 0, 0, 0.5)",
          vignette: "radial-gradient(circle, transparent 25%, rgba(100, 0, 0, 0.4) 60%, rgba(30, 0, 0, 0.85) 100%)",
        };
      case "sniper_cyber_strike":
        return {
          crosshairColor: "rgba(0, 255, 65, 0.95)",
          glowColor: "rgba(0, 255, 65, 0.6)",
          vignette: "radial-gradient(circle, transparent 20%, rgba(0, 40, 20, 0.4) 50%, rgba(0, 15, 5, 0.9) 100%)",
        };
      case "sniper_void_reaper":
        return {
          crosshairColor: "rgba(120, 0, 255, 0.95)",
          glowColor: "rgba(255, 0, 180, 0.6)",
          vignette: "radial-gradient(circle, transparent 15%, rgba(40, 0, 60, 0.5) 45%, rgba(10, 0, 15, 0.95) 100%)",
        };
      default:
        return {
          crosshairColor: "rgba(0, 255, 255, 0.8)",
          glowColor: "rgba(0, 255, 255, 0.5)",
          vignette: "radial-gradient(circle, transparent 30%, rgba(0, 0, 0, 0.6) 100%)",
        };
    }
  };

  const styles = getScopeStyles();

  const renderScopePattern = () => {
    switch (skinId) {
      case "sniper_arctic_white":
        return (
          <>
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "1px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 15px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "1px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 15px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(45deg)",
              width: "20px",
              height: "20px",
              border: `1px solid ${styles.crosshairColor}`,
              boxShadow: `0 0 10px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "60px",
              height: "60px",
              border: `1px solid ${styles.crosshairColor}`,
              opacity: 0.5,
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            }} />
            {[0, 90, 180, 270].map((angle) => (
              <div key={angle} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                width: "100px",
                height: "1px",
                background: `linear-gradient(90deg, transparent, ${styles.crosshairColor}, transparent)`,
                opacity: 0.3,
              }} />
            ))}
          </>
        );
      case "sniper_blood_moon":
        return (
          <>
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 20px ${styles.glowColor}, 0 0 40px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 20px ${styles.glowColor}, 0 0 40px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "30px",
              height: "30px",
              border: `2px solid ${styles.crosshairColor}`,
              borderRadius: "50%",
              boxShadow: `0 0 20px ${styles.glowColor}, inset 0 0 15px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "80px",
              height: "80px",
              border: `1px solid ${styles.crosshairColor}`,
              borderRadius: "50%",
              opacity: 0.4,
            }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "120px",
              height: "120px",
              border: `1px dashed ${styles.crosshairColor}`,
              borderRadius: "50%",
              opacity: 0.2,
            }} />
          </>
        );
      case "sniper_cyber_strike":
        return (
          <>
            {/* Main crosshairs with glow */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "2px",
              background: `linear-gradient(90deg, transparent 5%, ${styles.crosshairColor} 35%, ${styles.crosshairColor} 65%, transparent 95%)`,
              boxShadow: `0 0 15px ${styles.glowColor}, 0 0 30px ${styles.glowColor}`,
              animation: "scope-flicker 2s ease-in-out infinite",
            }} />
            <div style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              background: `linear-gradient(180deg, transparent 5%, ${styles.crosshairColor} 35%, ${styles.crosshairColor} 65%, transparent 95%)`,
              boxShadow: `0 0 15px ${styles.glowColor}, 0 0 30px ${styles.glowColor}`,
              animation: "scope-flicker 2s ease-in-out infinite 0.5s",
            }} />

            {/* Outer rotating hexagon frame */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "280px",
              height: "280px",
              border: `2px solid ${styles.crosshairColor}`,
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              boxShadow: `0 0 30px ${styles.glowColor}, inset 0 0 60px ${styles.glowColor}`,
              animation: "scope-rotate 20s linear infinite",
            }} />

            {/* Inner rotating diamond */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "160px",
              height: "160px",
              border: `1px solid ${styles.crosshairColor}`,
              animation: "scope-rotate-diamond-reverse 12s linear infinite",
              opacity: 0.8,
            }} />

            {/* Pulsing target circles */}
            {[80, 120, 180].map((size, i) => (
              <div key={size} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "50%",
                border: `1px solid ${styles.crosshairColor}`,
                opacity: 0.4 + i * 0.1,
                animation: `scope-breathe ${2 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`,
              }} />
            ))}

            {/* Scanning ring with dashes */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              border: `3px dashed ${styles.crosshairColor}`,
              animation: "scope-scan 4s linear infinite",
              opacity: 0.7,
            }} />

            {/* Diagonal targeting lines */}
            {[45, 135, 225, 315].map((angle, i) => (
              <div key={angle} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                width: "180px",
                height: "1px",
                background: `linear-gradient(90deg, transparent 20%, ${styles.crosshairColor} 40%, ${styles.crosshairColor} 60%, transparent 80%)`,
                opacity: 0.6,
                animation: `scope-flicker 1.5s ease-in-out infinite ${i * 0.2}s`,
              }} />
            ))}

            {/* Corner brackets */}
            {[0, 90, 180, 270].map((angle) => (
              <div key={`bracket-${angle}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-100px)`,
                width: "30px",
                height: "30px",
                borderTop: `2px solid ${styles.crosshairColor}`,
                borderRight: `2px solid ${styles.crosshairColor}`,
                boxShadow: `0 0 10px ${styles.glowColor}`,
              }} />
            ))}

            {/* Animated data points on perimeter */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
              <div key={`data-${angle}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-130px)`,
                width: "4px",
                height: "4px",
                backgroundColor: styles.crosshairColor,
                boxShadow: `0 0 8px ${styles.glowColor}`,
                animation: `scope-flicker 0.8s ease-in-out infinite ${i * 0.08}s`,
              }} />
            ))}

            {/* Center targeting diamond */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "20px",
              height: "20px",
              border: `2px solid ${styles.crosshairColor}`,
              boxShadow: `0 0 20px ${styles.glowColor}, 0 0 40px ${styles.glowColor}`,
              animation: "scope-rotate 3s linear infinite",
            }} />

            {/* Inner pulsing square */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(45deg)",
              width: "10px",
              height: "10px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 15px ${styles.glowColor}, 0 0 30px ${styles.glowColor}`,
              animation: "scope-pulse 1s ease-in-out infinite",
            }} />

            {/* Glowing center dot */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: "#fff",
              boxShadow: `0 0 10px ${styles.crosshairColor}, 0 0 20px ${styles.glowColor}, 0 0 40px ${styles.glowColor}`,
            }} />

            {/* HUD-style corner info boxes */}
            <div style={{
              position: "absolute",
              top: "calc(50% - 150px)",
              left: "calc(50% - 200px)",
              padding: "4px 8px",
              border: `1px solid ${styles.crosshairColor}`,
              backgroundColor: "rgba(0, 20, 10, 0.6)",
              fontSize: "10px",
              fontFamily: "monospace",
              color: styles.crosshairColor,
              textShadow: `0 0 10px ${styles.glowColor}`,
              animation: "scope-flicker 3s ease-in-out infinite",
            }}>
              LOCK: ACTIVE
            </div>
            <div style={{
              position: "absolute",
              top: "calc(50% - 150px)",
              right: "calc(50% - 200px)",
              padding: "4px 8px",
              border: `1px solid ${styles.crosshairColor}`,
              backgroundColor: "rgba(0, 20, 10, 0.6)",
              fontSize: "10px",
              fontFamily: "monospace",
              color: styles.crosshairColor,
              textShadow: `0 0 10px ${styles.glowColor}`,
              animation: "scope-flicker 3s ease-in-out infinite 0.5s",
            }}>
              ZOOM: 4.0x
            </div>
            <div style={{
              position: "absolute",
              bottom: "calc(50% - 150px)",
              left: "calc(50% - 200px)",
              padding: "4px 8px",
              border: `1px solid ${styles.crosshairColor}`,
              backgroundColor: "rgba(0, 20, 10, 0.6)",
              fontSize: "10px",
              fontFamily: "monospace",
              color: styles.crosshairColor,
              textShadow: `0 0 10px ${styles.glowColor}`,
              animation: "scope-flicker 3s ease-in-out infinite 1s",
            }}>
              RANGE: 250m
            </div>
          </>
        );
      case "sniper_void_reaper":
        return (
          <>
            {/* Main crosshairs with ethereal glow */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "2px",
              background: `linear-gradient(90deg, transparent 5%, ${styles.crosshairColor} 30%, ${styles.glowColor} 50%, ${styles.crosshairColor} 70%, transparent 95%)`,
              boxShadow: `0 0 20px ${styles.glowColor}, 0 0 40px ${styles.crosshairColor}`,
              animation: "scope-flicker 3s ease-in-out infinite",
            }} />
            <div style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              background: `linear-gradient(180deg, transparent 5%, ${styles.crosshairColor} 30%, ${styles.glowColor} 50%, ${styles.crosshairColor} 70%, transparent 95%)`,
              boxShadow: `0 0 20px ${styles.glowColor}, 0 0 40px ${styles.crosshairColor}`,
              animation: "scope-flicker 3s ease-in-out infinite 0.75s",
            }} />

            {/* Outer void portal ring */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "300px",
              height: "300px",
              borderRadius: "50%",
              border: `3px solid ${styles.crosshairColor}`,
              boxShadow: `0 0 40px ${styles.glowColor}, 0 0 80px ${styles.crosshairColor}, inset 0 0 60px ${styles.glowColor}`,
              animation: "scope-void-swirl 15s linear infinite",
            }} />

            {/* Secondary swirling ring */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "240px",
              height: "240px",
              borderRadius: "50%",
              border: `2px dashed ${styles.glowColor}`,
              boxShadow: `0 0 30px ${styles.glowColor}`,
              animation: "scope-rotate 8s linear infinite",
              opacity: 0.7,
            }} />

            {/* Inner energy rings */}
            {[180, 140, 100].map((size, i) => (
              <div key={size} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "50%",
                border: `1px solid ${i % 2 === 0 ? styles.crosshairColor : styles.glowColor}`,
                boxShadow: `0 0 15px ${styles.glowColor}`,
                animation: `${i % 2 === 0 ? 'scope-rotate-reverse' : 'scope-rotate'} ${6 + i * 2}s linear infinite`,
                opacity: 0.5 + i * 0.15,
              }} />
            ))}

            {/* Central void portal */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(0,0,0,0.95) 0%, ${styles.crosshairColor} 60%, ${styles.glowColor} 100%)`,
              boxShadow: `0 0 30px ${styles.glowColor}, 0 0 60px ${styles.crosshairColor}, 0 0 100px ${styles.glowColor}`,
              animation: "scope-energy-wave 2s ease-in-out infinite",
            }} />

            {/* Pulsing inner core */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${styles.glowColor} 0%, ${styles.crosshairColor} 100%)`,
              boxShadow: `0 0 20px ${styles.glowColor}, 0 0 40px ${styles.crosshairColor}`,
              animation: "scope-pulse 1s ease-in-out infinite",
            }} />

            {/* Energy spikes emanating from center */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <div key={`spike-${angle}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                width: "2px",
                height: "120px",
                background: `linear-gradient(180deg, transparent 0%, ${styles.crosshairColor} 30%, ${styles.glowColor} 50%, ${styles.crosshairColor} 70%, transparent 100%)`,
                boxShadow: `0 0 10px ${styles.glowColor}`,
                animation: `scope-spike-pulse 1.5s ease-in-out infinite ${i * 0.1}s`,
                transformOrigin: "center",
              }} />
            ))}

            {/* Orbiting soul orbs - outer ring */}
            {[0, 72, 144, 216, 288].map((angle, i) => (
              <div key={`orb-outer-${angle}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-130px)`,
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: `radial-gradient(circle, #fff 0%, ${styles.glowColor} 50%, ${styles.crosshairColor} 100%)`,
                boxShadow: `0 0 15px ${styles.glowColor}, 0 0 30px ${styles.crosshairColor}`,
                animation: `scope-orb-float 2s ease-in-out infinite ${i * 0.3}s`,
              }} />
            ))}

            {/* Orbiting soul orbs - inner ring */}
            {[36, 108, 180, 252, 324].map((angle, i) => (
              <div key={`orb-inner-${angle}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-80px)`,
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${styles.glowColor} 0%, ${styles.crosshairColor} 100%)`,
                boxShadow: `0 0 12px ${styles.glowColor}`,
                animation: `scope-orb-float 1.8s ease-in-out infinite ${i * 0.25}s`,
              }} />
            ))}

            {/* Ethereal wisps */}
            {[0, 120, 240].map((angle, i) => (
              <div key={`wisp-${angle}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                width: "200px",
                height: "3px",
                background: `linear-gradient(90deg, transparent 10%, ${styles.glowColor} 30%, transparent 50%, ${styles.crosshairColor} 70%, transparent 90%)`,
                boxShadow: `0 0 15px ${styles.glowColor}`,
                opacity: 0.5,
                animation: `scope-flicker 2s ease-in-out infinite ${i * 0.4}s`,
              }} />
            ))}

            {/* Central bright dot */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#fff",
              boxShadow: `0 0 15px #fff, 0 0 30px ${styles.glowColor}, 0 0 50px ${styles.crosshairColor}`,
              animation: "scope-flicker 0.5s ease-in-out infinite",
            }} />

            {/* Menacing corner runes */}
            {[
              { x: -180, y: -120, symbol: "◊" },
              { x: 180, y: -120, symbol: "◊" },
              { x: -180, y: 120, symbol: "◊" },
              { x: 180, y: 120, symbol: "◊" },
            ].map((pos, i) => (
              <div key={`rune-${i}`} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                fontSize: "20px",
                color: styles.crosshairColor,
                textShadow: `0 0 15px ${styles.glowColor}, 0 0 30px ${styles.crosshairColor}`,
                animation: `scope-flicker 2.5s ease-in-out infinite ${i * 0.3}s`,
              }}>
                {pos.symbol}
              </div>
            ))}

            {/* Death counter HUD */}
            <div style={{
              position: "absolute",
              top: "calc(50% - 160px)",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "4px 12px",
              border: `1px solid ${styles.crosshairColor}`,
              backgroundColor: "rgba(20, 0, 30, 0.7)",
              fontSize: "11px",
              fontFamily: "monospace",
              color: styles.glowColor,
              textShadow: `0 0 10px ${styles.crosshairColor}`,
              letterSpacing: "2px",
              animation: "scope-flicker 4s ease-in-out infinite",
            }}>
              ☠ VOID LOCK ☠
            </div>
          </>
        );
      default:
        return (
          <>
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 10px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              backgroundColor: styles.crosshairColor,
              boxShadow: `0 0 10px ${styles.glowColor}`,
            }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "10px",
              height: "10px",
              border: `2px solid ${styles.crosshairColor}`,
              borderRadius: "50%",
              boxShadow: `0 0 10px ${styles.glowColor}`,
            }} />
          </>
        );
    }
  };

  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 500,
    }}>
      {renderScopePattern()}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: styles.vignette,
      }} />
    </div>
  );
}

export default function GameScene({ sendMessage }: GameSceneProps) {
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const phase = useGameStore((s) => s.phase);
  const isScoping = useGameStore((s) => s.isScoping);
  const countdown = useGameStore((s) => s.countdown);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const equippedSkins = useGameStore((s) => s.equippedSkins);
  const assetsPreloaded = useGameStore((s) => s.assetsPreloaded);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(true);
  const [displayCountdown, setDisplayCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const preloadHandled = useRef(false);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      setDisplayCountdown(countdown);
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      countdownIntervalRef.current = setInterval(() => {
        setDisplayCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setCountdown(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [countdown, setCountdown]);

  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement !== null);
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, []);

  useEffect(() => {
    if (assetsPreloaded && !preloadHandled.current) {
      preloadHandled.current = true;
      setAssetsLoaded(true);
      console.log("Assets preloaded via VS screen, sending player_ready message");
      sendMessage("player_ready", {});
      
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.requestPointerLock();
        }
      }, 100);
    }
  }, [assetsPreloaded, sendMessage]);

  const localPlayer = playerId ? players.get(playerId) : null;
  const remotePlayers = Array.from(players.values()).filter((p) => p.id !== playerId);

  return (
    <ErrorBoundary>
      <Canvas
        shadows
        camera={{
          position: [0, 5, 10],
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
      >
        <color attach="background" args={["#87CEEB"]} />
        <fog attach="fog" args={["#87CEEB", 80, 200]} />

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[50, 50, 30]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={80}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-bias={-0.0001}
        />
        <hemisphereLight args={["#87CEEB", "#6b8e23", 0.3]} />

        <Suspense fallback={<LoadingFallback />}>
          <Arena />
          {localPlayer && <LocalPlayer player={localPlayer} sendMessage={sendMessage} />}
          {remotePlayers.map((player) => (
            <RemotePlayer key={player.id} player={player} />
          ))}
          <Bullets sendMessage={sendMessage} />
          {phase === "playing" && localPlayer?.isAlive && <WeaponViewModel />}
          <Preload all />
        </Suspense>
      </Canvas>

      <GameHUD />
      <RoundOverlay />
      {phase === "playing" && <WeaponHUD />}
      {phase === "playing" && !isScoping && <CrosshairWithStore />}

      {phase === "playing" && isScoping && (
        <ScopeOverlay skinId={equippedSkins.sniper} />
      )}


      {phase === "waiting" && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="bg-gray-900/90 text-white px-8 py-4 rounded-lg border-2 border-blue-500">
            <div className="text-2xl font-bold mb-2">Waiting for opponent...</div>
            <div className="text-gray-400">Game will start when both players join</div>
          </div>
        </div>
      )}

      {displayCountdown !== null && displayCountdown > 0 && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 2000,
        }}>
          <div style={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            padding: "40px 80px",
            borderRadius: "20px",
            border: "3px solid #3b82f6",
            textAlign: "center",
            boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
          }}>
            <div style={{
              color: "#fbbf24",
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "10px",
            }}>
              GET READY!
            </div>
            <div style={{
              color: "white",
              fontSize: "96px",
              fontWeight: "bold",
              textShadow: "0 0 20px rgba(255, 255, 255, 0.5)",
            }}>
              {displayCountdown}
            </div>
            <div style={{
              color: "#9ca3af",
              fontSize: "16px",
              marginTop: "10px",
            }}>
              Move around and get in position!
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
