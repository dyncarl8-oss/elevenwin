import { Button } from "@/components/ui/button";
import { useJoinGame } from "@/hooks/use-games";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Play, Trophy, Users } from "lucide-react";
import type { Game } from "@shared/schema";

interface GameCardProps {
  game: Game;
  disabled?: boolean;
}

export default function GameCard({ game, disabled = false }: GameCardProps) {
  const joinGame = useJoinGame();
  const { user } = useWhopUser();
  const { makePayment, isPaymentPending } = useWhopPayments();
  const { lastUpdate } = useGameWebSocket(game.id);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleJoinGame = async () => {
    try {
      // For Whop integration, we could trigger payment first
      // For now, we'll use the existing balance system but with Whop auth
      await joinGame.mutateAsync({ gameId: game.id });
      toast({
        title: "Joined game successfully",
        description: `You've joined ${game.name}. Waiting for other players...`,
      });
      
      // Don't navigate - stay on lobby page to show waiting area
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to join game";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleWhopPayment = async () => {
    try {
      // Get the appropriate Whop plan ID for this game's entry fee
      const amount = parseFloat(game.entryFee);
      const planId = amount <= 1 ? "plan_game_entry_1_dollar" : 
                    amount <= 2 ? "plan_game_entry_2_dollar" :
                    amount <= 5 ? "plan_game_entry_5_dollar" :
                    "plan_game_entry_10_dollar";
      
      // Trigger Whop payment for game entry
      await makePayment({
        amount,
        description: `Entry fee for ${game.name}`,
      });
      
      // After successful payment, join the game
      await handleJoinGame();
    } catch (error) {
      // Payment error is already handled by useWhopPayments hook
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-500";
      case "filling":
        return "bg-amber-500";
      case "full":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "Open";
      case "filling":
        return "Filling";
      case "full":
        return "Full";
      default:
        return status;
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-purple-950/40 via-purple-900/30 to-purple-950/40 rounded-2xl p-5 border-2 border-purple-800/40 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-purple-500/60 hover:-translate-y-1 backdrop-blur-md overflow-hidden"
         data-testid={`game-card-${game.id}`}>
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full"></div>
      
      {/* Status badge - repositioned to top right */}
      <div className="absolute top-4 right-4">
        <span className={`${getStatusColor(game.status)} text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg`}
              data-testid={`game-status-${game.id}`}>
          {getStatusText(game.status)}
        </span>
      </div>
      
      {/* Game title with icon */}
      <div className="flex items-center space-x-3 mb-5 pr-20">
        <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-2.5 rounded-xl shadow-lg">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight" data-testid={`game-name-${game.id}`}>
          {game.name}
        </h3>
      </div>
      
      {/* Game info in horizontal layout */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-purple-900/30 border border-purple-700/30 rounded-xl p-3 text-center">
          <div className="text-xs text-purple-300 mb-1 font-medium">Entry Fee</div>
          <div className="text-lg font-bold text-white" data-testid={`game-entry-fee-${game.id}`}>
            ${parseFloat(game.entryFee).toFixed(2)}
          </div>
        </div>
        <div className="bg-purple-900/30 border border-purple-700/30 rounded-xl p-3 text-center">
          <div className="text-xs text-purple-300 mb-1 font-medium flex items-center justify-center gap-1">
            <Users className="w-3 h-3" />Players
          </div>
          <div className="text-lg font-bold text-white" data-testid={`game-players-${game.id}`}>
            {game.currentPlayers}/{game.maxPlayers}
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-3 text-center">
          <div className="text-xs text-amber-200 mb-1 font-medium">Prize</div>
          <div className="text-lg font-bold text-amber-400" data-testid={`game-prize-${game.id}`}>
            ${parseFloat(game.prizeAmount).toFixed(2)}
          </div>
        </div>
      </div>
      
      {/* Join button with new styling */}
      <button 
        className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 hover:from-purple-500 hover:via-purple-400 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50 shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2 relative overflow-hidden group"
        onClick={user ? handleJoinGame : handleWhopPayment}
        disabled={disabled || joinGame.isPending || isPaymentPending || game.status === "full"}
        data-testid={`button-join-game-${game.id}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
        {joinGame.isPending || isPaymentPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {joinGame.isPending ? "Joining..." : "Processing Payment..."}
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span className="tracking-wide">Join Game</span>
          </>
        )}
      </button>
    </div>
  );
}
