import { 
  users, 
  matches,
  matchPlayers,
  type User, 
  type InsertUser,
  type Match,
  type InsertMatch,
  type MatchPlayer,
  type InsertMatchPlayer,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createMatch(match: InsertMatch): Promise<Match>;
  createMatchPlayer(matchPlayer: InsertMatchPlayer): Promise<MatchPlayer>;
  getMatchesByExperience(experienceId: string): Promise<Match[]>;
  getPlayerStats(userId: string): Promise<{
    totalMatches: number;
    wins: number;
    kills: number;
    deaths: number;
    kd: number;
    winRate: number;
  }>;
  getRecentMatches(experienceId: string, limit: number): Promise<Match[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private matches: Map<number, Match>;
  private matchPlayers: Map<number, MatchPlayer>;
  currentUserId: number;
  currentMatchId: number;
  currentMatchPlayerId: number;

  constructor() {
    this.users = new Map();
    this.matches = new Map();
    this.matchPlayers = new Map();
    this.currentUserId = 1;
    this.currentMatchId = 1;
    this.currentMatchPlayerId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = this.currentMatchId++;
    const match: Match = { 
      ...insertMatch, 
      id,
      startedAt: insertMatch.startedAt || new Date(),
      endedAt: insertMatch.endedAt || new Date(),
    };
    this.matches.set(id, match);
    return match;
  }

  async createMatchPlayer(insertMatchPlayer: InsertMatchPlayer): Promise<MatchPlayer> {
    const id = this.currentMatchPlayerId++;
    const matchPlayer: MatchPlayer = { ...insertMatchPlayer, id };
    this.matchPlayers.set(id, matchPlayer);
    return matchPlayer;
  }

  async getMatchesByExperience(experienceId: string): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      (match) => match.experienceId === experienceId
    );
  }

  async getPlayerStats(userId: string): Promise<{
    totalMatches: number;
    wins: number;
    kills: number;
    deaths: number;
    kd: number;
    winRate: number;
  }> {
    const playerMatches = Array.from(this.matchPlayers.values()).filter(
      (mp) => mp.userId === userId
    );

    const totalMatches = playerMatches.length;
    const wins = playerMatches.filter((mp) => mp.won).length;
    const kills = playerMatches.reduce((sum, mp) => sum + mp.kills, 0);
    const deaths = playerMatches.reduce((sum, mp) => sum + mp.deaths, 0);
    const kd = deaths > 0 ? kills / deaths : kills;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    return {
      totalMatches,
      wins,
      kills,
      deaths,
      kd,
      winRate,
    };
  }

  async getRecentMatches(experienceId: string, limit: number): Promise<Match[]> {
    return Array.from(this.matches.values())
      .filter((match) => match.experienceId === experienceId)
      .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
      .slice(0, limit);
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const result = await db.insert(matches).values(insertMatch).returning();
    return result[0];
  }

  async createMatchPlayer(insertMatchPlayer: InsertMatchPlayer): Promise<MatchPlayer> {
    const result = await db.insert(matchPlayers).values(insertMatchPlayer).returning();
    return result[0];
  }

  async getMatchesByExperience(experienceId: string): Promise<Match[]> {
    return await db.select().from(matches).where(eq(matches.experienceId, experienceId));
  }

  async getPlayerStats(userId: string): Promise<{
    totalMatches: number;
    wins: number;
    kills: number;
    deaths: number;
    kd: number;
    winRate: number;
  }> {
    const playerMatches = await db.select().from(matchPlayers).where(eq(matchPlayers.userId, userId));

    const totalMatches = playerMatches.length;
    const wins = playerMatches.filter((mp) => mp.won).length;
    const kills = playerMatches.reduce((sum, mp) => sum + mp.kills, 0);
    const deaths = playerMatches.reduce((sum, mp) => sum + mp.deaths, 0);
    const kd = deaths > 0 ? kills / deaths : kills;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    return {
      totalMatches,
      wins,
      kills,
      deaths,
      kd,
      winRate,
    };
  }

  async getRecentMatches(experienceId: string, limit: number): Promise<Match[]> {
    return await db.select()
      .from(matches)
      .where(eq(matches.experienceId, experienceId))
      .orderBy(desc(matches.endedAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
