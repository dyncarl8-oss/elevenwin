import { useGameStore } from "@/lib/stores/useGameStore";
import { AnimatePresence } from "framer-motion";
import { Users, RefreshCw, Bot, Zap, ChevronRight, User, ShoppingBag, Trophy, Wallet, Coins, Target, Gamepad2, DollarSign, AlertCircle, Plus, ArrowDownLeft } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { UserProfile } from "@/pages/experience-page";
import SkinStore from "./SkinStore";
import Leaderboard from "./Leaderboard";
import VsScreen from "./VsScreen";
import CreateRoomModal from "./CreateRoomModal";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";

interface LobbyProps {
  sendMessage: (type: string, payload: any) => void;
  userProfile: UserProfile | null;
}

interface WalletData {
  balance: number;
  coins: number;
  balanceFormatted: string;
}

export default function Lobby({ sendMessage, userProfile }: LobbyProps) {
  const { rooms, isConnected, setEquippedSkins, setGameMode, setOpponentInfo, setAssetsPreloaded, setReadyPlayers, setCountdown, gameMode, opponentInfo, setPhase, pendingRestart, setPendingRestart } = useGameStore();
  const username = userProfile?.name || userProfile?.username || "Player";
  const [showStore, setShowStore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const fetchingRef = useRef(false);
  const equippedFetchedRef = useRef(false);
  const [showVsScreen, setShowVsScreen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; payload: any } | null>(null);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  const sessionToken = typeof window !== 'undefined' ? sessionStorage.getItem("session_token") : null;

  const fetchEquippedSkins = useCallback(async () => {
    const token = sessionStorage.getItem("session_token");
    if (!token || equippedFetchedRef.current) return;
    
    equippedFetchedRef.current = true;
    
    try {
      const response = await fetch("/api/skins/equipped", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const equipped = data.equipped || {};
        
        setEquippedSkins({
          sniper: equipped.sniper?.skinId || null,
          pistol: equipped.pistol?.skinId || null,
          crosshair: equipped.crosshair?.skinId || null,
        });
        
        console.log("Equipped skins loaded:", equipped);
      }
    } catch (err) {
      console.error("Failed to fetch equipped skins:", err);
    }
  }, [setEquippedSkins]);

  const fetchWallet = useCallback(async () => {
    const token = sessionStorage.getItem("session_token");
    if (!token || fetchingRef.current) return;
    
    fetchingRef.current = true;
    setIsWalletLoading(true);
    
    try {
      const response = await fetch(`/api/wallet?username=${encodeURIComponent(username)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWallet(data);
      }
    } catch (err) {
      console.error("Failed to fetch wallet:", err);
    } finally {
      setIsWalletLoading(false);
      fetchingRef.current = false;
    }
  }, [username]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWallet();
      fetchEquippedSkins();
    }, 100);
    return () => clearTimeout(timer);
  }, [fetchWallet, fetchEquippedSkins]);

  useEffect(() => {
    if (pendingRestart && gameMode && opponentInfo) {
      setShowVsScreen(true);
      setPendingAction({ type: "start_game", payload: {} });
      setPendingRestart(false);
    }
  }, [pendingRestart, gameMode, opponentInfo, setPendingRestart]);

  const handleWalletUpdate = useCallback(() => {
    fetchWallet();
    equippedFetchedRef.current = false;
    fetchEquippedSkins();
  }, [fetchWallet, fetchEquippedSkins]);

  const handleCreateRoom = () => {
    setShowCreateRoomModal(true);
  };

  const handleCreateWagerRoom = (entryFee: number) => {
    setIsCreatingRoom(true);
    setGameMode("multiplayer");
    setOpponentInfo({ username: "Waiting...", isBot: false });
    setReadyPlayers([]);
    setCountdown(null);
    sendMessage("create_wager_room", { 
      username, 
      profilePicture: userProfile?.profilePicture || null,
      entryFee,
    });
    setShowCreateRoomModal(false);
    setIsCreatingRoom(false);
    setShowVsScreen(true);
    setPendingAction(null);
  };

  const handleSinglePlayer = () => {
    setGameMode("singleplayer");
    setOpponentInfo({ username: "AI Bot", isBot: true });
    setReadyPlayers([]);
    setCountdown(null);
    setShowVsScreen(true);
    setPendingAction({ type: "create_singleplayer", payload: { username, profilePicture: userProfile?.profilePicture || null } });
  };

  const handleJoinRoom = (roomId: string, entryFee: number = 0) => {
    if (entryFee > 0 && wallet && wallet.balance < entryFee) {
      setJoinError(`Insufficient balance. You need $${(entryFee / 100).toFixed(2)} to join this room.`);
      setTimeout(() => setJoinError(null), 4000);
      return;
    }
    
    setGameMode("multiplayer");
    setOpponentInfo({ username: "Opponent", isBot: false });
    setReadyPlayers([]);
    setCountdown(null);
    sendMessage("join_room", { 
      roomId, 
      username,
      profilePicture: userProfile?.profilePicture || null 
    });
    setShowVsScreen(true);
    setPendingAction(null);
  };

  const handleVsComplete = useCallback(() => {
    setAssetsPreloaded(true);
    if (pendingAction) {
      sendMessage(pendingAction.type, pendingAction.payload);
      setPendingAction(null);
    }
    setShowVsScreen(false);
    // Transition to game after VsScreen countdown completes
    setPhase("playing");
  }, [pendingAction, sendMessage, setAssetsPreloaded, setPhase]);

  const handleLeaveRoom = useCallback(() => {
    setShowVsScreen(false);
    setGameMode(null);
    setOpponentInfo(null);
    setReadyPlayers([]);
    setCountdown(null);
    setPendingAction(null);
    // Refresh the room list
    sendMessage("list_rooms", {});
  }, [sendMessage, setGameMode, setOpponentInfo, setReadyPlayers, setCountdown]);

  const handleRefresh = () => {
    sendMessage("list_rooms", {});
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#080810]">
      <div className="flex-1 flex flex-col w-full px-5 py-4">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {userProfile?.profilePicture ? (
              <img 
                src={userProfile.profilePicture} 
                alt={username}
                className="w-12 h-12 rounded-full object-cover border-2 border-violet-500/40"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600"
              style={{ display: userProfile?.profilePicture ? 'none' : 'flex' }}
            >
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">
                {userProfile?.name || userProfile?.username || "Player"}
              </p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-sm text-gray-400">
                  {isConnected ? "Online" : "Connecting..."}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isWalletLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-20 h-9 bg-white/5 rounded-2xl animate-pulse"></div>
                <div className="w-20 h-9 bg-white/5 rounded-2xl animate-pulse"></div>
              </div>
            ) : wallet ? (
              <>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:scale-105 active:scale-95"
                  title="Withdraw Funds"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Withdraw</span>
                </button>
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl hover:scale-105 active:scale-95"
                  title="Add Funds"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/20">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-bold">{wallet.balanceFormatted}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/20">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 text-sm font-bold">{wallet.coins.toLocaleString()}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setShowStore(true)}
            className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-base shadow-lg shadow-violet-500/25 transition-transform duration-150 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <ShoppingBag className="w-5 h-5" />
            Store
          </button>
          
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-lg shadow-amber-500/25 transition-transform duration-150 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Trophy className="w-5 h-5" />
            Ranks
          </button>
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-violet-400" />
            Play Now
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSinglePlayer}
              disabled={!isConnected || !username}
              className="relative overflow-hidden flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/20 transition-transform duration-150 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">Solo Mode</p>
                  <p className="text-emerald-100/80 text-xs flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    vs AI • Earn Coins
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/50" />
            </button>

            <button
              onClick={handleCreateRoom}
              disabled={!isConnected || !username}
              className="relative overflow-hidden flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-blue-500/20 transition-transform duration-150 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Target className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">Multiplayer</p>
                  <p className="text-blue-100/80 text-xs flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Create Room • 1v1
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/50" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              Active Rooms
            </p>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all hover:rotate-180 duration-300"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 bg-white/[0.02] rounded-2xl p-3 overflow-y-auto border border-white/5">
            {joinError && (
              <div className="flex items-center gap-2 p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{joinError}</span>
              </div>
            )}
            {rooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-gray-400 font-semibold">No active rooms</p>
                <p className="text-gray-600 text-sm mt-1">Create one to start playing!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => {
                  const entryFee = room.entryFee || 0;
                  const isWagerRoom = room.roomType === "wager" && entryFee > 0;
                  const canAfford = !isWagerRoom || (wallet && wallet.balance >= entryFee);
                  const potentialWin = isWagerRoom ? Math.floor(entryFee * 2 * 0.85) : 0;
                  
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${
                        isWagerRoom 
                          ? "bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isWagerRoom 
                            ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20"
                            : "bg-violet-500/20"
                        }`}>
                          {isWagerRoom ? (
                            <DollarSign className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Users className="h-5 w-5 text-violet-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold text-sm">
                              {isWagerRoom ? "Wager Room" : "Free Room"}
                            </p>
                            {isWagerRoom && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                ${(entryFee / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-0.5">
                            <span className="text-gray-500">{room.playerCount}/{room.maxPlayers}</span>
                            {isWagerRoom && (
                              <span className="text-emerald-400/70">
                                Win ${(potentialWin / 100).toFixed(2)}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              room.status === "waiting" 
                                ? "bg-emerald-500/20 text-emerald-400" 
                                : "bg-amber-500/20 text-amber-400"
                            }`}>
                              {room.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => handleJoinRoom(room.id, entryFee)}
                          disabled={room.playerCount >= room.maxPlayers || room.status !== "waiting" || !canAfford}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 hover:scale-105 active:scale-95 ${
                            isWagerRoom
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600"
                              : "bg-emerald-500"
                          }`}
                        >
                          {isWagerRoom ? `Join $${(entryFee / 100).toFixed(2)}` : "Join"}
                        </button>
                        {isWagerRoom && !canAfford && (
                          <span className="text-[10px] text-red-400">Insufficient funds</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { keys: "WASD", action: "Move", color: "violet" },
              { keys: "Mouse", action: "Aim", color: "blue" },
              { keys: "Click", action: "Shoot", color: "rose" },
              { keys: "Right Click", action: "Scope", color: "cyan" },
              { keys: "Shift", action: "Crouch", color: "emerald" },
              { keys: "R", action: "Reload", color: "amber" },
            ].map((control, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  control.color === "violet" ? "bg-violet-500/20 text-violet-400" :
                  control.color === "blue" ? "bg-blue-500/20 text-blue-400" :
                  control.color === "rose" ? "bg-rose-500/20 text-rose-400" :
                  control.color === "cyan" ? "bg-cyan-500/20 text-cyan-400" :
                  control.color === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-amber-500/20 text-amber-400"
                }`}>
                  {control.keys}
                </span>
                <span className="text-gray-500 text-xs">{control.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showStore && (
          <SkinStore 
            sessionToken={sessionToken}
            username={username}
            onClose={() => setShowStore(false)}
            onWalletUpdate={handleWalletUpdate}
          />
        )}
        
        {showLeaderboard && (
          <Leaderboard 
            sessionToken={sessionToken}
            onClose={() => setShowLeaderboard(false)}
          />
        )}

        {showVsScreen && (
          <VsScreen
            userProfile={userProfile}
            opponentProfile={opponentInfo}
            gameMode={gameMode || "singleplayer"}
            onComplete={handleVsComplete}
            onLeave={gameMode === "multiplayer" ? handleLeaveRoom : undefined}
            sendMessage={gameMode === "multiplayer" ? sendMessage : undefined}
          />
        )}

        <CreateRoomModal
          isOpen={showCreateRoomModal}
          onClose={() => setShowCreateRoomModal(false)}
          onCreateRoom={handleCreateWagerRoom}
          currentBalance={wallet?.balance || 0}
          isLoading={isCreatingRoom}
        />

        <DepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          onSuccess={handleWalletUpdate}
          sessionToken={sessionToken}
          username={username}
        />

        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={handleWalletUpdate}
          sessionToken={sessionToken}
          username={username}
          currentBalance={wallet?.balance || 0}
        />
      </AnimatePresence>
    </div>
  );
}
