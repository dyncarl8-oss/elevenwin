import { useGameStore } from "@/lib/stores/useGameStore";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Target, Skull, Trophy, Circle } from "lucide-react";

export default function GameHUD() {
  const { players, playerId, phase, roundState } = useGameStore();

  if (phase !== "playing") return null;

  const localPlayer = playerId ? players.get(playerId) : null;
  const remotePlayers = Array.from(players.values()).filter((p) => p.id !== playerId);

  const getHealthColor = (health: number) => {
    if (health > 70) return { bg: "from-emerald-500 to-green-400", glow: "rgba(34, 197, 94, 0.4)" };
    if (health > 30) return { bg: "from-yellow-500 to-orange-400", glow: "rgba(234, 179, 8, 0.4)" };
    return { bg: "from-red-600 to-red-400", glow: "rgba(239, 68, 68, 0.4)" };
  };

  const RoundIndicator = ({ wins, isPlayer }: { wins: number; isPlayer: boolean }) => (
    <div className="flex gap-1">
      {[0, 1].map((i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border-2 ${
            i < wins
              ? isPlayer
                ? "bg-emerald-400 border-emerald-400"
                : "bg-red-400 border-red-400"
              : "bg-transparent border-gray-500"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      <div className="absolute top-0 left-0 right-0 p-2 sm:p-3">
        <div className="flex justify-between items-start gap-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl p-2.5 sm:p-3 min-w-[160px] sm:min-w-[200px]"
            style={{
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.9) 100%)",
              border: "1px solid rgba(79, 209, 255, 0.25)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white font-bold text-sm truncate max-w-[100px] sm:max-w-[140px]">
                {localPlayer?.username || "You"}
              </span>
              {localPlayer && (
                <div className="flex items-center gap-1 ml-auto">
                  <Skull className="h-3 w-3 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-sm">{localPlayer.kills}</span>
                </div>
              )}
            </div>

            {localPlayer && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Heart className="h-3 w-3 text-red-400" />
                  <span className={`text-xs font-bold ${localPlayer.health > 30 ? "text-white" : "text-red-400"}`}>
                    {localPlayer.health}
                  </span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden bg-gray-800/80">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${getHealthColor(localPlayer.health).bg}`}
                    style={{ boxShadow: `0 0 10px ${getHealthColor(localPlayer.health).glow}` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${localPlayer.health}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            )}
          </motion.div>

          {remotePlayers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-xl p-2.5 sm:p-3 min-w-[140px] sm:min-w-[180px]"
              style={{
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(50, 20, 30, 0.9) 100%)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3 w-3 text-red-400" />
                <span className="text-red-400/80 text-xs font-bold uppercase">Enemy</span>
              </div>

              <AnimatePresence>
                {remotePlayers.map((player) => (
                  <motion.div key={player.id} className="mb-1 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium text-xs truncate max-w-[80px] sm:max-w-[100px]">
                        {player.username}
                      </span>
                      <span className={`text-xs font-bold ${player.health > 30 ? "text-white" : "text-red-400"}`}>
                        {player.health}
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full overflow-hidden bg-gray-800/80">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${getHealthColor(player.health).bg}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${player.health}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Round Score Display - Top Center */}
      <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div
            className="rounded-xl px-4 py-2 flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%)",
              border: "1px solid rgba(139, 92, 246, 0.4)",
            }}
          >
            <div className="flex items-center gap-2">
              <RoundIndicator wins={roundState.playerWins} isPlayer={true} />
              <span className="text-emerald-400 font-bold text-lg">{roundState.playerWins}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="text-purple-400 text-xs font-semibold uppercase tracking-wider">Round</div>
              <div className="text-white font-bold text-lg">{roundState.currentRound}/{roundState.maxRounds}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-bold text-lg">{roundState.opponentWins}</span>
              <RoundIndicator wins={roundState.opponentWins} isPlayer={false} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
