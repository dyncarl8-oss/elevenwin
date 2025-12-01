import { useGameStore } from "@/lib/stores/useGameStore";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, Home, Crown, Skull, Target, Swords, DollarSign, TrendingUp, TrendingDown, User, Bot, Coins } from "lucide-react";
import { useEffect, useState, lazy, Suspense } from "react";
import { playVictory, playLose } from "@/lib/sounds";

const Confetti = lazy(() => import("react-confetti"));

interface GameOverProps {
  sendMessage: (type: string, payload: any) => void;
}

export default function GameOver({ sendMessage }: GameOverProps) {
  const { 
    winner, 
    players, 
    playerId, 
    reset, 
    roundState, 
    opponentInfo, 
    setPendingRestart, 
    setPhase, 
    resetRoundState, 
    setWinner,
    roomType,
    entryFee,
    prizePool,
    matchWinnings,
    soloReward,
    myProfilePicture,
  } = useGameStore();
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isClient, setIsClient] = useState(false);

  const isWinner = winner?.id === playerId;
  const isWagerMatch = roomType === "wager";
  const platformFeePercent = 15;
  
  // Calculate money info
  const platformFee = isWagerMatch ? Math.floor(prizePool * (platformFeePercent / 100)) : 0;
  const winnerPayout = isWagerMatch ? prizePool - platformFee : 0;
  const myMoneyChange = isWagerMatch ? (isWinner ? winnerPayout : -entryFee) : 0;

  // Get player info with profile pictures
  const myPlayer = players.get(playerId || "");
  const opponentPlayer = Array.from(players.values()).find(p => p.id !== playerId);

  const isSoloMode = roomType === "solo";
  
  const playerStats = Array.from(players.values()).map((p) => ({
    username: p.username,
    kills: p.kills,
    isMe: p.id === playerId,
    profilePicture: p.id === playerId ? myProfilePicture : opponentInfo?.profilePicture,
    isBot: p.id !== playerId && (opponentInfo?.isBot || p.username?.toLowerCase().includes("bot")),
  })).sort((a, b) => b.kills - a.kills);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined") {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      if (isWinner) {
        playVictory();
        setShowConfetti(true);
        const timer = setTimeout(() => setShowConfetti(false), 4000);
        return () => clearTimeout(timer);
      } else {
        playLose();
      }
    }
  }, [isWinner]);

  const handlePlayAgain = () => {
    resetRoundState();
    setWinner(null);
    useGameStore.getState().setSoloReward(null);
    useGameStore.getState().setMatchWinnings(null);
    setPendingRestart(true);
    setPhase("lobby");
  };

  const handleBackToLobby = () => {
    sendMessage("leave_room", {});
    reset();
  };

  const formatCurrency = (cents: number) => {
    return `$${(Math.abs(cents) / 100).toFixed(2)}`;
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 w-full flex items-center justify-center p-4 overflow-y-auto"
        style={{
          background: isWinner 
            ? "linear-gradient(135deg, #0a0a1a 0%, #1a1a0a 50%, #0a0a1a 100%)"
            : "linear-gradient(135deg, #0a0a1a 0%, #1a0a1a 50%, #0a0a1a 100%)"
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {isClient && showConfetti && (
          <Suspense fallback={null}>
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              recycle={false}
              numberOfPieces={150}
              colors={["#fbbf24", "#f59e0b", "#d97706", "#06b6d4", "#8b5cf6"]}
              style={{ position: 'fixed', top: 0, left: 0, zIndex: 100 }}
            />
          </Suspense>
        )}

        <motion.div 
          className="w-full max-w-xl my-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div 
            className="rounded-3xl overflow-hidden"
            style={{
              background: isWinner
                ? "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(50, 40, 20, 0.95) 100%)"
                : "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(50, 20, 30, 0.95) 100%)",
              border: isWinner
                ? "2px solid rgba(234, 179, 8, 0.4)"
                : "2px solid rgba(239, 68, 68, 0.4)",
            }}
          >
            <div className="p-5">
              {/* Header */}
              <motion.div 
                className="text-center mb-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex justify-center mb-3">
                  {isWinner ? (
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(251, 191, 36, 0.25) 100%)",
                        border: "2px solid rgba(234, 179, 8, 0.5)",
                      }}
                    >
                      <Crown className="h-8 w-8 text-yellow-400" />
                    </div>
                  ) : (
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)",
                        border: "2px solid rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      <Skull className="h-8 w-8 text-red-400" />
                    </div>
                  )}
                </div>

                <h1 className={`text-4xl font-black mb-1 ${isWinner ? "text-yellow-400" : "text-red-400"}`}>
                  {isWinner ? "VICTORY!" : "DEFEATED"}
                </h1>
                <p className="text-sm text-gray-400">
                  {isWagerMatch ? "Wager Match" : roomType === "solo" ? "Solo Match" : "Free Match"} - Best of 3
                </p>
              </motion.div>

              {/* Wager Result - Money Won/Lost */}
              {isWagerMatch && (
                <motion.div
                  className={`mb-4 p-4 rounded-2xl ${
                    isWinner 
                      ? "bg-emerald-500/15 border border-emerald-500/30" 
                      : "bg-red-500/15 border border-red-500/30"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isWinner ? (
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                          <TrendingDown className="w-6 h-6 text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-400">
                          {isWinner ? "You Won" : "You Lost"}
                        </p>
                        <p className={`text-2xl font-bold ${isWinner ? "text-emerald-400" : "text-red-400"}`}>
                          {isWinner ? "+" : "-"}{formatCurrency(Math.abs(myMoneyChange))}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Prize Pool</p>
                      <p className="text-sm font-semibold text-white">{formatCurrency(prizePool)}</p>
                      <p className="text-xs text-gray-500">Fee: {formatCurrency(platformFee)}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Solo Mode - Coins Earned */}
              {isSoloMode && isWinner && soloReward && (
                <motion.div
                  className="mb-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Coins Earned</p>
                        <p className="text-2xl font-bold text-amber-400">
                          +{soloReward.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Victory Reward</p>
                      <p className="text-sm font-semibold text-amber-300">Solo Win Bonus</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Match Score with Profile Pictures */}
              <motion.div
                className="mb-4 p-4 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="flex items-center justify-between">
                  {/* My Player */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      {myProfilePicture ? (
                        <img 
                          src={myProfilePicture} 
                          alt="You" 
                          className="w-14 h-14 rounded-full object-cover border-2 border-cyan-500/50"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-600/30 flex items-center justify-center border-2 border-cyan-500/50">
                          <User className="w-7 h-7 text-cyan-400" />
                        </div>
                      )}
                      {isWinner && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                          <Crown className="w-3 h-3 text-yellow-900" />
                        </div>
                      )}
                    </div>
                    <div className="text-3xl font-black text-emerald-400">
                      {roundState.playerWins}
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[80px]">
                      {myPlayer?.username || "You"}
                    </div>
                  </div>
                  
                  {/* VS */}
                  <div className="flex flex-col items-center px-4">
                    <Swords className="w-7 h-7 text-purple-400" />
                    <span className="text-xs text-purple-400 font-semibold mt-1">ROUNDS</span>
                  </div>
                  
                  {/* Opponent */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      {opponentInfo?.profilePicture ? (
                        <img 
                          src={opponentInfo.profilePicture} 
                          alt="Opponent" 
                          className="w-14 h-14 rounded-full object-cover border-2 border-red-500/50"
                        />
                      ) : opponentInfo?.isBot || isSoloMode ? (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-600/30 flex items-center justify-center border-2 border-purple-500/50">
                          <Bot className="w-7 h-7 text-purple-400" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500/30 to-orange-600/30 flex items-center justify-center border-2 border-red-500/50">
                          <User className="w-7 h-7 text-red-400" />
                        </div>
                      )}
                      {!isWinner && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                          <Crown className="w-3 h-3 text-yellow-900" />
                        </div>
                      )}
                    </div>
                    <div className="text-3xl font-black text-red-400">
                      {roundState.opponentWins}
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[80px]">
                      {opponentInfo?.username || "Opponent"}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Results Scoreboard */}
              <motion.div 
                className="mb-4 p-4 rounded-2xl"
                style={{
                  background: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid rgba(100, 116, 139, 0.25)"
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white">Match Stats</span>
                </div>
                
                <div className="space-y-2">
                  {playerStats.map((player, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        player.isMe
                          ? "bg-cyan-500/15 border border-cyan-500/25"
                          : "bg-gray-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                            index === 0 
                              ? "bg-yellow-500/20 text-yellow-400" 
                              : "bg-gray-700/50 text-gray-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                        {player.profilePicture ? (
                          <img 
                            src={player.profilePicture} 
                            alt={player.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : player.isBot ? (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-600/30 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-purple-400" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <span className={`font-medium ${player.isMe ? "text-cyan-400" : "text-white"}`}>
                          {player.username}
                          {player.isMe && <span className="text-cyan-400/50 text-xs ml-1">(you)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-gray-500" />
                        <span className={`font-bold ${player.isMe ? "text-cyan-400" : "text-white"}`}>
                          {player.kills}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <motion.button
                  onClick={handlePlayAgain}
                  className="w-full rounded-xl p-3.5 font-bold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.8) 0%, rgba(16, 185, 129, 0.8) 100%)",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    Play Again
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleBackToLobby}
                  className="w-full rounded-xl p-3.5 font-bold text-gray-300 transition-all"
                  style={{
                    background: "rgba(30, 41, 59, 0.7)",
                    border: "1px solid rgba(100, 116, 139, 0.4)",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Home className="h-5 w-5" />
                    Back to Lobby
                  </span>
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
