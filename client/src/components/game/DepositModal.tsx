import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, Plus, Loader2, CheckCircle, AlertCircle, Wallet } from "lucide-react";
import { createSdk } from "@whop/iframe";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sessionToken: string | null;
  username: string;
}

const PRESET_AMOUNTS = [
  { value: 500, label: "$5.00" },
  { value: 1000, label: "$10.00" },
  { value: 2500, label: "$25.00" },
  { value: 5000, label: "$50.00" },
];

type DepositStatus = "idle" | "creating" | "processing" | "success" | "error";

let cachedAppId: string | null = null;

export default function DepositModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  sessionToken,
  username 
}: DepositModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [showCustom, setShowCustom] = useState(false);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const getAppId = async (): Promise<string> => {
    if (cachedAppId) return cachedAppId;
    try {
      const response = await fetch("/api/app-config");
      if (response.ok) {
        const data = await response.json();
        cachedAppId = data.whopAppId || "";
        return cachedAppId;
      }
    } catch (err) {
      console.error("Failed to fetch app config:", err);
    }
    return "";
  };

  const handleDeposit = useCallback(async () => {
    if (!sessionToken) {
      setError("Not authenticated");
      return;
    }

    const amount = showCustom ? Math.round(parseFloat(customAmount) * 100) : selectedAmount;
    
    if (!amount || amount < 100) {
      setError("Minimum deposit is $1.00");
      return;
    }

    if (amount > 100000) {
      setError("Maximum deposit is $1,000.00");
      return;
    }

    setStatus("creating");
    setError(null);

    try {
      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ amount, username }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout");
      }

      const { checkoutConfigId, planId } = await response.json();

      setStatus("processing");

      const appId = await getAppId();
      const iframeSdk = createSdk({
        appId,
      });

      const result = await iframeSdk.inAppPurchase({
        planId,
        id: checkoutConfigId,
      });

      if (result.status === "ok") {
        const confirmResponse = await fetch("/api/wallet/deposit/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            receiptId: result.data.receipt_id,
            checkoutConfigId,
            username,
          }),
        });

        if (!confirmResponse.ok) {
          const data = await confirmResponse.json();
          throw new Error(data.error || "Failed to confirm deposit");
        }

        setStatus("success");
        
        setTimeout(() => {
          onSuccess();
          onClose();
          setStatus("idle");
          setSelectedAmount(1000);
          setShowCustom(false);
          setCustomAmount("");
        }, 1500);
      } else {
        setError("Payment was cancelled or failed");
        setStatus("idle");
      }
    } catch (err: any) {
      console.error("Deposit error:", err);
      setError(err.message || "Failed to process deposit");
      setStatus("idle");
    }
  }, [sessionToken, selectedAmount, customAmount, showCustom, username, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    if (status === "creating" || status === "processing") return;
    onClose();
    setStatus("idle");
    setError(null);
    setSelectedAmount(1000);
    setShowCustom(false);
    setCustomAmount("");
  }, [status, onClose]);

  const displayAmount = showCustom 
    ? (parseFloat(customAmount) || 0).toFixed(2)
    : (selectedAmount / 100).toFixed(2);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="w-full max-w-md bg-[#0f0f1a] rounded-3xl border border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-white font-bold text-xl">Add Funds</h2>
              </div>
              <button
                onClick={handleClose}
                disabled={status === "creating" || status === "processing"}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {status === "success" ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2">Deposit Successful!</h3>
                  <p className="text-gray-400">
                    ${displayAmount} has been added to your balance
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="inline-flex items-baseline gap-1">
                      <span className="text-gray-400 text-2xl">$</span>
                      <span className="text-white font-bold text-5xl">{displayAmount}</span>
                    </div>
                  </div>

                  {!showCustom ? (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => setSelectedAmount(preset.value)}
                          disabled={status !== "idle"}
                          className={`py-4 rounded-2xl font-bold text-lg transition-all ${
                            selectedAmount === preset.value
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                          } disabled:opacity-50`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="Enter amount"
                          min="1"
                          max="1000"
                          step="0.01"
                          disabled={status !== "idle"}
                          className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-lg font-bold placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                        />
                      </div>
                      <p className="text-gray-500 text-xs mt-2 text-center">
                        Min: $1.00 • Max: $1,000.00
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowCustom(!showCustom);
                      if (!showCustom) {
                        setCustomAmount("");
                      }
                    }}
                    disabled={status !== "idle"}
                    className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {showCustom ? "Use preset amounts" : "Enter custom amount"}
                  </button>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 mt-4 rounded-xl bg-red-500/10 border border-red-500/20"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-red-400 text-sm">{error}</span>
                    </motion.div>
                  )}

                  <button
                    onClick={handleDeposit}
                    disabled={status !== "idle" || (showCustom && (!customAmount || parseFloat(customAmount) < 1))}
                    className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {status === "creating" || status === "processing" ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {status === "creating" ? "Creating checkout..." : "Processing payment..."}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Add ${displayAmount}
                      </span>
                    )}
                  </button>

                  <p className="text-center text-gray-500 text-xs mt-4">
                    Secure payment powered by Whop
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
