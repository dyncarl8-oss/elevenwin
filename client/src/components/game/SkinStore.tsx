import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Coins, DollarSign, Check, X, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/stores/useGameStore";

interface SkinStoreProps {
  sessionToken: string | null;
  username: string;
  onClose: () => void;
  onWalletUpdate?: () => void;
}

interface Skin {
  skinId: string;
  name: string;
  category: "pistol" | "sniper" | "crosshair";
  rarity: "common" | "rare" | "epic" | "legendary";
  priceUsd: number;
  priceCoins: number;
  colors: {
    primary: string;
    secondary: string;
    emissive: string;
  };
  description?: string;
  priceFormatted: string;
}

interface InventoryItem {
  skinId: string;
  name: string;
  category: string;
  rarity: string;
  colors: {
    primary: string;
    secondary: string;
    emissive: string;
  };
  equipped: boolean;
}

type TabType = "store" | "inventory";

const CACHE_VERSION = "v3";
const skinImages: Record<string, string> = {
  "pistol_basic": `/images/pistol basic.png?${CACHE_VERSION}`,
  "sniper_basic": `/images/sniper basic.png?${CACHE_VERSION}`,
  "pistol_carbon_black": `/images/carbon black.png?${CACHE_VERSION}`,
  "pistol_gold_plated": `/images/golden plated.png?${CACHE_VERSION}`,
  "pistol_neon_pulse": `/images/neon pulse.png?${CACHE_VERSION}`,
  "pistol_dragon_fire": `/images/dragon fire.png?${CACHE_VERSION}`,
  "sniper_arctic_white": `/images/arctic white.png?${CACHE_VERSION}`,
  "sniper_blood_moon": `/images/blood moon.png?${CACHE_VERSION}`,
  "sniper_cyber_strike": `/images/cyber strike.png?${CACHE_VERSION}`,
  "sniper_void_reaper": `/images/void reaper.png?${CACHE_VERSION}`,
};

const rarityColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  common: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30", glow: "" },
  rare: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", glow: "shadow-blue-500/10" },
  epic: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", glow: "shadow-violet-500/10" },
  legendary: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", glow: "shadow-amber-500/20" },
};

