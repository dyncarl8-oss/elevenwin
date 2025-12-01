import { MongoClient, Db, Collection, ObjectId } from "mongodb";

// MongoDB connection
let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "arena_shooter";

// Types
export interface Wallet {
  _id?: ObjectId;
  odellId: string;
  odellname: string;
  balance: number; // In cents (USD)
  coins: number; // In-game currency
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  _id?: ObjectId;
  odellId: string;
  type: "deposit" | "withdrawal" | "wager_entry" | "wager_win" | "wager_refund" | "skin_purchase" | "coin_earn";
  amount: number;
  currency: "usd" | "coins";
  status: "pending" | "completed" | "failed";
  metadata?: {
    roomId?: string;
    paymentId?: string;
    skinId?: string;
    matchId?: string;
    checkoutConfigId?: string;
    description?: string;
    prizePool?: number;
    platformFee?: number;
  };
  createdAt: Date;
}

export interface Skin {
  _id?: ObjectId;
  skinId: string;
  name: string;
  category: "pistol" | "sniper" | "crosshair";
  rarity: "common" | "rare" | "epic" | "legendary";
  priceUsd: number; // In cents
  priceCoins: number;
  colors: {
    primary: string;
    secondary: string;
    emissive: string;
  };
  description?: string;
}

export interface UserSkin {
  _id?: ObjectId;
  odellId: string;
  skinId: string;
  category: "pistol" | "sniper" | "crosshair";
  equipped: boolean;
  purchasedAt: Date;
}

export interface PlayerStats {
  _id?: ObjectId;
  odellId: string;
  odellname: string;
  profilePicture?: string | null;
  totalWins: number;
  totalLosses: number;
  totalEarnings: number; // In cents
  totalWagered: number; // In cents
  currentWinStreak: number;
  bestWinStreak: number;
  totalKills: number;
  totalDeaths: number;
  kdRatio: number;
  soloWins: number;
  coinsEarned: number;
  matchesPlayed: number;
  lastMatchAt: Date;
  updatedAt: Date;
}

export interface Match {
  _id?: ObjectId;
  matchId: string;
  roomId: string;
  experienceId: string;
  type: "free" | "wager" | "solo";
  entryFee: number; // In cents, 0 for free/solo
  prizePool: number; // In cents
  platformFee: number; // In cents (15%)
  winnerId: string | null;
  loserId: string | null;
  players: Array<{
    odellId: string;
    odellname: string;
    odells: number;
    deaths: number;
    damageDealt: number;
  }>;
  duration: number; // In seconds
  createdAt: Date;
  endedAt: Date;
}

export interface MobileNotification {
  _id?: ObjectId;
  odellId: string;
  odellname: string;
  profilePicture?: string | null;
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
    deviceFingerprint?: string;
  };
  createdAt: Date;
}

