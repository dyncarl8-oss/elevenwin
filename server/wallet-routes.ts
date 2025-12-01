import { Router, Request, Response } from "express";
import { verifySessionToken } from "./jwt";
import { whopClient, getCompanyIdFromExperience, verifyPayment } from "./whop";
import { sendWithdrawalNotification } from "./email";
import {
  getOrCreateWallet,
  updateWalletBalance,
  updateWalletCoins,
  createTransaction,
  getUserTransactions,
  getAllSkins,
  getSkinById,
  getUserSkins,
  purchaseSkin,
  equipSkin,
  unequipSkin,
  getEquippedSkins,
  getLeaderboard,
  getOrCreatePlayerStats,
  getPlayerStatsCollection,
  getWalletsCollection,
  getUserSkinsCollection,
  getTransactionsCollection,
  giveDefaultSkins,
  type LeaderboardCategory,
} from "./mongodb";

const router = Router();

// Middleware to verify session and extract userId
async function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace("Bearer ", "") || req.headers["x-session-token"] as string;
  
  if (!sessionToken) {
    return res.status(401).json({ error: "No session token provided" });
  }
  
  const decoded = verifySessionToken(sessionToken);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired session token" });
  }
  
  (req as any).userId = decoded.userId;
  (req as any).experienceId = decoded.experienceId;
  next();
}

// Get app config for client
router.get("/app-config", async (req: Request, res: Response) => {
  res.json({
    whopAppId: process.env.WHOP_APP_ID || "",
  });
});

// Get wallet balance
router.get("/wallet", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const username = req.query.username as string || "Player";
    
    const wallet = await getOrCreateWallet(userId, username);
    
    res.json({
      balance: wallet.balance,
      coins: wallet.coins,
      balanceFormatted: `$${(wallet.balance / 100).toFixed(2)}`,
    });
  } catch (error) {
    console.error("Error getting wallet:", error);
    res.status(500).json({ error: "Failed to get wallet" });
  }
});

// Create deposit checkout
const MAX_DEPOSIT_CENTS = 100000; // $1,000.00 maximum deposit

router.post("/wallet/deposit", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const experienceId = (req as any).experienceId;
    const { amount, username } = req.body; // amount in cents
    
    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Minimum deposit is $1.00" });
    }
    
    if (amount > MAX_DEPOSIT_CENTS) {
      return res.status(400).json({ error: `Maximum deposit is $${(MAX_DEPOSIT_CENTS / 100).toFixed(2)}` });
    }
    
    // Ensure wallet exists
    await getOrCreateWallet(userId, username || "Player");
    
    // Get the company ID from the experience (automatically derived)
    let companyId = process.env.WHOP_COMPANY_ID;
    
    if (!companyId && experienceId) {
      companyId = await getCompanyIdFromExperience(experienceId);
    }
    
    if (!companyId) {
      console.error("No company ID found for experience:", experienceId);
      return res.status(500).json({ error: "Payment configuration not set up" });
    }
    
    console.log(`[Deposit] Creating checkout for user ${userId}, company ${companyId}, amount $${(amount / 100).toFixed(2)}`);
    
    // Create Whop checkout configuration
    const checkoutConfig = await whopClient.checkoutConfigurations.create({
      plan: {
        company_id: companyId,
        initial_price: amount / 100, // Whop expects dollars
        plan_type: "one_time",
        currency: "usd",
      },
      metadata: {
        type: "deposit",
        user_id: userId,
        experience_id: experienceId,
        amount_cents: amount.toString(),
      },
    });
    
    const planId = checkoutConfig.plan?.id;
    
    console.log(`[Deposit] Checkout created: configId=${checkoutConfig.id}, planId=${planId}`);
    
    if (!planId) {
      console.error("[Deposit] No planId in checkout response:", JSON.stringify(checkoutConfig, null, 2));
      return res.status(500).json({ error: "Failed to create payment plan" });
    }
    
    // Create pending transaction
    await createTransaction({
      odellId: userId,
      type: "deposit",
      amount,
      currency: "usd",
      status: "pending",
      metadata: {
        checkoutConfigId: checkoutConfig.id,
        planId: planId,
        description: `Deposit $${(amount / 100).toFixed(2)}`,
      },
    });
    
    res.json({
      checkoutConfigId: checkoutConfig.id,
      planId: planId,
    });
  } catch (error) {
    console.error("Error creating deposit:", error);
    res.status(500).json({ error: "Failed to create deposit" });
  }
});

