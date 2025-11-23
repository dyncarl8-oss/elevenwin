import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface WelcomeBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function WelcomeBonusModal({
  isOpen,
  onClose,
  userId,
}: WelcomeBonusModalProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      
      const response = await apiRequest("POST", `/api/user/${userId}/claim-welcome-bonus`, {});
      const data = await response.json();
      
      if (data.success) {
        // Invalidate and refetch user data to ensure balance updates immediately
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user", userId] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user", userId, "transactions"] }),
        ]);

        // Force refetch to ensure UI updates before closing modal
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["/api/whop/user"] }),
          queryClient.refetchQueries({ queryKey: ["/api/user", userId] }),
        ]);
        
        toast({
          title: "Welcome Bonus Claimed!",
          description: "$2.00 has been added to your account. Start playing now!",
        });
        
        onClose();
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-slate-700/50" style={{ backgroundColor: '#0a0e1a' }}>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md"></div>
              <div className="relative bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 p-4 rounded-full">
                <Gift className="h-12 w-12 text-blue-400" />
              </div>
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold text-white">
            Welcome to ElevenWin!
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2 text-slate-400">
            Start your journey with a special welcome bonus
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-xl p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-blue-400" />
              <span className="text-base font-medium text-blue-300">Welcome Bonus</span>
              <Sparkles className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-6xl font-bold text-green-400 mb-3">
              $2.00
            </div>
            <p className="text-base text-slate-300">
              Free credits to start playing!
            </p>
          </div>

          <Button 
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full font-semibold py-6 text-lg transition-all duration-200"
          >
            {isClaiming ? "Claiming..." : "Claim $2.00 Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
