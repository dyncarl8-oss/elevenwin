import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, Trophy, AlertCircle, Wallet, Percent, Users } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (entryFee: number) => void;
  currentBalance: number;
  isLoading?: boolean;
}

const PLATFORM_FEE_PERCENT = 15;

const PRESET_AMOUNTS = [100, 500, 1000, 2500]; // in cents: $1, $5, $10, $25

export default function CreateRoomModal({
  isOpen,
  onClose,
  onCreateRoom,
  currentBalance,
  isLoading = false,
}: CreateRoomModalProps) {
  const [entryFee, setEntryFee] = useState<number>(100); // Default $1.00 (100 cents)
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEntryFee(100);
      setCustomAmount("");
      setUseCustom(false);
      setError(null);
    }
  }, [isOpen]);

  const handlePresetClick = (amount: number) => {
    setEntryFee(amount);
    setUseCustom(false);
    setCustomAmount("");
    setError(null);
  };

  const handleCustomChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    
    setCustomAmount(cleaned);
    setUseCustom(true);
    
    const dollars = parseFloat(cleaned) || 0;
    const cents = Math.round(dollars * 100);
    setEntryFee(cents);
    setError(null);
  };

  const getSelectedFee = () => {
    return entryFee;
  };

  const calculatePot = () => {
    return getSelectedFee() * 2;
  };

  const calculatePlatformFee = () => {
    return Math.floor(calculatePot() * (PLATFORM_FEE_PERCENT / 100));
  };

  const calculateWinnings = () => {
    return calculatePot() - calculatePlatformFee();
  };

  const calculateProfit = () => {
    return calculateWinnings() - getSelectedFee();
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const canCreateRoom = () => {
    const fee = getSelectedFee();
    return fee > 0 && fee >= 100 && currentBalance >= fee && !isLoading;
  };

  const handleCreate = () => {
    const fee = getSelectedFee();
    
    if (fee < 100) {
      setError("Minimum entry fee is $1.00");
      return;
    }
    
    if (currentBalance < fee) {
      setError("Insufficient balance");
      return;
    }
    
    onCreateRoom(fee);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative w-full max-w-md max-h-[95vh] overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl my-auto"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create Wager Room</h2>
                <p className="text-xs text-gray-400">Set your entry fee to play</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">Your Balance</span>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                {formatCurrency(currentBalance)}
              </span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Entry Fee
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handlePresetClick(amount)}
                    disabled={currentBalance < amount}
                    className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                      entryFee === amount && !useCustom
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                        : currentBalance < amount
                        ? "bg-white/5 text-gray-600 cursor-not-allowed"
                        : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                    }`}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  $
                </div>
                <input
                  type="text"
                  value={customAmount}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="Custom amount"
                  className={`w-full pl-8 pr-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all ${
                    useCustom
                      ? "border-violet-500/50"
                      : "border-white/10"
                  }`}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>Total Pot (2 players)</span>
                </div>
                <span className="font-semibold text-white">
                  {formatCurrency(calculatePot())}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Percent className="w-4 h-4" />
                  <span>Platform Fee ({PLATFORM_FEE_PERCENT}%)</span>
                </div>
                <span className="font-semibold text-red-400">
                  -{formatCurrency(calculatePlatformFee())}
                </span>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Trophy className="w-5 h-5" />
                    <span className="font-semibold">If You Win</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-emerald-400">
                      {formatCurrency(calculateWinnings())}
                    </span>
                    <p className="text-xs text-emerald-400/70">
                      +{formatCurrency(calculateProfit())} profit
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {currentBalance < getSelectedFee() && getSelectedFee() > 0 && !error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  You need {formatCurrency(getSelectedFee() - currentBalance)} more to create this room
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                className="py-3 rounded-xl font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreateRoom()}
                className="py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-emerald-500/25"
              >
                {isLoading ? "Creating..." : "Create Room"}
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">
              Entry fee deducted on creation. Refunded if no opponent joins.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
