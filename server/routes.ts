import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GameServer } from "./game-server";
import { verifyUserToken, checkUserAccess, retrieveUser } from "./whop";
import { createSessionToken } from "./jwt";
import { connectMongoDB, getOrCreatePlayerStats, saveMobileNotification } from "./mongodb";
import walletRoutes from "./wallet-routes";
import webhookRoutes from "./webhook-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Connect to MongoDB
  try {
    await connectMongoDB();
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }

  // Register wallet and webhook routes
  app.use("/api", walletRoutes);
  app.use("/api", webhookRoutes);

  new GameServer(httpServer);

  app.post("/api/verify-token", async (req, res) => {
    try {
      const token = req.headers["x-whop-user-token"] as string;

      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const userInfo = await verifyUserToken(token);

      if (!userInfo) {
        return res.status(401).json({ error: "Invalid token" });
      }

      res.json({ userId: userInfo.userId });
    } catch (error) {
      console.error("Token verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/check-access", async (req, res) => {
    try {
      const token = req.headers["x-whop-user-token"] as string;
      const { experienceId } = req.body;

      if (!experienceId) {
        return res.status(400).json({ error: "Experience ID required" });
      }

      if (!token && process.env.NODE_ENV === "development") {
        const devUserId = "dev-user-" + Math.random().toString(36).substring(7);
        const sessionToken = createSessionToken(devUserId, experienceId);

        return res.json({
          hasAccess: true,
          accessLevel: "admin",
          userId: devUserId,
          sessionToken,
          userProfile: {
            id: devUserId,
            username: `DevPlayer${Math.floor(Math.random() * 1000)}`,
            name: "Developer User",
            profilePicture: null,
          },
        });
      }

      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const userInfo = await verifyUserToken(token);

      if (!userInfo) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const [access, userProfile] = await Promise.all([
        checkUserAccess(experienceId, userInfo.userId),
        retrieveUser(userInfo.userId),
      ]);

      const sessionToken = createSessionToken(userInfo.userId, experienceId);

      if (userProfile && access.hasAccess) {
        await getOrCreatePlayerStats(
          userInfo.userId, 
          userProfile.username || userProfile.name || "Player",
          userProfile.profilePicture
        );
      }

      res.json({
        hasAccess: access.hasAccess,
        accessLevel: access.accessLevel,
        userId: userInfo.userId,
        sessionToken,
        userProfile: userProfile ? {
          id: userProfile.id,
          username: userProfile.username,
          name: userProfile.name,
          profilePicture: userProfile.profilePicture,
        } : null,
      });
    } catch (error) {
      console.error("Access check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/mobile-notification", async (req, res) => {
    try {
      const token = req.headers["x-whop-user-token"] as string;
      const { deviceInfo } = req.body;

      if (!deviceInfo) {
        return res.status(400).json({ error: "Device info required" });
      }

      let userId = deviceInfo.deviceFingerprint || `anon_${Date.now()}`;
      let username = "Mobile User";
      let profilePicture: string | null = null;

      if (token) {
        const userInfo = await verifyUserToken(token);
        if (userInfo) {
          userId = userInfo.userId;
          const userProfile = await retrieveUser(userInfo.userId);
          if (userProfile) {
            username = userProfile.username || userProfile.name || "User";
            profilePicture = userProfile.profilePicture || null;
          }
        }
      }

      const result = await saveMobileNotification(userId, username, profilePicture, deviceInfo);
      
      res.json({ 
        success: true, 
        alreadyRegistered: result.alreadyRegistered,
        message: result.alreadyRegistered 
          ? "You're already on our list! We'll notify you when mobile is ready."
          : "Thanks! We'll let you know when mobile is available."
      });
    } catch (error) {
      console.error("Mobile notification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return httpServer;
}