// Confirm deposit after successful in-app purchase
router.post("/wallet/deposit/confirm", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { receiptId, checkoutConfigId, username } = req.body;
    
    if (!receiptId || !checkoutConfigId) {
      return res.status(400).json({ error: "receiptId and checkoutConfigId required" });
    }
    
    // Check if already processed (prevent replay attacks) - do this first
    const transactions = getTransactionsCollection();
    const existingCompleted = await transactions.findOne({
      type: "deposit",
      status: "completed",
      "metadata.paymentId": receiptId,
    });
    
    if (existingCompleted) {
      console.warn(`[Deposit] Duplicate confirmation attempt for receiptId: ${receiptId}`);
      const wallet = await getOrCreateWallet(userId, username || "Player");
      return res.json({
        success: true,
        balance: wallet.balance,
        balanceFormatted: `$${(wallet.balance / 100).toFixed(2)}`,
      });
    }
    
    // Verify the payment with Whop API - CRITICAL SECURITY CHECK
    const paymentVerification = await verifyPayment(receiptId);
    
    if (!paymentVerification.valid) {
      console.error(`[Deposit] Payment verification failed for receiptId: ${receiptId}, status: ${paymentVerification.status}, error: ${paymentVerification.error}`);
      return res.status(400).json({ error: "Payment verification failed" });
    }
    
    // Verify the user ID matches (additional security)
    if (!paymentVerification.userId) {
      console.error(`[Deposit] Payment missing user ID for receiptId: ${receiptId}`);
      return res.status(400).json({ error: "Payment verification failed - missing user" });
    }
    
    if (paymentVerification.userId !== userId) {
      console.error(`[Deposit] User ID mismatch: expected ${userId}, got ${paymentVerification.userId}`);
      return res.status(400).json({ error: "Payment verification failed - user mismatch" });
    }
    
    // Find the pending transaction by checkoutConfigId
    const pendingTransaction = await transactions.findOne({
      odellId: userId,
      type: "deposit",
      status: "pending",
      "metadata.checkoutConfigId": checkoutConfigId,
    });
    
    if (!pendingTransaction) {
      console.error(`[Deposit] No pending transaction found for checkoutConfigId: ${checkoutConfigId}, userId: ${userId}`);
      return res.status(400).json({ error: "No pending deposit found" });
    }
    
    // Use the verified amount from Whop API (most secure) or fall back to pending transaction amount
    const verifiedAmount = paymentVerification.amountCents > 0 
      ? paymentVerification.amountCents 
      : pendingTransaction.amount;
    
    // Get or create wallet
    await getOrCreateWallet(userId, username || "Player");
    
    // Add balance using the verified amount
    const updated = await updateWalletBalance(userId, verifiedAmount, "add");
    if (!updated) {
      return res.status(500).json({ error: "Failed to update balance" });
    }
    
    // Update the pending transaction to completed
    await transactions.updateOne(
      { _id: pendingTransaction._id },
      { 
        $set: { 
          status: "completed",
          "metadata.paymentId": receiptId,
          amount: verifiedAmount, // Store the verified amount
        } 
      }
    );
    
    // Get updated wallet
    const updatedWallet = await getOrCreateWallet(userId, username || "Player");
    
    console.log(`[Deposit] User ${userId} deposited $${(verifiedAmount / 100).toFixed(2)} - Receipt: ${receiptId} - Verified with Whop API`);
    
    res.json({
      success: true,
      balance: updatedWallet.balance,
      balanceFormatted: `$${(updatedWallet.balance / 100).toFixed(2)}`,
    });
  } catch (error) {
    console.error("Error confirming deposit:", error);
    res.status(500).json({ error: "Failed to confirm deposit" });
  }
});

