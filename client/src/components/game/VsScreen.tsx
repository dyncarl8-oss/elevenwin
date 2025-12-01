import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Zap, Swords, Check, Clock, LogOut } from "lucide-react";
import { Howl } from "howler";
import { startBackgroundMusic } from "@/lib/sounds";
import type { UserProfile } from "@/pages/experience-page";
import { useGameStore } from "@/lib/stores/useGameStore";

interface VsScreenProps {
  userProfile: UserProfile | null;
  opponentProfile: { username: string; profilePicture?: string | null; isBot?: boolean } | null;
  gameMode: "singleplayer" | "multiplayer";
  onComplete: () => void;
  onLeave?: () => void;
  sendMessage?: (type: string, payload: any) => void;
}

const vsSound = new Howl({
  src: ["/sounds/success.mp3"],
  volume: 0.8,
});

const whooshSound = new Howl({
  src: ["/sounds/hit.mp3"],
  volume: 0.5,
});

const generateParticles = () => 
  Array.from({ length: 20 }).map(() => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 2,
  }));

export default function VsScreen({ userProfile, opponentProfile, gameMode, onComplete, onLeave, sendMessage }: VsScreenProps) {
  const [phase, setPhase] = useState<"intro" | "player1" | "vs" | "player2" | "loading" | "waiting" | "ready" | "countdown" | "done">("intro");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Preparing arena...");
  const [isReady, setIsReady] = useState(false);
  const countdown = useGameStore((s) => s.countdown);
  const readyPlayers = useGameStore((s) => s.readyPlayers);
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);

  const playerCount = players.size;

  const opponentReady = useMemo(() => {
    if (gameMode !== "multiplayer") return false;
    return readyPlayers.some(id => id !== playerId);
  }, [readyPlayers, playerId, gameMode]);

  useEffect(() => {
    setIsReady(false);
    setPhase("intro");
  }, []);

  useEffect(() => {
    if (gameMode === "multiplayer" && phase === "waiting" && playerCount >= 2) {
      setPhase("ready");
    }
  }, [gameMode, phase, playerCount]);

  const particles = useMemo(() => generateParticles(), []);

  const username = useMemo(() => 
    userProfile?.name || userProfile?.username || "Player", 
    [userProfile]
  );

  const opponentName = useMemo(() => 
    opponentProfile?.username || (gameMode === "singleplayer" ? "AI Bot" : "Opponent"),
    [opponentProfile, gameMode]
  );

  const handleStartClick = useCallback(() => {
    setPhase("done");
    startBackgroundMusic();
    onComplete();
  }, [onComplete]);

  const handleReadyClick = useCallback(() => {
    if (!isReady && sendMessage) {
      setIsReady(true);
      sendMessage("player_ready", {});
    }
  }, [isReady, sendMessage]);

  const handleLeaveClick = useCallback(() => {
    if (sendMessage) {
      sendMessage("leave_room", {});
    }
    if (onLeave) {
      onLeave();
    }
  }, [sendMessage, onLeave]);

  // Track if we've seen a countdown start (to prevent stale state from triggering onComplete)
  const [countdownStarted, setCountdownStarted] = useState(false);

  useEffect(() => {
    if (countdown === null) {
      // Reset countdown state if countdown is cleared (e.g., player unreadies)
      setCountdownStarted(false);
    } else if (countdown > 0) {
      setCountdownStarted(true);
      setPhase("countdown");
    } else if (countdown === 0 && countdownStarted) {
      // Only trigger "GO!" if we actually went through the countdown (not stale state)
      setPhase("countdown");
      setTimeout(() => {
        setPhase("done");
        startBackgroundMusic();
        onComplete();
      }, 800);
    }
  }, [countdown, countdownStarted, onComplete]);

  useEffect(() => {
    const assets = [
      { path: "/textures/grass.png", name: "Terrain" },
      { path: "/textures/wood.jpg", name: "Environment" },
    ];

    const loadAsset = (asset: { path: string; name: string }) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = asset.path;
      });
    };

    const timeline = async () => {
      await new Promise(r => setTimeout(r, 200));
      setPhase("player1");
      whooshSound.play();

      await new Promise(r => setTimeout(r, 500));
      setPhase("vs");
      vsSound.play();

      await new Promise(r => setTimeout(r, 600));
      setPhase("player2");
      whooshSound.play();

      await new Promise(r => setTimeout(r, 400));
      
      // For multiplayer, skip loading animation and go straight to waiting
      if (gameMode === "multiplayer") {
        const currentPlayerCount = useGameStore.getState().players.size;
        if (currentPlayerCount >= 2) {
          setPhase("ready");
        } else {
          setPhase("waiting");
        }
        return;
      }

      // Only show loading for singleplayer
      setPhase("loading");

      setLoadingText("Loading terrain...");
      setLoadingProgress(10);
      await new Promise(r => setTimeout(r, 80));

      setLoadingText("Creating weapons...");
      setLoadingProgress(30);
      await new Promise(r => setTimeout(r, 80));

      await Promise.all(assets.map(loadAsset));
      
      setLoadingText("Loading environment...");
      setLoadingProgress(50);
      await new Promise(r => setTimeout(r, 80));

      setLoadingText("Setting up arena...");
      setLoadingProgress(70);
      await new Promise(r => setTimeout(r, 80));

      setLoadingText("Initializing match...");
      setLoadingProgress(90);
      await new Promise(r => setTimeout(r, 80));

      setLoadingText("Ready to fight!");
      setLoadingProgress(100);
      await new Promise(r => setTimeout(r, 200));

      setPhase("ready");
    };

    timeline();
  }, [gameMode]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0f1a3d 100%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {particles.map((particle, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-cyan-500/30 rounded-full"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                }}
                animate={{
                  opacity: [0.2, 0.8, 0.2],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: particle.delay,
                }}
              />
            ))}
          </div>

          <motion.div
            className="absolute left-0 right-0 top-1/2 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent)",
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {gameMode === "multiplayer" && (phase === "waiting" || phase === "ready") && (
            <motion.button
              onClick={handleLeaveClick}
              className="absolute top-6 right-6 px-4 py-2 rounded-lg font-semibold text-sm text-gray-400 hover:text-white cursor-pointer border border-gray-700 hover:border-red-500/50 hover:bg-red-500/10 transition-all flex items-center gap-2 z-10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="w-4 h-4" />
              Leave Room
            </motion.button>
          )}

          <div className="relative flex items-center justify-center w-full max-w-5xl px-8">
            <motion.div
              className="flex flex-col items-center"
              initial={{ x: -300, opacity: 0 }}
              animate={phase !== "intro" ? { x: 0, opacity: 1 } : {}}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
            >
              <motion.div
                className="relative"
                animate={phase !== "intro" ? { scale: [0.8, 1.1, 1] } : {}}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full blur-lg opacity-60" />
                
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-cyan-400/50 bg-gray-900">
                  {userProfile?.profilePicture ? (
                    <img 
                      src={userProfile.profilePicture} 
                      alt={username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-600 to-blue-600">
                      <User className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                    </div>
                  )}
                </div>

                <motion.div
                  className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center shadow-lg"
                  initial={{ scale: 0 }}
                  animate={phase !== "intro" ? { scale: 1 } : {}}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  <Zap className="w-5 h-5 text-white" />
                </motion.div>
              </motion.div>

              <motion.div
                className="mt-4 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={phase !== "intro" ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 }}
              >
                <p className="text-xl sm:text-2xl font-black text-white">{username}</p>
                <p className="text-sm text-cyan-400/80 mt-1">CHALLENGER</p>
              </motion.div>
            </motion.div>

            <motion.div
              className="mx-8 sm:mx-16 flex flex-col items-center"
              initial={{ scale: 0, rotate: -180 }}
              animate={["vs", "player2", "loading", "waiting", "ready", "countdown"].includes(phase) ? { scale: 1, rotate: 0 } : {}}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
            >
              <motion.div
                className="relative"
                animate={["vs", "player2", "loading", "waiting", "ready", "countdown"].includes(phase) ? {
                  textShadow: [
                    "0 0 20px rgba(139, 92, 246, 0.8)",
                    "0 0 40px rgba(139, 92, 246, 1)",
                    "0 0 20px rgba(139, 92, 246, 0.8)",
                  ],
                } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  {[0, 60, 120, 180, 240, 300].map((angle) => (
                    <motion.div
                      key={angle}
                      className="absolute w-2 h-2 rounded-full bg-violet-500"
                      style={{
                        transform: `rotate(${angle}deg) translateX(60px)`,
                      }}
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.2, 0.8],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: angle / 360,
                      }}
                    />
                  ))}
                </motion.div>

                <div className="relative z-10 flex items-center justify-center">
                  <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-violet-400 absolute -left-6 sm:-left-8 -rotate-45" />
                  <span className="text-5xl sm:text-7xl font-black bg-gradient-to-b from-violet-300 via-purple-400 to-violet-600 bg-clip-text text-transparent drop-shadow-2xl">
                    VS
                  </span>
                  <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-violet-400 absolute -right-6 sm:-right-8 rotate-45 scale-x-[-1]" />
                </div>
              </motion.div>

              <motion.div
                className="mt-6 h-1 w-32 sm:w-40 bg-gray-800 rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={phase === "loading" ? { opacity: 1 } : { opacity: 0 }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899)",
                  }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </motion.div>

              <motion.p
                className="mt-2 text-xs sm:text-sm text-gray-400"
                initial={{ opacity: 0 }}
                animate={phase === "loading" ? { opacity: 1 } : { opacity: 0 }}
              >
                {loadingText}
              </motion.p>

              <AnimatePresence>
                {phase === "ready" && gameMode === "singleplayer" && (
                  <motion.button
                    onClick={handleStartClick}
                    className="mt-6 px-8 py-4 rounded-xl font-bold text-lg text-white cursor-pointer border-none"
                    style={{
                      background: "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)",
                      boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
                    }}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    CLICK TO START
                  </motion.button>
                )}

                {(phase === "waiting" || phase === "ready") && gameMode === "multiplayer" && (
                  <motion.div
                    className="mt-6 flex flex-col items-center gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-6">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                        isReady ? "bg-emerald-500/20" : "bg-gray-700/50"
                      }`}>
                        {isReady ? (
                          <Check className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                        <span className={`text-sm font-semibold ${isReady ? "text-emerald-400" : "text-gray-400"}`}>
                          You: {isReady ? "Ready" : "Not Ready"}
                        </span>
                      </div>

                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                        playerCount < 2 ? "bg-gray-800/50" : opponentReady ? "bg-emerald-500/20" : "bg-gray-700/50"
                      }`}>
                        {playerCount < 2 ? (
                          <div className="flex items-center gap-1">
                            <motion.div
                              className="w-2 h-2 bg-violet-500 rounded-full"
                              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                            />
                            <motion.div
                              className="w-2 h-2 bg-violet-500 rounded-full"
                              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.div
                              className="w-2 h-2 bg-violet-500 rounded-full"
                              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                            />
                          </div>
                        ) : opponentReady ? (
                          <Check className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                        <span className={`text-sm font-semibold ${
                          playerCount < 2 ? "text-violet-400" : opponentReady ? "text-emerald-400" : "text-gray-400"
                        }`}>
                          {playerCount < 2 ? "Waiting for opponent..." : opponentReady ? "Opponent: Ready" : "Opponent: Not Ready"}
                        </span>
                      </div>
                    </div>

                    <motion.button
                      onClick={handleReadyClick}
                      disabled={isReady}
                      className="px-8 py-4 rounded-xl font-bold text-lg text-white cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: isReady 
                          ? "linear-gradient(135deg, #059669, #10b981, #34d399)"
                          : "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)",
                        boxShadow: isReady
                          ? "0 0 30px rgba(16, 185, 129, 0.5)"
                          : "0 0 30px rgba(59, 130, 246, 0.5)",
                      }}
                      whileHover={!isReady ? { scale: 1.05 } : {}}
                      whileTap={!isReady ? { scale: 0.95 } : {}}
                    >
                      {isReady ? (playerCount < 2 ? "READY! WAITING FOR OPPONENT..." : "READY! WAITING...") : "CLICK WHEN READY"}
                    </motion.button>

                    {playerCount < 2 && (
                      <p className="text-sm text-gray-500 mt-2">
                        Share this room with a friend to play!
                      </p>
                    )}
                  </motion.div>
                )}

                {phase === "countdown" && countdown !== null && (
                  <motion.div
                    className="mt-6 flex flex-col items-center gap-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <motion.div
                      key={countdown}
                      className="relative"
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.3, type: "spring" }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-32 h-32 rounded-full blur-xl ${
                          countdown === 0 
                            ? "bg-gradient-to-r from-emerald-500/50 to-green-500/50" 
                            : "bg-gradient-to-r from-violet-500/30 to-purple-500/30"
                        }`} />
                      </div>
                      <span className={`relative text-8xl font-black drop-shadow-2xl ${
                        countdown === 0 ? "text-emerald-400" : "text-white"
                      }`} style={{
                        textShadow: countdown === 0 
                          ? "0 0 40px rgba(16, 185, 129, 0.8), 0 0 80px rgba(16, 185, 129, 0.4)"
                          : "0 0 40px rgba(139, 92, 246, 0.8), 0 0 80px rgba(139, 92, 246, 0.4)",
                      }}>
                        {countdown === 0 ? "GO!" : countdown}
                      </span>
                    </motion.div>
                    <p className={`text-lg font-semibold animate-pulse ${
                      countdown === 0 ? "text-emerald-300" : "text-violet-300"
                    }`}>
                      {countdown === 0 ? "FIGHT!" : "GET READY!"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              className="flex flex-col items-center"
              initial={{ x: 300, opacity: 0 }}
              animate={["player2", "loading", "waiting", "ready", "countdown"].includes(phase) ? { x: 0, opacity: 1 } : {}}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
            >
              <motion.div
                className="relative"
                animate={["player2", "loading", "waiting", "ready", "countdown"].includes(phase) ? { scale: [0.8, 1.1, 1] } : {}}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className={`absolute -inset-2 rounded-full blur-lg opacity-60 ${
                  gameMode === "singleplayer" 
                    ? "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500"
                    : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                }`} />
                
                <div className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 bg-gray-900 ${
                  gameMode === "singleplayer" ? "border-rose-400/50" : "border-emerald-400/50"
                }`}>
                  {opponentProfile?.profilePicture && !opponentProfile.isBot ? (
                    <img 
                      src={opponentProfile.profilePicture} 
                      alt={opponentName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : gameMode === "singleplayer" ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-600 to-orange-600">
                      <Bot className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-600">
                      <User className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                    </div>
                  )}
                </div>

                <motion.div
                  className={`absolute -bottom-1 -right-1 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                    gameMode === "singleplayer"
                      ? "bg-gradient-to-r from-rose-500 to-orange-500"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500"
                  }`}
                  initial={{ scale: 0 }}
                  animate={["player2", "loading", "waiting", "ready", "countdown"].includes(phase) ? { scale: 1 } : {}}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  {gameMode === "singleplayer" ? (
                    <Bot className="w-5 h-5 text-white" />
                  ) : (
                    <Zap className="w-5 h-5 text-white" />
                  )}
                </motion.div>
              </motion.div>

              <motion.div
                className="mt-4 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={["player2", "loading", "waiting", "ready", "countdown"].includes(phase) ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 }}
              >
                <p className="text-xl sm:text-2xl font-black text-white">{opponentName}</p>
                <p className={`text-sm mt-1 ${
                  gameMode === "singleplayer" ? "text-rose-400/80" : "text-emerald-400/80"
                }`}>
                  {gameMode === "singleplayer" ? "AI OPPONENT" : "OPPONENT"}
                </p>
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            className="absolute bottom-8 left-0 right-0 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs px-4">
              {[
                { key: "WASD", action: "Move", color: "violet" },
                { key: "Mouse", action: "Aim", color: "blue" },
                { key: "Click", action: "Shoot", color: "rose" },
                { key: "Right Click", action: "Scope", color: "cyan" },
                { key: "Shift", action: "Crouch", color: "emerald" },
                { key: "R", action: "Reload", color: "amber" },
              ].map((control, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    control.color === "violet" ? "bg-violet-500/20 text-violet-400" :
                    control.color === "blue" ? "bg-blue-500/20 text-blue-400" :
                    control.color === "rose" ? "bg-rose-500/20 text-rose-400" :
                    control.color === "cyan" ? "bg-cyan-500/20 text-cyan-400" :
                    control.color === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
                    "bg-amber-500/20 text-amber-400"
                  }`}>
                    {control.key}
                  </span>
                  <span className="text-gray-500">{control.action}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: "linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899, #8b5cf6, #06b6d4)",
              backgroundSize: "200% 100%",
            }}
            animate={{
              backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{
              background: "linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4, #8b5cf6, #ec4899)",
              backgroundSize: "200% 100%",
            }}
            animate={{
              backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
