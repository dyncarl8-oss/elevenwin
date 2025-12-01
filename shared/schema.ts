import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  experienceId: text("experience_id").notNull(),
  winnerId: text("winner_id"),
  winnerUsername: text("winner_username"),
  roomId: text("room_id").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at").notNull().defaultNow(),
  durationSeconds: integer("duration_seconds"),
});

export const matchPlayers = pgTable("match_players", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  damageDealt: integer("damage_dealt").notNull().default(0),
  shotsFired: integer("shots_fired").notNull().default(0),
  shotsHit: integer("shots_hit").notNull().default(0),
  won: boolean("won").notNull().default(false),
});

export const matchesRelations = relations(matches, ({ many }) => ({
  players: many(matchPlayers),
}));

export const matchPlayersRelations = relations(matchPlayers, ({ one }) => ({
  match: one(matches, {
    fields: [matchPlayers.matchId],
    references: [matches.id],
  }),
}));

export const insertMatchSchema = createInsertSchema(matches);
export const insertMatchPlayerSchema = createInsertSchema(matchPlayers);

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type InsertMatchPlayer = z.infer<typeof insertMatchPlayerSchema>;
