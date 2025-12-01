import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "default-secret-change-in-production";

export interface SessionPayload {
  userId: string;
  experienceId: string;
  iat: number;
  exp: number;
}

export function createSessionToken(userId: string, experienceId: string): string {
  const payload: Omit<SessionPayload, "iat" | "exp"> = {
    userId,
    experienceId,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h",
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}
