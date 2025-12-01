import { useGameStore } from "@/lib/stores/useGameStore";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Skull, Swords } from "lucide-react";
import { useEffect, useState } from "react";

export default function RoundOverlay() {
  const { roundState, playerId, players, opponentInfo } = useGameStore();
  const [countdown, setCountdown] = useState(3);

  const localPlayer = playerId ? players.get(playerId) : null;
  const isRoundOver = roundState.roundPhase === "round_over";

  useEffect(() => {
    if (isRoundOver) {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRoundOver, roundState.currentRound]);

  const didPlayerWinRound = localPlayer && localPlayer.isAlive;

  return (
    <AnimatePresence>
      {isRoundOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(30, 0, 50, 0.9) 100%)",
          }}
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="mb-6"
            >
              {didPlayerWinRound ? (
                <Trophy className="w-24 h-24 mx-auto text-yellow-400" />
              ) : (
                <Skull className="w-24 h-24 mx-auto text-red-400" />
              )}
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2
                className={`text-4xl font-bold mb-2 ${
                  didPlayerWinRound ? "text-yellow-400" : "text-red-400"
                }`}
              >
                {didPlayerWinRound ? "ROUND WON!" : "ROUND LOST"}
              </h2>
              <p className="text-gray-400 text-lg mb-6">
                Round {roundState.currentRound} Complete
              </p>
            </motion.div>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-8 mb-8"
            >
              <div className="text-center">
                <div className="text-emerald-400 text-5xl font-bold">
                  {roundState.playerWins}
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  {localPlayer?.username || "You"}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <Swords className="w-10 h-10 text-purple-400 mb-1" />
                <span className="text-purple-400 text-sm font-semibold">VS</span>
              </div>

              <div className="text-center">
                <div className="text-red-400 text-5xl font-bold">
                  {roundState.opponentWins}
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  {opponentInfo?.username || "Opponent"}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <p className="text-gray-500 text-sm mb-2">Next round starting in</p>
              <motion.div
                key={countdown}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-bold text-white"
              >
                {countdown}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 flex justify-center gap-4"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50">
                <span className="text-gray-400 text-sm">First to</span>
                <span className="text-white font-bold">2 wins</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