export default function SkinStore({ sessionToken, username, onClose, onWalletUpdate }: SkinStoreProps) {
  const { equippedSkins, setEquippedSkins } = useGameStore();
  const [activeTab, setActiveTab] = useState<TabType>("store");
  const [skins, setSkins] = useState<Skin[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSkins();
    fetchInventory();
  }, [sessionToken]);

  const fetchSkins = async () => {
    try {
      const response = await fetch("/api/skins");
      if (response.ok) {
        const data = await response.json();
        setSkins(data.skins || []);
      }
    } catch (err) {
      console.error("Failed to fetch skins:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch("/api/skins/inventory", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setInventory(data.inventory || []);
      }
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    }
  };

  const handlePurchase = async (skinId: string, payWith: "usd" | "coins") => {
    if (!sessionToken) return;
    
    setPurchaseLoading(skinId);
    setError(null);
    
    try {
      const response = await fetch("/api/skins/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ skinId, payWith, username }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(`Successfully purchased!`);
        await fetchInventory();
        onWalletUpdate?.();
        setTimeout(() => setSuccessMessage(null), 2000);
      } else {
        setError(data.error || "Failed to purchase");
        setTimeout(() => setError(null), 2000);
      }
    } catch (err) {
      setError("Failed to purchase");
      setTimeout(() => setError(null), 2000);
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleEquip = async (skinId: string) => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch("/api/skins/equip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ skinId }),
      });
      
      if (response.ok) {
        await fetchInventory();
        
        const item = inventory.find(i => i.skinId === skinId);
        if (item) {
          const category = item.category as "sniper" | "pistol" | "crosshair";
          setEquippedSkins({
            ...equippedSkins,
            [category]: skinId,
          });
          console.log(`Equipped ${category} skin:`, skinId);
        }
        
        setSuccessMessage("Equipped!");
        setTimeout(() => setSuccessMessage(null), 1500);
      }
    } catch (err) {
      console.error("Failed to equip skin:", err);
    }
  };

  const isOwned = (skinId: string) => {
    return inventory.some(item => item.skinId === skinId);
  };

  const filteredSkins = skins.filter(skin => 
    selectedCategory === "all" || skin.category === selectedCategory
  );

  const filteredInventory = inventory.filter(item =>
    selectedCategory === "all" || item.category === selectedCategory
  );

  const categories = ["all", "pistol", "sniper", "crosshair"];

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
        className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden bg-[#0c0c14] border border-white/10"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Weapon Store</h2>
              <p className="text-sm text-gray-500">Customize your arsenal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-2xl hover:bg-white/5 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-white/5">
          {[
            { id: "store", label: "Store", icon: ShoppingBag },
            { id: "inventory", label: `Inventory (${inventory.length})`, icon: Package },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 py-4 text-base font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? "text-white bg-white/5 border-b-2 border-violet-500"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 p-4 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mb-3 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/25"
            >
              <p className="text-emerald-400 text-sm text-center flex items-center justify-center gap-2 font-semibold">
                <Check className="w-5 h-5" /> {successMessage}
              </p>
            </motion.div>
          )}
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mb-3 p-4 rounded-2xl bg-red-500/15 border border-red-500/25"
            >
              <p className="text-red-400 text-sm text-center font-semibold">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 pb-4 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="animate-pulse rounded-2xl p-4 bg-white/[0.02]">
                  <div className="h-28 bg-white/5 rounded-xl mb-3"></div>
                  <div className="h-4 bg-white/5 rounded-lg w-2/3 mb-2"></div>
                  <div className="h-3 bg-white/5 rounded-lg w-1/2"></div>
                </div>
              ))}
            </div>
          ) : activeTab === "store" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSkins.map(skin => {
                const owned = isOwned(skin.skinId);
                const rarity = rarityColors[skin.rarity] || rarityColors.common;
                const isPurchasing = purchaseLoading === skin.skinId;
                
                return (
                  <motion.div
                    key={skin.skinId}
                    className={`rounded-2xl p-4 border ${rarity.border} ${rarity.bg} shadow-lg ${rarity.glow}`}
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="h-28 rounded-xl mb-3 flex items-center justify-center bg-black/40">
                      {skinImages[skin.skinId] ? (
                        <img 
                          src={skinImages[skin.skinId]} 
                          alt={skin.name}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-4xl opacity-50">
                          {skin.category === "pistol" ? "🔫" : skin.category === "sniper" ? "🎯" : "⊕"}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-white font-bold text-base truncate">{skin.name}</h3>
                    <p className={`text-sm ${rarity.text} capitalize mb-3`}>
                      {skin.rarity} {skin.category}
                    </p>
                    
                    {owned ? (
                      <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/15 text-emerald-400">
                        <Check className="w-5 h-5" />
                        <span className="text-sm font-bold">Owned</span>
                      </div>
                    ) : skin.priceUsd === 0 ? (
                      <div className="flex items-center justify-center py-3 rounded-2xl bg-gray-500/15 text-gray-400">
                        <span className="text-sm font-bold">Free</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePurchase(skin.skinId, "usd")}
                          disabled={isPurchasing}
                          className="flex-1 py-3 rounded-2xl text-sm font-bold bg-emerald-500 text-white disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                        >
                          <DollarSign className="w-4 h-4" />
                          {skin.priceFormatted}
                        </button>
                        <button
                          onClick={() => handlePurchase(skin.skinId, "coins")}
                          disabled={isPurchasing}
                          className="flex-1 py-3 rounded-2xl text-sm font-bold bg-amber-500 text-white disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                        >
                          <Coins className="w-4 h-4" />
                          {skin.priceCoins}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              
              {filteredSkins.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-400 font-semibold text-lg">No skins available</p>
                  <p className="text-gray-600 text-sm mt-1">Check back later!</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredInventory.map(item => {
                const rarity = rarityColors[item.rarity] || rarityColors.common;
                
                return (
                  <motion.div
                    key={item.skinId}
                    className={`rounded-2xl p-4 border ${rarity.border} ${rarity.bg} shadow-lg ${rarity.glow}`}
                    whileHover={{ scale: 1.02, y: -2 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="h-28 rounded-xl mb-3 flex items-center justify-center bg-black/40">
                      {skinImages[item.skinId] ? (
                        <img 
                          src={skinImages[item.skinId]} 
                          alt={item.name}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-4xl opacity-50">
                          {item.category === "pistol" ? "🔫" : item.category === "sniper" ? "🎯" : "⊕"}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-white font-bold text-base truncate">{item.name}</h3>
                    <p className={`text-sm ${rarity.text} capitalize mb-3`}>
                      {item.rarity} {item.category}
                    </p>
                    
                    {item.equipped ? (
                      <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/15 text-emerald-400">
                        <Check className="w-5 h-5" />
                        <span className="text-sm font-bold">Equipped</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEquip(item.skinId)}
                        className="w-full py-3 rounded-2xl text-sm font-bold bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                      >
                        Equip
                      </button>
                    )}
                  </motion.div>
                );
              })}
              
              {filteredInventory.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Package className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-400 font-semibold text-lg">Inventory empty</p>
                  <p className="text-gray-600 text-sm mt-1">Purchase skins from the store!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