// Get transaction history
router.get("/wallet/transactions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const transactions = await getUserTransactions(userId, limit);
    
    res.json({
      transactions: transactions.map(t => ({
        id: t._id?.toString(),
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        description: t.metadata?.description || t.type,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error getting transactions:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

// Get all available skins
router.get("/skins", async (req: Request, res: Response) => {
  try {
    const skins = await getAllSkins();
    
    res.json({
      skins: skins.map(s => ({
        skinId: s.skinId,
        name: s.name,
        category: s.category,
        rarity: s.rarity,
        priceUsd: s.priceUsd,
        priceCoins: s.priceCoins,
        colors: s.colors,
        description: s.description,
        priceFormatted: `$${(s.priceUsd / 100).toFixed(2)}`,
      })),
    });
  } catch (error) {
    console.error("Error getting skins:", error);
    res.status(500).json({ error: "Failed to get skins" });
  }
});

// Get user's skin inventory
router.get("/skins/inventory", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Ensure user has default skins
    await giveDefaultSkins(userId);
    
    const userSkins = await getUserSkins(userId);
    const allSkins = await getAllSkins();
    
    // Map user skins with full skin details
    const inventory = userSkins.map(us => {
      const skinDetails = allSkins.find(s => s.skinId === us.skinId);
      return {
        skinId: us.skinId,
        name: skinDetails?.name,
        category: us.category,
        rarity: skinDetails?.rarity,
        colors: skinDetails?.colors,
        equipped: us.equipped,
        purchasedAt: us.purchasedAt,
      };
    });
    
    res.json({ inventory });
  } catch (error) {
    console.error("Error getting inventory:", error);
    res.status(500).json({ error: "Failed to get inventory" });
  }
});

// Get equipped skins
router.get("/skins/equipped", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    const equipped = await getEquippedSkins(userId);
    const allSkins = await getAllSkins();
    
    const result: { [key: string]: any } = {};
    
    equipped.forEach(eq => {
      const skinDetails = allSkins.find(s => s.skinId === eq.skinId);
      if (skinDetails) {
        result[eq.category] = {
          skinId: eq.skinId,
          name: skinDetails.name,
          colors: skinDetails.colors,
        };
      }
    });
    
    res.json({ equipped: result });
  } catch (error) {
    console.error("Error getting equipped skins:", error);
    res.status(500).json({ error: "Failed to get equipped skins" });
  }
});

// Purchase skin
router.post("/skins/purchase", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { skinId, payWith, username } = req.body; // payWith: "usd" | "coins"
    
    if (!skinId || !payWith) {
      return res.status(400).json({ error: "skinId and payWith required" });
    }
    
    // Get skin details
    const skin = await getSkinById(skinId);
    if (!skin) {
      return res.status(404).json({ error: "Skin not found" });
    }
    
    // Check if already owned
    const userSkins = await getUserSkins(userId);
    if (userSkins.find(us => us.skinId === skinId)) {
      return res.status(400).json({ error: "You already own this skin" });
    }
    
    // Get or create wallet
    const wallet = await getOrCreateWallet(userId, username || "Player");
    
    // Process payment
    let paymentAmount = 0;
    let paymentCurrency: "usd" | "coins" = "usd";
    
    if (payWith === "usd") {
      if (wallet.balance < skin.priceUsd) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      paymentAmount = skin.priceUsd;
      paymentCurrency = "usd";
      
      // Deduct balance
      const updated = await updateWalletBalance(userId, skin.priceUsd, "subtract");
      if (!updated) {
        return res.status(400).json({ error: "Failed to process payment" });
      }
      
      // Create transaction - if this fails, rollback
      try {
        await createTransaction({
          odellId: userId,
          type: "skin_purchase",
          amount: skin.priceUsd,
          currency: "usd",
          status: "completed",
          metadata: {
            skinId,
            description: `Purchased ${skin.name}`,
          },
        });
      } catch (txError) {
        console.error("Transaction failed, rolling back balance:", txError);
        await updateWalletBalance(userId, skin.priceUsd, "add");
        return res.status(500).json({ error: "Failed to process purchase, funds refunded" });
      }
      
    } else if (payWith === "coins") {
      if (wallet.coins < skin.priceCoins) {
        return res.status(400).json({ error: "Insufficient coins" });
      }
      
      paymentAmount = skin.priceCoins;
      paymentCurrency = "coins";
      
      // Deduct coins
      const updated = await updateWalletCoins(userId, skin.priceCoins, "subtract");
      if (!updated) {
        return res.status(400).json({ error: "Failed to process payment" });
      }
      
      // Create transaction - if this fails, rollback
      try {
        await createTransaction({
          odellId: userId,
          type: "skin_purchase",
          amount: skin.priceCoins,
          currency: "coins",
          status: "completed",
          metadata: {
            skinId,
            description: `Purchased ${skin.name} with coins`,
          },
        });
      } catch (txError) {
        console.error("Transaction failed, rolling back coins:", txError);
        await updateWalletCoins(userId, skin.priceCoins, "add");
        return res.status(500).json({ error: "Failed to process purchase, coins refunded" });
      }
    } else {
      return res.status(400).json({ error: "Invalid payment method" });
    }
    
    // Add skin to inventory - if this fails, rollback payment
    try {
      await purchaseSkin(userId, skinId, skin.category);
    } catch (skinError) {
      console.error("Failed to add skin to inventory, rolling back payment:", skinError);
      // Rollback the payment
      if (paymentCurrency === "usd") {
        await updateWalletBalance(userId, paymentAmount, "add");
      } else {
        await updateWalletCoins(userId, paymentAmount, "add");
      }
      return res.status(500).json({ error: "Failed to complete purchase, payment refunded" });
    }
    
    res.json({ 
      success: true, 
      message: `Successfully purchased ${skin.name}`,
      skinId,
    });
  } catch (error) {
    console.error("Error purchasing skin:", error);
    res.status(500).json({ error: "Failed to purchase skin" });
  }
});

