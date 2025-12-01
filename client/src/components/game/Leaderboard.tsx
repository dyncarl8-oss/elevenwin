import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Target, Flame, Coins, X, Crown, TrendingUp, Award } from "lucide-react";
import { useState, useEffect } from "react";

interface LeaderboardProps {
  sessionToken: string | null;
  onClose: () => void;
}

type Category = "earnings" | "wins" | "kd" | "streak" | "coins";

interface LeaderboardEntry {
  rank: number;
  odellId: string;
  odellname: string;
  profilePicture: string | null;
  value: number;
  stats: {
    wins: number;
    losses: number;
    earnings: number;
    kdRatio: number;
    matchesPlayed: number;
  };
}

interface PlayerStats {
  odellname: string;
  profilePicture: string | null;
  totalWins: number;
  totalLosses: number;
  winRate: string;
  totalEarnings: number;
  earningsFormatted: string;
  totalWagered: number;
  currentWinStreak: number;
  bestWinStreak: number;
  totalKills: number;
  totalDeaths: number;
  kdRatio: string;
  soloWins: number;
  coinsEarned: number;
  matchesPlayed: number;
}

const categoryConfig: Record<Category, { label: string; icon: React.ReactNode; format: (v: number) => string }> = {
  earnings: { 
    label: "Top Earners", 
    icon: <Trophy className="w-5 h-5" />,
    format: (v) => `$${(v / 100).toFixed(2)}`
  },
  wins: { 
    label: "Most Wins", 
    icon: <Medal className="w-5 h-5" />,
    format: (v) => `${v}`
  },
  kd: { 
    label: "Best K/D", 
    icon: <Target className="w-5 h-5" />,
    format: (v) => v.toFixed(2)
  },
  streak: { 
    label: "Win Streak", 
    icon: <Flame className="w-5 h-5" />,
    format: (v) => `${v}`
  },
  coins: { 
    label: "Coin Masters", 
    icon: <Coins className="w-5 h-5" />,
    format: (v) => v.toLocaleString()
  },
};

export default function Leaderboard({ sessionToken, onClose }: LeaderboardProps) {
  const [category, setCategory] = useState<Category>("earnings");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [category]);

  useEffect(() => {
    if (sessionToken) {
      fetchMyStats();
      fetchMyRank();
    }
  }, [sessionToken, category]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leaderboard/${category}?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyStats = async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch("/api/stats", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMyStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch my stats:", err);
    }
  };

  const fetchMyRank = async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/stats/rank?category=${category}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMyRank(data.rank);
      }
    } catch (err) {
      console.error("Failed to fetch my rank:", err);
    }
  };

  const config = categoryConfig[category];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      
      <motion.div
        className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden bg-[#0c0c14] border border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Leaderboards</h2>
              <p className="text-sm text-gray-500">Compete for the top</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-2xl hover:bg-white/5 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex gap-2 p-4 overflow-x-auto border-b border-white/5">
          {(Object.keys(categoryConfig) as Category[]).map(cat => {
            const catConfig = categoryConfig[cat];
            const isActive = category === cat;
            
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive 
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {catConfig.icon}
                {catConfig.label}
              </button>
            );
          })}
        </div>

        {myStats && (
          <div className="mx-4 mt-4 p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden">
                  {myStats.profilePicture ? (
                    <img 
                      src={myStats.profilePicture} 
                      alt={myStats.odellname}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500 ${myStats.profilePicture ? 'hidden' : ''}`}>
                    <span className="text-white font-bold text-xl">
                      {myStats.odellname?.charAt(0).toUpperCase() || "?"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{myStats.odellname}</p>
                  <p className="text-cyan-400/80 text-sm">Your Stats</p>
                </div>
              </div>
              {myRank && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/30">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <span className="text-white font-bold text-lg">#{myRank}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Wins", value: myStats.totalWins, color: "text-blue-400" },
                { label: "K/D", value: myStats.kdRatio, color: "text-rose-400" },
                { label: "Earned", value: myStats.earningsFormatted, color: "text-emerald-400" },
                { label: "Coins", value: myStats.coinsEarned.toLocaleString(), color: "text-amber-400" },
              ].map(stat => (
                <div key={stat.label} className="text-center p-3 rounded-xl bg-black/20">
                  <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                  <p className={`${stat.color} font-bold text-base`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-4 pt-4 overflow-y-auto flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02]">
                  <div className="w-12 h-12 bg-white/5 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-white/5 rounded-lg w-1/3 mb-2"></div>
                    <div className="h-3 bg-white/5 rounded-lg w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {entries.map((entry, index) => {
                  const isTop3 = entry.rank <= 3;
                  
                  return (
                    <motion.div
                      key={entry.odellId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`flex items-center gap-3 p-4 rounded-2xl transition-colors ${
                        isTop3 
                          ? entry.rank === 1 ? "bg-amber-500/15 border border-amber-500/25" 
                          : entry.rank === 2 ? "bg-gray-400/10 border border-gray-400/20"
                          : "bg-orange-500/10 border border-orange-500/20"
                          : "bg-white/[0.02] hover:bg-white/[0.05] border border-white/5"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        entry.rank === 1 ? "bg-amber-500/25 text-amber-400" :
                        entry.rank === 2 ? "bg-gray-400/25 text-gray-300" :
                        entry.rank === 3 ? "bg-orange-500/25 text-orange-400" :
                        "bg-white/5 text-gray-500"
                      }`}>
                        {entry.rank <= 3 ? (
                          entry.rank === 1 ? <Crown className="w-4 h-4" /> :
                          entry.rank === 2 ? <Award className="w-4 h-4" /> :
                          <Medal className="w-4 h-4" />
                        ) : (
                          entry.rank
                        )}
                      </div>

                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                        {entry.profilePicture ? (
                          <img 
                            src={entry.profilePicture} 
                            alt={entry.odellname}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${
                          entry.profilePicture ? 'hidden' : ''
                        } ${
                          entry.rank === 1 ? "bg-gradient-to-br from-amber-500 to-orange-500" :
                          entry.rank === 2 ? "bg-gradient-to-br from-gray-400 to-gray-500" :
                          entry.rank === 3 ? "bg-gradient-to-br from-orange-500 to-amber-600" :
                          "bg-gradient-to-br from-purple-500 to-indigo-500"
                        }`}>
                          <span className="text-white font-bold text-sm">
                            {entry.odellname?.charAt(0).toUpperCase() || "?"}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-base truncate">{entry.odellname}</p>
                        <p className="text-sm text-gray-500">
                          {entry.stats.wins}W • {entry.stats.losses}L • {entry.stats.matchesPlayed} games
                        </p>
                      </div>
                      
                      <p className={`font-bold text-lg shrink-0 ${
                        category === "earnings" ? "text-emerald-400" :
                        category === "coins" ? "text-amber-400" :
                        category === "kd" ? "text-rose-400" :
                        category === "streak" ? "text-orange-400" :
                        "text-blue-400"
                      }`}>
                        {config.format(entry.value)}
                      </p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {entries.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-400 font-semibold text-lg">No players yet</p>
                  <p className="text-gray-600 text-sm mt-1">Be the first to compete!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
