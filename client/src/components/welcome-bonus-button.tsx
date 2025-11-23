import { useState } from "react";
import { Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface WelcomeBonusButtonProps {
  userId: string;
  onClaimed?: () => void;
}

export default function WelcomeBonusButton({ userId, onClaimed }: WelcomeBonusButtonProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      
      const response = await apiRequest("POST", `/api/user/${userId}/claim-welcome-bonus`, {});
      const data = await response.json();
      
      if (data.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user", userId] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user", userId, "transactions"] }),
          queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}/welcome-bonus-eligible`] }),
        ]);

        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["/api/whop/user"] }),
          queryClient.refetchQueries({ queryKey: ["/api/user", userId] }),
        ]);
        
        toast({
          title: "Welcome Bonus Claimed!",
          description: "$2.00 has been added to your account. Start playing now!",
        });
        
        if (onClaimed) {
          onClaimed();
        }
      }
    } catch (error) {
      console.error("Failed to claim welcome bonus:", error);
      toast({
        title: "Error",
        description: "Failed to claim welcome bonus. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <button
      onClick={handleClaim}
      disabled={isClaiming}
      className="relative bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base animate-bounce"
      data-testid="button-claim-welcome-bonus"
    >
      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
        FREE
      </div>
      <div className="flex items-center justify-center gap-2">
        <Gift className="w-4 h-4" />
        <span>{isClaiming ? "Claiming..." : "Claim $2"}</span>
      </div>
    </button>
  );
}