// Equip skin
router.post("/skins/equip", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { skinId } = req.body;
    
    if (!skinId) {
      return res.status(400).json({ error: "skinId required" });
    }
    
    // Check if user owns the skin
    const userSkins = await getUserSkins(userId);
    const ownedSkin = userSkins.find(us => us.skinId === skinId);
    
    if (!ownedSkin) {
      return res.status(400).json({ error: "You don't own this skin" });
    }
    
    // Get skin details for category
    const skin = await getSkinById(skinId);
    if (!skin) {
      return res.status(404).json({ error: "Skin not found" });
    }
    
    // Equip the skin
    await equipSkin(userId, skinId, skin.category);
    
    res.json({ success: true, message: `Equipped ${skin.name}` });
  } catch (error) {
    console.error("Error equipping skin:", error);
    res.status(500).json({ error: "Failed to equip skin" });
  }
});

// Unequip skin
router.post("/skins/unequip", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { skinId } = req.body;
    
    if (!skinId) {
      return res.status(400).json({ error: "skinId required" });
    }
    
    await unequipSkin(userId, skinId);
    
    res.json({ success: true, message: "Skin unequipped" });
  } catch (error) {
    console.error("Error unequipping skin:", error);
    res.status(500).json({ error: "Failed to unequip skin" });
  }
});