// Connect to MongoDB
export async function connectMongoDB(): Promise<Db> {
  if (db) return db;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("Connected to MongoDB");
    
    // Create indexes
    await createIndexes();
    
    // Seed initial skins data
    await seedSkins();
    
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

// Create indexes for better query performance
async function createIndexes(): Promise<void> {
  if (!db) return;
  
  try {
    // Wallets - unique userId
    await db.collection("wallets").createIndex({ odellId: 1 }, { unique: true });
    
    // Transactions - userId for history queries
    await db.collection("transactions").createIndex({ odellId: 1, createdAt: -1 });
    
    // Skins - unique skinId
    await db.collection("skins").createIndex({ skinId: 1 }, { unique: true });
    
    // User skins - compound for inventory lookup
    await db.collection("user_skins").createIndex({ odellId: 1, skinId: 1 }, { unique: true });
    await db.collection("user_skins").createIndex({ odellId: 1, category: 1, equipped: 1 });
    
    // Player stats - userId unique, plus ranking indexes
    await db.collection("player_stats").createIndex({ odellId: 1 }, { unique: true });
    await db.collection("player_stats").createIndex({ totalEarnings: -1 });
    await db.collection("player_stats").createIndex({ totalWins: -1 });
    await db.collection("player_stats").createIndex({ kdRatio: -1 });
    await db.collection("player_stats").createIndex({ currentWinStreak: -1 });
    await db.collection("player_stats").createIndex({ coinsEarned: -1 });
    
    // Matches - for history
    await db.collection("matches").createIndex({ matchId: 1 }, { unique: true });
    await db.collection("matches").createIndex({ "players.odellId": 1, createdAt: -1 });
    
    // Mobile notifications - unique per user
    await db.collection("mobile_notifications").createIndex({ odellId: 1 }, { unique: true });
    
    console.log("MongoDB indexes created");
  } catch (error) {
    console.error("Error creating indexes:", error);
  }
}

// Seed initial skins
async function seedSkins(): Promise<void> {
  if (!db) return;
  
  const skinsCollection = db.collection<Skin>("skins");
  
  // Always ensure basic skins exist
  const basicPistol = await skinsCollection.findOne({ skinId: "pistol_basic" });
  const basicSniper = await skinsCollection.findOne({ skinId: "sniper_basic" });
  
  if (!basicPistol) {
    await skinsCollection.insertOne({
      skinId: "pistol_basic",
      name: "Basic Pistol",
      category: "pistol",
      rarity: "common",
      priceUsd: 0,
      priceCoins: 0,
      colors: { primary: "#555555", secondary: "#333333", emissive: "#444444" },
      description: "Standard issue pistol"
    });
    console.log("Added basic pistol skin");
  }
  
  if (!basicSniper) {
    await skinsCollection.insertOne({
      skinId: "sniper_basic",
      name: "Basic Sniper",
      category: "sniper",
      rarity: "common",
      priceUsd: 0,
      priceCoins: 0,
      colors: { primary: "#555555", secondary: "#333333", emissive: "#444444" },
      description: "Standard issue sniper rifle"
    });
    console.log("Added basic sniper skin");
  }
  
  const existingCount = await skinsCollection.countDocuments();
  
  if (existingCount > 2) {
    console.log("Skins already seeded");
    return;
  }
  
  const initialSkins: Skin[] = [
    // Basic skins (free defaults)
    {
      skinId: "pistol_basic",
      name: "Basic Pistol",
      category: "pistol",
      rarity: "common",
      priceUsd: 0,
      priceCoins: 0,
      colors: { primary: "#555555", secondary: "#333333", emissive: "#444444" },
      description: "Standard issue pistol"
    },
    {
      skinId: "sniper_basic",
      name: "Basic Sniper",
      category: "sniper",
      rarity: "common",
      priceUsd: 0,
      priceCoins: 0,
      colors: { primary: "#555555", secondary: "#333333", emissive: "#444444" },
      description: "Standard issue sniper rifle"
    },
    // Pistol skins
    {
      skinId: "pistol_carbon_black",
      name: "Carbon Black",
      category: "pistol",
      rarity: "common",
      priceUsd: 100, // $1
      priceCoins: 500,
      colors: { primary: "#1a1a1a", secondary: "#333333", emissive: "#000000" },
      description: "Sleek carbon fiber finish"
    },
    {
      skinId: "pistol_gold_plated",
      name: "Gold Plated",
      category: "pistol",
      rarity: "rare",
      priceUsd: 300, // $3
      priceCoins: 1500,
      colors: { primary: "#ffd700", secondary: "#b8860b", emissive: "#ff8c00" },
      description: "Luxurious gold finish"
    },
    {
      skinId: "pistol_neon_pulse",
      name: "Neon Pulse",
      category: "pistol",
      rarity: "epic",
      priceUsd: 500, // $5
      priceCoins: 3000,
      colors: { primary: "#0ff", secondary: "#0a0a0a", emissive: "#00ffff" },
      description: "Cyberpunk neon aesthetic"
    },
    {
      skinId: "pistol_dragon_fire",
      name: "Dragon Fire",
      category: "pistol",
      rarity: "legendary",
      priceUsd: 1000, // $10
      priceCoins: 6000,
      colors: { primary: "#ff4500", secondary: "#8b0000", emissive: "#ff6600" },
      description: "Flames of the ancient dragon"
    },
    // Sniper skins
    {
      skinId: "sniper_arctic_white",
      name: "Arctic White",
      category: "sniper",
      rarity: "common",
      priceUsd: 150, // $1.50
      priceCoins: 750,
      colors: { primary: "#f0f0f0", secondary: "#d0d0d0", emissive: "#ffffff" },
      description: "Clean arctic camouflage"
    },
    {
      skinId: "sniper_blood_moon",
      name: "Blood Moon",
      category: "sniper",
      rarity: "rare",
      priceUsd: 400, // $4
      priceCoins: 2000,
      colors: { primary: "#8b0000", secondary: "#2a0a0a", emissive: "#ff0000" },
      description: "Dark crimson finish"
    },
    {
      skinId: "sniper_cyber_strike",
      name: "Cyber Strike",
      category: "sniper",
      rarity: "epic",
      priceUsd: 700, // $7
      priceCoins: 4000,
      colors: { primary: "#00ff00", secondary: "#003300", emissive: "#00ff00" },
      description: "Matrix-inspired digital camo"
    },
    {
      skinId: "sniper_void_reaper",
      name: "Void Reaper",
      category: "sniper",
      rarity: "legendary",
      priceUsd: 1500, // $15
      priceCoins: 8000,
      colors: { primary: "#4b0082", secondary: "#1a0a2e", emissive: "#9400d3" },
      description: "Harvester of souls"
    },
    // Crosshair skins
    {
      skinId: "crosshair_classic_red",
      name: "Classic Red",
      category: "crosshair",
      rarity: "common",
      priceUsd: 50, // $0.50
      priceCoins: 250,
      colors: { primary: "#ff0000", secondary: "#ff0000", emissive: "#ff0000" },
      description: "Traditional red crosshair"
    },
    {
      skinId: "crosshair_cyber_blue",
      name: "Cyber Blue",
      category: "crosshair",
      rarity: "rare",
      priceUsd: 200, // $2
      priceCoins: 1000,
      colors: { primary: "#00bfff", secondary: "#0080ff", emissive: "#00ffff" },
      description: "Futuristic blue design"
    },
  ];
  
  await skinsCollection.insertMany(initialSkins);
  console.log("Initial skins seeded");
}

// Get collections
export function getWalletsCollection(): Collection<Wallet> {
  if (!db) throw new Error("Database not connected");
  return db.collection<Wallet>("wallets");
}

export function getTransactionsCollection(): Collection<Transaction> {
  if (!db) throw new Error("Database not connected");
  return db.collection<Transaction>("transactions");
}

export function getSkinsCollection(): Collection<Skin> {
  if (!db) throw new Error("Database not connected");
  return db.collection<Skin>("skins");
}

export function getUserSkinsCollection(): Collection<UserSkin> {
  if (!db) throw new Error("Database not connected");
  return db.collection<UserSkin>("user_skins");
}

export function getPlayerStatsCollection(): Collection<PlayerStats> {
  if (!db) throw new Error("Database not connected");
  return db.collection<PlayerStats>("player_stats");
}

export function getMatchesCollection(): Collection<Match> {
  if (!db) throw new Error("Database not connected");
  return db.collection<Match>("matches");
}

// Give default skins to new users
export async function giveDefaultSkins(userId: string): Promise<void> {
  const userSkins = getUserSkinsCollection();
  
  // Check if user already has skins
  const existingSkins = await userSkins.countDocuments({ odellId: userId });
  if (existingSkins > 0) return;
  
  // Give basic pistol and sniper, both equipped by default
  const defaultSkins: UserSkin[] = [
    {
      odellId: userId,
      skinId: "pistol_basic",
      category: "pistol",
      equipped: true,
      purchasedAt: new Date(),
    },
    {
      odellId: userId,
      skinId: "sniper_basic",
      category: "sniper",
      equipped: true,
      purchasedAt: new Date(),
    },
  ];
  
  await userSkins.insertMany(defaultSkins);
  console.log(`Default skins given to user ${userId}`);
}

// Wallet operations
export async function getOrCreateWallet(userId: string, username: string): Promise<Wallet> {
  const wallets = getWalletsCollection();
  
  let wallet = await wallets.findOne({ odellId: userId });
  let isNewUser = false;
  
  if (!wallet) {
    const newWallet: Wallet = {
      odellId: userId,
      odellname: username,
      balance: 0,
      coins: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await wallets.insertOne(newWallet);
    wallet = newWallet;
    isNewUser = true;
  }
  
  // Give default skins to new users
  if (isNewUser) {
    await giveDefaultSkins(userId);
  }
  
  return wallet;
}

export async function updateWalletBalance(
  userId: string, 
  amountCents: number, 
  operation: "add" | "subtract"
): Promise<Wallet | null> {
  const wallets = getWalletsCollection();
  
  const updateValue = operation === "add" ? amountCents : -amountCents;
  
  const result = await wallets.findOneAndUpdate(
    { odellId: userId, ...(operation === "subtract" ? { balance: { $gte: amountCents } } : {}) },
    { 
      $inc: { balance: updateValue },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: "after" }
  );
  
  return result;
}

export async function updateWalletCoins(
  userId: string, 
  coins: number, 
  operation: "add" | "subtract"
): Promise<Wallet | null> {
  const wallets = getWalletsCollection();
  
  const updateValue = operation === "add" ? coins : -coins;
  
  const result = await wallets.findOneAndUpdate(
    { odellId: userId, ...(operation === "subtract" ? { coins: { $gte: coins } } : {}) },
    { 
      $inc: { coins: updateValue },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: "after" }
  );
  
  return result;
}

// Transaction operations
export async function createTransaction(transaction: Omit<Transaction, "_id" | "createdAt">): Promise<Transaction> {
  const transactions = getTransactionsCollection();
  
  const newTransaction: Transaction = {
    ...transaction,
    createdAt: new Date(),
  };
  
  await transactions.insertOne(newTransaction);
  return newTransaction;
}

export async function getUserTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
  const transactions = getTransactionsCollection();
  return transactions.find({ odellId: userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

// Player stats operations
export async function getOrCreatePlayerStats(userId: string, username: string, profilePicture?: string | null): Promise<PlayerStats> {
  const stats = getPlayerStatsCollection();
  
  let playerStats = await stats.findOne({ odellId: userId });
  
  if (!playerStats) {
    const newStats: PlayerStats = {
      odellId: userId,
      odellname: username,
      profilePicture: profilePicture || null,
      totalWins: 0,
      totalLosses: 0,
      totalEarnings: 0,
      totalWagered: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      totalKills: 0,
      totalDeaths: 0,
      kdRatio: 0,
      soloWins: 0,
      coinsEarned: 0,
      matchesPlayed: 0,
      lastMatchAt: new Date(),
      updatedAt: new Date(),
    };
    
    await stats.insertOne(newStats);
    playerStats = newStats;
  } else if (profilePicture && playerStats.profilePicture !== profilePicture) {
    await stats.updateOne(
      { odellId: userId },
      { $set: { profilePicture, odellname: username, updatedAt: new Date() } }
    );
    playerStats.profilePicture = profilePicture;
  }
  
  return playerStats;
}

export async function updatePlayerStats(
  odellId: string, 
  updates: Partial<PlayerStats>,
  increments?: { [key: string]: number }
): Promise<PlayerStats | null> {
  const stats = getPlayerStatsCollection();
  
  const updateOps: any = {
    $set: { ...updates, updatedAt: new Date() }
  };
  
  if (increments) {
    updateOps.$inc = increments;
  }
  
  const result = await stats.findOneAndUpdate(
    { odellId },
    updateOps,
    { returnDocument: "after" }
  );
  
  return result;
}

// Leaderboard operations
export type LeaderboardCategory = "earnings" | "wins" | "kd" | "streak" | "coins";
export type TimeFilter = "all" | "month" | "week" | "day";

export async function getLeaderboard(
  category: LeaderboardCategory, 
  limit: number = 100
): Promise<PlayerStats[]> {
  const stats = getPlayerStatsCollection();
  
  let sortField: string;
  switch (category) {
    case "earnings":
      sortField = "totalEarnings";
      break;
    case "wins":
      sortField = "totalWins";
      break;
    case "kd":
      sortField = "kdRatio";
      break;
    case "streak":
      sortField = "bestWinStreak";
      break;
    case "coins":
      sortField = "coinsEarned";
      break;
    default:
      sortField = "totalEarnings";
  }
  
  return stats.find({}).sort({ [sortField]: -1 }).limit(limit).toArray();
}

// Skin operations
export async function getAllSkins(): Promise<Skin[]> {
  const skins = getSkinsCollection();
  return skins.find({}).toArray();
}

export async function getSkinById(skinId: string): Promise<Skin | null> {
  const skins = getSkinsCollection();
  return skins.findOne({ skinId });
}

export async function getUserSkins(userId: string): Promise<UserSkin[]> {
  const userSkins = getUserSkinsCollection();
  return userSkins.find({ odellId: userId }).toArray();
}

export async function purchaseSkin(
  userId: string, 
  skinId: string, 
  category: "pistol" | "sniper" | "crosshair"
): Promise<UserSkin> {
  const userSkins = getUserSkinsCollection();
  
  const newUserSkin: UserSkin = {
    odellId: userId,
    skinId,
    category,
    equipped: false,
    purchasedAt: new Date(),
  };
  
  await userSkins.insertOne(newUserSkin);
  return newUserSkin;
}

export async function equipSkin(
  userId: string, 
  skinId: string, 
  category: "pistol" | "sniper" | "crosshair"
): Promise<void> {
  const userSkins = getUserSkinsCollection();
  
  // Unequip all other skins in the same category
  await userSkins.updateMany(
    { odellId: userId, category, equipped: true },
    { $set: { equipped: false } }
  );
  
  // Equip the selected skin
  await userSkins.updateOne(
    { odellId: userId, skinId },
    { $set: { equipped: true } }
  );
}

export async function unequipSkin(userId: string, skinId: string): Promise<void> {
  const userSkins = getUserSkinsCollection();
  await userSkins.updateOne(
    { odellId: userId, skinId },
    { $set: { equipped: false } }
  );
}

export async function getEquippedSkins(userId: string): Promise<UserSkin[]> {
  const userSkins = getUserSkinsCollection();
  return userSkins.find({ odellId: userId, equipped: true }).toArray();
}

// Match operations
export async function createMatch(match: Omit<Match, "_id">): Promise<Match> {
  const matches = getMatchesCollection();
  
  // Use upsert to prevent duplicate key errors if match already exists
  const result = await matches.updateOne(
    { matchId: match.matchId },
    { $setOnInsert: match as Match },
    { upsert: true }
  );
  
  if (result.upsertedCount === 0) {
    console.log(`Match ${match.matchId} already exists, skipping save`);
  }
  
  return match as Match;
}

export async function getPlayerMatches(userId: string, limit: number = 20): Promise<Match[]> {
  const matches = getMatchesCollection();
  return matches.find({ "players.odellId": userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

// Mobile notification operations
function getMobileNotificationsCollection(): Collection<MobileNotification> {
  if (!db) throw new Error("Database not connected");
  return db.collection<MobileNotification>("mobile_notifications");
}

export async function saveMobileNotification(
  odellId: string,
  odellname: string,
  profilePicture: string | null,
  deviceInfo: MobileNotification["deviceInfo"]
): Promise<{ success: boolean; alreadyRegistered: boolean }> {
  const notifications = getMobileNotificationsCollection();
  
  const existing = await notifications.findOne({ odellId });
  if (existing) {
    return { success: true, alreadyRegistered: true };
  }
  
  await notifications.insertOne({
    odellId,
    odellname,
    profilePicture,
    deviceInfo,
    createdAt: new Date(),
  });
  
  return { success: true, alreadyRegistered: false };
}

export async function getMobileNotifications(): Promise<MobileNotification[]> {
  const notifications = getMobileNotificationsCollection();
  return notifications.find().sort({ createdAt: -1 }).toArray();
}

// Close connection
export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed");
  }
}
