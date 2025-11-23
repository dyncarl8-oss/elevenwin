import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Dice1, Wallet, Plus } from "lucide-react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";

interface DiceResult {
  rolledNumber: number;
  isWin: boolean;
  multiplier: number;
  winAmount: number;
  newBalance: string;
}

const API_BASE_URL = "";

async function playDice(betAmount: number, targetNumber: number, rollType: string): Promise<DiceResult> {
  const response = await fetch(`${API_BASE_URL}/api/games/dice/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ betAmount, targetNumber, rollType }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to play Dice");
  }

  return response.json();
}

export default function DiceGame({ onBack }: { onBack: () => void }) {
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [targetNumber, setTargetNumber] = useState<number>(50);
  const [rollType, setRollType] = useState<"over" | "under">("over");
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [displayNumber, setDisplayNumber] = useState<number>(50);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useWhopUser();
  const audioContextRef = useRef<AudioContext | null>(null);
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();

  const betOptions = [0.25, 0.50, 1.00, 2.00, 5.00];

  // Calculate multiplier and win chance for display
  const winChance = rollType === "under" ? targetNumber : (100 - targetNumber);
  const potentialMultiplier = ((100 / winChance) * 0.96).toFixed(2);

  const initAudioContext = () => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playRollSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 200 + Math.random() * 100;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  };

  const playWinSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator1.frequency.value = 523.25;
    oscillator2.frequency.value = 659.25;
    oscillator1.type = 'sine';
    oscillator2.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    oscillator1.start(ctx.currentTime);
    oscillator2.start(ctx.currentTime);
    oscillator1.stop(ctx.currentTime + 0.5);
    oscillator2.stop(ctx.currentTime + 0.5);
  };

  const playLoseSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  };

  const playMutation = useMutation({
    mutationFn: () => playDice(selectedBet, targetNumber, rollType),
    onSuccess: (data) => {
      setLastResult(data);
      animateRoll(data.rolledNumber, data.isWin);
      
      // Invalidate queries immediately so balance updates even if user navigates away
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", user.id] });
      }
      
      setTimeout(() => {
        if (data.isWin) {
          const profit = data.winAmount - selectedBet;
          let winTitle = "";
          let winDescription = "";
          
          if (data.multiplier >= 10) {
            winTitle = `🎰💰 JACKPOT! $${data.winAmount.toFixed(2)}! 💰🎰`;
            winDescription = `🔥 Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x INSANE multiplier! +$${profit.toFixed(2)} profit! 🔥`;
          } else if (data.multiplier >= 5) {
            winTitle = `🎉💎 HUGE WIN! $${data.winAmount.toFixed(2)}! 💎🎉`;
            winDescription = `✨ Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x multiplier! +$${profit.toFixed(2)} profit! ✨`;
          } else if (data.multiplier >= 3) {
            winTitle = `🎊 BIG WIN! $${data.winAmount.toFixed(2)}! 🎊`;
            winDescription = `⭐ Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x multiplier! +$${profit.toFixed(2)} profit! ⭐`;
          } else {
            winTitle = `🎉 Winner! $${data.winAmount.toFixed(2)}! 🎉`;
            winDescription = `💫 Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x multiplier! +$${profit.toFixed(2)} profit! 💫`;
          }
          
          toast({
            title: winTitle,
            description: winDescription,
            variant: "success",
          });
        } else {
          toast({
            title: "You Lost",
            description: `Rolled ${data.rolledNumber}`,
            variant: "destructive",
          });
        }
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsRolling(false);
    },
  });

  const animateRoll = async (finalNumber: number, isWin: boolean) => {
    setIsRolling(true);
    
    // Animate rolling numbers with sound
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 80));
      setDisplayNumber(Math.floor(Math.random() * 100) + 1);
      playRollSound();
    }
    
    // Show final number
    setDisplayNumber(finalNumber);
    
    // Play win or lose sound
    if (isWin) {
      playWinSound();
    } else {
      playLoseSound();
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRolling(false);
  };

  const handlePlay = () => {
    if (isRolling) return;
    initAudioContext();
    setLastResult(null);
    playMutation.mutate();
  };

  const handleAddFunds = async (amount: number) => {
    try {
      setPendingAmount(amount);
      await makePayment({
        amount,
        description: "ElevenWin",
        metadata: { type: "game_credits" },
      });
      setShowAddFunds(false);
      toast({
        title: "Funds added successfully!",
        description: `$${amount} has been added to your account.`,
      });
    } catch (error) {
      // Error is already handled by useWhopPayments hook
    } finally {
      setPendingAmount(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-3">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <Button 
            onClick={onBack} 
            variant="outline" 
            className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 text-sm py-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Lobby
          </Button>
          
          {user && (
            <div>
              {showAddFunds ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Balance</span>
                      <span className="text-base font-bold text-emerald-400">${parseFloat(user.balance).toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAddFunds(5)}
                    disabled={(pendingAmount === 5) || !isRealPaymentsAvailable}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50" 
                  >
                    {pendingAmount === 5 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$5"}
                  </button>
                  <button 
                    onClick={() => handleAddFunds(10)}
                    disabled={(pendingAmount === 10) || !isRealPaymentsAvailable}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50" 
                  >
                    {pendingAmount === 10 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$10"}
                  </button>
                  <button 
                    onClick={() => handleAddFunds(25)}
                    disabled={(pendingAmount === 25) || !isRealPaymentsAvailable}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50" 
                  >
                    {pendingAmount === 25 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$25"}
                  </button>
                  <button 
                    onClick={() => handleAddFunds(50)}
                    disabled={(pendingAmount === 50) || !isRealPaymentsAvailable}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50" 
                  >
                    {pendingAmount === 50 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$50"}
                  </button>
                  <button 
                    onClick={() => setShowAddFunds(false)}
                    className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-sm font-semibold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Balance</span>
                    <span className="text-base font-bold text-emerald-400">${parseFloat(user.balance).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => setShowAddFunds(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-all duration-200 ml-2" 
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Game Area */}
          <div className="md:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-3 border-b border-slate-700">
                <CardTitle className="text-lg font-semibold text-white">
                  Dice Roll
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 py-3">
                {/* Dice Display */}
                <div className="flex items-center justify-center py-8">
                  <div className={`relative ${isRolling ? 'animate-spin' : ''}`}>
                    <div className="w-32 h-32 bg-emerald-600 rounded-2xl flex items-center justify-center border-4 border-emerald-500">
                      <span className="text-5xl font-bold text-white">
                        {displayNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Number Control */}
                <div className="space-y-2 bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-bold">Target Number:</span>
                    <span className="text-2xl font-bold text-emerald-400">{targetNumber}</span>
                  </div>
                  <Slider
                    value={[targetNumber]}
                    onValueChange={(val) => setTargetNumber(val[0])}
                    min={1}
                    max={99}
                    step={1}
                    disabled={isRolling}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>1</span>
                    <span>50</span>
                    <span>99</span>
                  </div>
                </div>

                {/* Roll Type Selection */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => setRollType("under")}
                    disabled={isRolling}
                    variant={rollType === "under" ? "default" : "outline"}
                    className={`flex-1 py-4 text-sm font-bold ${rollType === "under" ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                  >
                    Roll UNDER {targetNumber}
                  </Button>
                  <Button
                    onClick={() => setRollType("over")}
                    disabled={isRolling}
                    variant={rollType === "over" ? "default" : "outline"}
                    className={`flex-1 py-4 text-sm font-bold ${rollType === "over" ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                  >
                    Roll OVER {targetNumber}
                  </Button>
                </div>

                {/* Win Chance & Multiplier Display */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700">
                  <div>
                    <div className="text-slate-400 text-xs font-semibold">Win Chance</div>
                    <div className="text-2xl font-bold text-emerald-400">{winChance}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs font-semibold">Multiplier</div>
                    <div className="text-2xl font-bold text-emerald-400">{potentialMultiplier}x</div>
                  </div>
                </div>

                {/* Last Result */}
                {lastResult && !isRolling && (
                  <div className={`p-4 rounded-xl border-2 ${lastResult.isWin ? 'bg-emerald-900 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}>
                    <div className="text-center">
                      <div className="text-xs text-slate-300 font-semibold">Last Roll</div>
                      <div className="text-2xl font-bold mt-1">
                        {lastResult.isWin ? (
                          <span className="text-emerald-400">WON ${lastResult.winAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">LOST</span>
                        )}
                      </div>
                      <div className="text-slate-400 text-sm mt-0.5 font-semibold">Rolled {lastResult.rolledNumber}</div>
                    </div>
                  </div>
                )}

                {/* Play Button */}
                <Button
                  onClick={handlePlay}
                  disabled={isRolling || playMutation.isPending}
                  className="w-full py-5 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isRolling || playMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Rolling...
                    </>
                  ) : (
                    <>
                      <Dice1 className="w-5 h-5 mr-2" />
                      Roll Dice - ${selectedBet.toFixed(2)}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Bet Amount Selection */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-3 border-b border-slate-700">
                <CardTitle className="text-base text-white font-semibold">Place Your Bet</CardTitle>
              </CardHeader>
              <CardContent className="py-3">
                <div className="grid grid-cols-2 gap-2">
                  {betOptions.map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => setSelectedBet(amount)}
                      disabled={isRolling}
                      variant={selectedBet === amount ? "default" : "outline"}
                      className={`py-3 text-sm font-bold ${selectedBet === amount ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`}
                    >
                      ${amount.toFixed(2)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How to Play */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-3 border-b border-slate-700">
                <CardTitle className="text-base text-white font-semibold">How to Play</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-200 space-y-2 py-3">
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <span>Choose your bet amount</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>Set a target number (1-99)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>Choose to roll OVER or UNDER</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">4.</span>
                  <span>Higher risk = Higher multiplier!</span>
                </p>
                <div className="pt-2 mt-2 border-t border-slate-700">
                  <p className="text-emerald-400 font-bold text-xs">96% RTP • 4% House Edge</p>
                  <p className="text-emerald-400 font-bold text-sm mt-1">Up to 96x Multiplier!</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