// Get leaderboard
router.get("/leaderboard/:category", async (req: Request, res: Response) => {
  try {
    const category = req.params.category as LeaderboardCategory;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const validCategories: LeaderboardCategory[] = ["earnings", "wins", "kd", "streak", "coins"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }
    
    const leaderboard = await getLeaderboard(category, limit);
    
    res.json({
      category,
      entries: leaderboard.map((p, index) => ({
        rank: index + 1,
        odellId: p.odellId,
        odellname: p.odellname,
        profilePicture: p.profilePicture || null,
        value: category === "earnings" ? p.totalEarnings :
               category === "wins" ? p.totalWins :
               category === "kd" ? p.kdRatio :
               category === "streak" ? p.bestWinStreak :
               p.coinsEarned,
        stats: {
          wins: p.totalWins,
          losses: p.totalLosses,
          earnings: p.totalEarnings,
          kdRatio: p.kdRatio,
          matchesPlayed: p.matchesPlayed,
        },
      })),
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// Get player stats
router.get("/stats", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const username = req.query.username as string || "Player";
    
    const stats = await getOrCreatePlayerStats(userId, username);
    
    res.json({
      odellname: stats.odellname,
      profilePicture: stats.profilePicture || null,
      totalWins: stats.totalWins,
      totalLosses: stats.totalLosses,
      winRate: stats.matchesPlayed > 0 ? ((stats.totalWins / stats.matchesPlayed) * 100).toFixed(1) : "0.0",
      totalEarnings: stats.totalEarnings,
      earningsFormatted: `$${(stats.totalEarnings / 100).toFixed(2)}`,
      totalWagered: stats.totalWagered,
      currentWinStreak: stats.currentWinStreak,
      bestWinStreak: stats.bestWinStreak,
      totalKills: stats.totalKills,
      totalDeaths: stats.totalDeaths,
      kdRatio: stats.kdRatio.toFixed(2),
      soloWins: stats.soloWins,
      coinsEarned: stats.coinsEarned,
      matchesPlayed: stats.matchesPlayed,
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// Get player rank
router.get("/stats/rank", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const category = (req.query.category as LeaderboardCategory) || "earnings";
    
    const stats = getPlayerStatsCollection();
    
    let sortField: string;
    switch (category) {
      case "earnings": sortField = "totalEarnings"; break;
      case "wins": sortField = "totalWins"; break;
      case "kd": sortField = "kdRatio"; break;
      case "streak": sortField = "bestWinStreak"; break;
      case "coins": sortField = "coinsEarned"; break;
      default: sortField = "totalEarnings";
    }
    
    const playerStats = await stats.findOne({ odellId: userId });
    if (!playerStats) {
      return res.json({ rank: null, total: 0 });
    }
    
    const playerValue = (playerStats as any)[sortField];
    const rank = await stats.countDocuments({ [sortField]: { $gt: playerValue } }) + 1;
    const total = await stats.countDocuments();
    
    res.json({ rank, total, value: playerValue });
  } catch (error) {
    console.error("Error getting rank:", error);
    res.status(500).json({ error: "Failed to get rank" });
  }
});

// Admin: Cleanup Developer User entries
// Usage: GET /api/admin/cleanup-dev-users?key=arena-admin-2024
router.get("/admin/cleanup-dev-users", async (req: Request, res: Response) => {
  try {
    const adminKey = req.query.key as string;
    
    // Simple protection - require admin key
    if (adminKey !== "arena-admin-2024") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    const wallets = getWalletsCollection();
    const userSkins = getUserSkinsCollection();
    const transactions = getTransactionsCollection();
    const stats = getPlayerStatsCollection();
    
    // Find all Developer User wallets
    const devWallets = await wallets.find({ odellname: "Developer User" }).toArray();
    const devUserIds = devWallets.map(w => w.odellId);
    
    const results = {
      walletsDeleted: 0,
      skinsDeleted: 0,
      transactionsDeleted: 0,
      statsDeleted: 0,
      userIds: devUserIds,
    };
    
    if (devUserIds.length > 0) {
      // Delete wallets
      const walletResult = await wallets.deleteMany({ odellname: "Developer User" });
      results.walletsDeleted = walletResult.deletedCount;
      
      // Delete user skins for these users
      const skinsResult = await userSkins.deleteMany({ odellId: { $in: devUserIds } });
      results.skinsDeleted = skinsResult.deletedCount;
      
      // Delete transactions for these users
      const txResult = await transactions.deleteMany({ odellId: { $in: devUserIds } });
      results.transactionsDeleted = txResult.deletedCount;
      
      // Delete player stats for these users
      const statsResult = await stats.deleteMany({ odellname: "Developer User" });
      results.statsDeleted = statsResult.deletedCount;
    }
    
    console.log("[Admin] Cleaned up Developer User entries:", results);
    
    res.json({
      success: true,
      message: "Developer User entries cleaned up successfully",
      results,
    });
  } catch (error) {
    console.error("Error cleaning up dev users:", error);
    res.status(500).json({ error: "Failed to cleanup dev users" });
  }
});

// Request withdrawal
const MIN_WITHDRAWAL_CENTS = 500; // $5.00 minimum withdrawal
const MAX_WITHDRAWAL_CENTS = 100000; // $1,000.00 maximum withdrawal

router.post("/wallet/withdraw", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { amount, username, email } = req.body; // amount in cents
    
    if (!amount || amount < MIN_WITHDRAWAL_CENTS) {
      return res.status(400).json({ error: `Minimum withdrawal is $${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}` });
    }
    
    if (amount > MAX_WITHDRAWAL_CENTS) {
      return res.status(400).json({ error: `Maximum withdrawal is $${(MAX_WITHDRAWAL_CENTS / 100).toFixed(2)}` });
    }
    
    // Get wallet and check balance
    const wallet = await getOrCreateWallet(userId, username || "Player");
    
    if (wallet.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }
    
    // Deduct balance immediately
    const updated = await updateWalletBalance(userId, amount, "subtract");
    if (!updated) {
      return res.status(400).json({ error: "Failed to process withdrawal" });
    }
    
    // Create withdrawal transaction
    await createTransaction({
      odellId: userId,
      type: "withdrawal",
      amount,
      currency: "usd",
      status: "pending",
      metadata: {
        description: `Withdrawal request $${(amount / 100).toFixed(2)}`,
      },
    });
    
    // Send email notification to admin
    const emailResult = await sendWithdrawalNotification({
      userId,
      username: username || wallet.odellname || "Player",
      amount,
      userEmail: email,
    });
    
    if (!emailResult.success) {
      console.warn("[Withdrawal] Email notification failed but withdrawal processed:", emailResult.error);
    }
    
    console.log(`[Withdrawal] User ${userId} requested withdrawal of $${(amount / 100).toFixed(2)}`);
    
    // Get updated wallet
    const updatedWallet = await getOrCreateWallet(userId, username || "Player");
    
    res.json({
      success: true,
      message: "Withdrawal request submitted successfully. You will be paid within 24-48 hours.",
      balance: updatedWallet.balance,
      balanceFormatted: `$${(updatedWallet.balance / 100).toFixed(2)}`,
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    res.status(500).json({ error: "Failed to process withdrawal request" });
  }
});

export default router;
