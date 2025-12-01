import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { verifyUserToken } from "./whop";
import { verifySessionToken } from "./jwt";
import {
  getOrCreateWallet,
  updateWalletBalance,
  updateWalletCoins,
  createTransaction,
  getOrCreatePlayerStats,
  updatePlayerStats,
  createMatch as createMongoMatch,
  getEquippedSkins,
} from "./mongodb";

export interface Player {
  id: string;
  odellId: string;
  username: string;
  profilePicture?: string | null;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  kills: number;
  isAlive: boolean;
  weapon: string;
  ammo: number;
  isReloading: boolean;
}

export type RoomType = "free" | "wager" | "solo";

export interface RoundState {
  currentRound: number;
  maxRounds: number;
  playerWins: Map<string, number>; // playerId -> wins
  roundPhase: "playing" | "round_over" | "match_over";
}

export interface GameRoom {
  id: string;
  experienceId: string;
  players: Map<string, Player>;
  maxPlayers: number;
  status: "waiting" | "playing" | "finished";
  bullets: Array<{
    id: string;
    playerId: string;
    position: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    weaponType: string;
    damage: number;
    speed: number;
    size: number;
  }>;
  createdAt: number;
  startedAt?: number;
  isSinglePlayer?: boolean;
  botIds?: string[];
  botUpdateInterval?: NodeJS.Timeout;
  readyPlayers: Set<string>;
  gameActive: boolean;
  roomType: RoomType;
  entryFee: number;
  prizePool: number;
  platformFeePercent: number;
  escrowBalances: Map<string, number>;
  roundState: RoundState;
}

export class GameServer {
  private wss: WebSocketServer;
  private rooms: Map<string, GameRoom> = new Map();
  private playerConnections: Map<string, WebSocket> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws/game" });
    this.setupWebSocket();
    console.log("Game WebSocket server initialized on /ws/game");
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws: WebSocket, req) => {
      console.log("New WebSocket connection");

      ws.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: any) {
    const { type, payload } = message;

    switch (type) {
      case "authenticate":
        await this.handleAuthenticate(ws, payload);
        break;
      case "list_rooms":
        this.handleListRooms(ws, payload);
        break;
      case "create_room":
        this.handleCreateRoom(ws, payload);
        break;
      case "create_wager_room":
        await this.handleCreateWagerRoom(ws, payload);
        break;
      case "create_singleplayer":
        await this.handleCreateSinglePlayer(ws, payload);
        break;
      case "join_room":
        await this.handleJoinRoom(ws, payload);
        break;
      case "leave_room":
        await this.handleLeaveRoom(ws, payload);
        break;
      case "player_update":
        this.handlePlayerUpdate(ws, payload);
        break;
      case "shoot":
        this.handleShoot(ws, payload);
        break;
      case "hit":
        this.handleHit(ws, payload);
        break;
      case "weapon_switch":
        this.handleWeaponSwitch(ws, payload);
        break;
      case "reload_start":
        this.handleReloadStart(ws, payload);
        break;
      case "reload_complete":
        this.handleReloadComplete(ws, payload);
        break;
      case "start_game":
        this.handleStartGame(ws, payload);
        break;
      case "player_ready":
        this.handlePlayerReady(ws, payload);
        break;
      case "get_wallet":
        await this.handleGetWallet(ws, payload);
        break;
      case "get_equipped_skins":
        await this.handleGetEquippedSkins(ws, payload);
        break;
      default:
        console.warn("Unknown message type:", type);
    }
  }

  private async handleAuthenticate(ws: WebSocket, payload: any) {
    const { sessionToken, experienceId } = payload;

    if (!sessionToken) {
      this.send(ws, { type: "auth_error", payload: { message: "No session token provided" } });
      return;
    }

    const decoded = verifySessionToken(sessionToken);
    
    if (!decoded) {
      this.send(ws, { type: "auth_error", payload: { message: "Invalid or expired session token" } });
      return;
    }

    if (decoded.experienceId !== experienceId) {
      this.send(ws, { type: "auth_error", payload: { message: "Session token does not match experience" } });
      return;
    }

    (ws as any).odellId = decoded.userId;
    (ws as any).experienceId = experienceId;
    (ws as any).playerId = `player_${decoded.userId}_${Date.now()}`;

    this.playerConnections.set((ws as any).playerId, ws);

    this.send(ws, {
      type: "authenticated",
      payload: { playerId: (ws as any).playerId, userId: decoded.userId },
    });

    this.handleListRooms(ws, { experienceId });
  }

  private handleListRooms(ws: WebSocket, payload: any) {
    // Get experienceId from payload, or fall back to the one stored on the connection
    const experienceId = payload.experienceId || (ws as any).experienceId;
    const rooms = Array.from(this.rooms.values())
      .filter((room) => room.experienceId === experienceId && room.status === "waiting")
      .map((room) => ({
        id: room.id,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        roomType: room.roomType,
        entryFee: room.entryFee,
        prizePool: room.prizePool,
      }));

    this.send(ws, { type: "rooms_list", payload: { rooms } });
  }

  private handleCreateRoom(ws: WebSocket, payload: any) {
    const experienceId = (ws as any).experienceId;
    const playerId = (ws as any).playerId;
    const odellId = (ws as any).odellId;
    const { username, profilePicture } = payload;

    if (!playerId) {
      this.send(ws, { type: "error", payload: { message: "Not authenticated" } });
      return;
    }

    const roomId = `room_${Date.now()}`;
    const room: GameRoom = {
      id: roomId,
      experienceId,
      players: new Map(),
      maxPlayers: 2,
      status: "waiting",
      bullets: [],
      createdAt: Date.now(),
      readyPlayers: new Set(),
      gameActive: false,
      roomType: "free",
      entryFee: 0,
      prizePool: 0,
      platformFeePercent: 15,
      escrowBalances: new Map(),
      roundState: {
        currentRound: 1,
        maxRounds: 3,
        playerWins: new Map(),
        roundPhase: "playing",
      },
    };

    const player: Player = {
      id: playerId,
      odellId,
      username: username || `Player ${odellId.substring(0, 6)}`,
      profilePicture: profilePicture || null,
      position: { x: -42, y: 0.5, z: 0 },
      rotation: { x: 0, y: Math.PI / 2 },
      health: 100,
      kills: 0,
      isAlive: true,
      weapon: "pistol",
      ammo: 12,
      isReloading: false,
    };

    room.players.set(playerId, player);
    this.rooms.set(roomId, room);
    this.playerToRoom.set(playerId, roomId);

    this.send(ws, {
      type: "room_joined",
      payload: {
        roomId,
        playerId,
        players: Array.from(room.players.values()),
        status: room.status,
        roomType: room.roomType,
        entryFee: room.entryFee,
      },
    });

    this.broadcastLobbyUpdate(experienceId);
  }

  private async handleCreateWagerRoom(ws: WebSocket, payload: any) {
    const experienceId = (ws as any).experienceId;
    const playerId = (ws as any).playerId;
    const odellId = (ws as any).odellId;
    const { entryFee, username, profilePicture } = payload; // entryFee in cents

    if (!playerId) {
      this.send(ws, { type: "error", payload: { message: "Not authenticated" } });
      return;
    }

    // Validate entry fee - minimum $1.00 (100 cents), maximum $1000 (100000 cents)
    if (!entryFee || entryFee < 100 || entryFee > 100000) {
      this.send(ws, { type: "error", payload: { message: "Entry fee must be between $1.00 and $1000.00" } });
      return;
    }

    const roomId = `wager_${Date.now()}`;
    
    try {
      // Check wallet balance
      const wallet = await getOrCreateWallet(odellId, username || "Player");
      
      if (wallet.balance < entryFee) {
        this.send(ws, { 
          type: "error", 
          payload: { 
            message: "Insufficient balance",
            required: entryFee,
            current: wallet.balance,
          } 
        });
        return;
      }

      // Deduct entry fee (escrow) - this is the critical operation
      const updated = await updateWalletBalance(odellId, entryFee, "subtract");
      if (!updated) {
        this.send(ws, { type: "error", payload: { message: "Failed to process entry fee" } });
        return;
      }

      // Create transaction record - if this fails, we need to rollback the balance change
      try {
        await createTransaction({
          odellId,
          type: "wager_entry",
          amount: entryFee,
          currency: "usd",
          status: "completed",
          metadata: {
            roomId,
            description: `Wager room entry fee $${(entryFee / 100).toFixed(2)}`,
          },
        });
      } catch (txError) {
        // Rollback: refund the entry fee
        console.error("Transaction record failed, rolling back balance:", txError);
        await updateWalletBalance(odellId, entryFee, "add");
        this.send(ws, { type: "error", payload: { message: "Failed to create wager room, funds refunded" } });
        return;
      }

      let room: GameRoom;
      try {
        room = {
          id: roomId,
          experienceId,
          players: new Map(),
          maxPlayers: 2,
          status: "waiting",
          bullets: [],
          createdAt: Date.now(),
          readyPlayers: new Set(),
          gameActive: false,
          roomType: "wager",
          entryFee,
          prizePool: entryFee, // Will double when second player joins
          platformFeePercent: 15,
          escrowBalances: new Map([[odellId, entryFee]]),
          roundState: {
            currentRound: 1,
            maxRounds: 3,
            playerWins: new Map(),
            roundPhase: "playing",
          },
        };

        const player: Player = {
          id: playerId,
          odellId,
          username: username || `Player ${odellId.substring(0, 6)}`,
          profilePicture: profilePicture || null,
          position: { x: -42, y: 0.5, z: 0 },
          rotation: { x: 0, y: Math.PI / 2 },
          health: 100,
          kills: 0,
          isAlive: true,
          weapon: "pistol",
          ammo: 12,
          isReloading: false,
        };

        room.players.set(playerId, player);
        this.rooms.set(roomId, room);
        this.playerToRoom.set(playerId, roomId);
      } catch (roomError) {
        // Rollback: refund the entry fee if room setup fails
        console.error("Room setup failed, rolling back balance:", roomError);
        await updateWalletBalance(odellId, entryFee, "add");
        this.send(ws, { type: "error", payload: { message: "Failed to create wager room, funds refunded" } });
        return;
      }

      this.send(ws, {
        type: "room_joined",
        payload: {
          roomId,
          playerId,
          players: Array.from(room.players.values()),
          status: room.status,
          roomType: room.roomType,
          entryFee: room.entryFee,
          prizePool: room.prizePool,
        },
      });

      // Send updated wallet balance
      this.send(ws, {
        type: "wallet_updated",
        payload: { balance: updated.balance, coins: updated.coins },
      });

      this.broadcastLobbyUpdate(experienceId);

      console.log(`Wager room ${roomId} created by ${username} with $${(entryFee / 100).toFixed(2)} entry fee`);

    } catch (error) {
      console.error("Error creating wager room:", error);
      this.send(ws, { type: "error", payload: { message: "Failed to create wager room" } });
    }
  }

  private async handleCreateSinglePlayer(ws: WebSocket, payload: any) {
    const experienceId = (ws as any).experienceId;
    const playerId = (ws as any).playerId;
    const odellId = (ws as any).odellId;

    if (!playerId) {
      this.send(ws, { type: "error", payload: { message: "Not authenticated" } });
      return;
    }

    const roomId = `room_sp_${Date.now()}`;
    const botId = `bot_${Date.now()}`;
    
    const room: GameRoom = {
      id: roomId,
      experienceId,
      players: new Map(),
      maxPlayers: 2,
      status: "playing",
      bullets: [],
      createdAt: Date.now(),
      startedAt: Date.now(),
      isSinglePlayer: true,
      botIds: [botId],
      readyPlayers: new Set(),
      gameActive: false,
      roomType: "solo",
      entryFee: 0,
      prizePool: 0,
      platformFeePercent: 0,
      escrowBalances: new Map(),
      roundState: {
        currentRound: 1,
        maxRounds: 3,
        playerWins: new Map(),
        roundPhase: "playing",
      },
    };

    const player: Player = {
      id: playerId,
      odellId,
      username: payload.username || `Player ${odellId.substring(0, 6)}`,
      profilePicture: payload.profilePicture || null,
      position: { x: -42, y: 0.5, z: 0 },
      rotation: { x: 0, y: Math.PI / 2 },
      health: 100,
      kills: 0,
      isAlive: true,
      weapon: "pistol",
      ammo: 12,
      isReloading: false,
    };

    const bot: Player = {
      id: botId,
      odellId: "bot",
      username: "Bot",
      position: { x: 42, y: 0, z: 0 },
      rotation: { x: 0, y: -Math.PI / 2 },
      health: 100,
      kills: 0,
      isAlive: true,
      weapon: "pistol",
      ammo: 12,
      isReloading: false,
    };

    room.players.set(playerId, player);
    room.players.set(botId, bot);
    this.rooms.set(roomId, room);
    this.playerToRoom.set(playerId, roomId);

    this.send(ws, {
      type: "room_joined",
      payload: {
        roomId,
        playerId,
        players: Array.from(room.players.values()),
        status: room.status,
        roomType: room.roomType,
      },
    });

    this.send(ws, {
      type: "game_started",
      payload: { players: Array.from(room.players.values()) },
    });

    room.gameActive = true;
    
    this.send(ws, {
      type: "game_active",
      payload: { message: "Game is now active!" },
    });
    
    this.startBotAI(roomId, botId, playerId);
  }

  private startBotAI(roomId: string, botId: string, targetPlayerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const walls = [
      { pos: [-25, 1.5, 0], size: [1, 3, 10], rot: 0 },
      { pos: [25, 1.5, 0], size: [1, 3, 10], rot: 0 },
      { pos: [0, 1.5, -25], size: [10, 3, 1], rot: 0 },
      { pos: [0, 1.5, 25], size: [10, 3, 1], rot: 0 },
      { pos: [-35, 1.5, -20], size: [8, 3, 1], rot: Math.PI / 4 },
      { pos: [35, 1.5, -20], size: [8, 3, 1], rot: -Math.PI / 4 },
      { pos: [-35, 1.5, 20], size: [8, 3, 1], rot: -Math.PI / 4 },
      { pos: [35, 1.5, 20], size: [8, 3, 1], rot: Math.PI / 4 },
    ];

    const covers = [
      { pos: [-15, 0.75, -15], size: [1.5, 1.5, 1.5] },
      { pos: [15, 0.75, 15], size: [1.5, 1.5, 1.5] },
      { pos: [0, 0.75, 20], size: [1.5, 1.5, 1.5] },
      { pos: [0, 0.75, -20], size: [1.5, 1.5, 1.5] },
      { pos: [-10, 0.75, -25], size: [1.5, 1.5, 1.5] },
      { pos: [10, 0.75, 25], size: [1.5, 1.5, 1.5] },
      { pos: [-30, 0.75, -30], size: [1.5, 1.5, 1.5] },
      { pos: [30, 0.75, 30], size: [1.5, 1.5, 1.5] },
      { pos: [-15, 0.6, 15], size: [0.8, 1.2, 0.8] },
      { pos: [15, 0.6, -15], size: [0.8, 1.2, 0.8] },
      { pos: [-20, 0.6, 0], size: [0.8, 1.2, 0.8] },
      { pos: [20, 0.6, 0], size: [0.8, 1.2, 0.8] },
      { pos: [-25, 0.6, -10], size: [0.8, 1.2, 0.8] },
      { pos: [25, 0.6, 10], size: [0.8, 1.2, 0.8] },
      { pos: [-30, 0.6, 30], size: [0.8, 1.2, 0.8] },
      { pos: [30, 0.6, -30], size: [0.8, 1.2, 0.8] },
    ];

    const coverPositions = covers.map(c => ({ x: c.pos[0], z: c.pos[2], size: c.size }));

    const basePatrolPoints = [
      { x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 },
      { x: 0, z: -8 }, { x: 0, z: 8 }, { x: -8, z: 0 }, { x: 8, z: 0 },
      { x: -14, z: 0 }, { x: 14, z: 0 }, { x: 0, z: -14 }, { x: 0, z: 14 },
    ];
    
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    const patrolPoints = shuffleArray(basePatrolPoints);

    type AIState = "PATROL" | "SEEK_PLAYER" | "TAKE_COVER" | "ATTACK" | "FLANK" | "RETREAT";

    const checkPointInRotatedBox = (
      px: number, py: number, pz: number,
      bx: number, by: number, bz: number,
      w: number, h: number, d: number,
      rot: number,
      radius: number = 0
    ): boolean => {
      if (rot !== 0) {
        const cos = Math.cos(-rot);
        const sin = Math.sin(-rot);
        const dx = px - bx;
        const dz = pz - bz;
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;

        return (
          localX + radius > -w / 2 &&
          localX - radius < w / 2 &&
          py + radius > by - h / 2 &&
          py - radius < by + h / 2 &&
          localZ + radius > -d / 2 &&
          localZ - radius < d / 2
        );
      } else {
        return (
          px + radius > bx - w / 2 &&
          px - radius < bx + w / 2 &&
          py + radius > by - h / 2 &&
          py - radius < by + h / 2 &&
          pz + radius > bz - d / 2 &&
          pz - radius < bz + d / 2
        );
      }
    };

    const checkBotCollision = (newX: number, newZ: number): boolean => {
      const botRadius = 0.5;
      const botY = 1;
      
      for (const wall of walls) {
        const [wx, wy, wz] = wall.pos;
        const [w, h, d] = wall.size;
        const rot = wall.rot || 0;
        
        if (checkPointInRotatedBox(newX, botY, newZ, wx, wy, wz, w, h, d, rot, botRadius)) {
          return true;
        }
      }
      
      for (const cover of covers) {
        const [cx, cy, cz] = cover.pos;
        const [w, h, d] = cover.size;
        const coverY = cy + h / 2;
        
        if (
          newX + botRadius > cx - w / 2 &&
          newX - botRadius < cx + w / 2 &&
          newZ + botRadius > cz - d / 2 &&
          newZ - botRadius < cz + d / 2
        ) {
          return true;
        }
      }
      
      return false;
    };

    const hasLineOfSight = (
      startX: number, startY: number, startZ: number,
      endX: number, endY: number, endZ: number
    ): boolean => {
      const totalDx = endX - startX;
      const totalDy = endY - startY;
      const totalDz = endZ - startZ;
      const distance = Math.sqrt(totalDx * totalDx + totalDy * totalDy + totalDz * totalDz);
      
      if (distance < 0.1) return true;
      
      const stepSize = 0.4;
      const steps = Math.ceil(distance / stepSize);
      
      const dx = totalDx / steps;
      const dy = totalDy / steps;
      const dz = totalDz / steps;

      for (let i = 1; i <= steps; i++) {
        const checkX = startX + dx * i;
        const checkY = startY + dy * i;
        const checkZ = startZ + dz * i;

        for (const wall of walls) {
          const [wx, wy, wz] = wall.pos;
          const [w, h, d] = wall.size;
          const rot = wall.rot || 0;
          
          if (checkPointInRotatedBox(checkX, checkY, checkZ, wx, wy, wz, w, h, d, rot, 0)) {
            return false;
          }
        }

        for (const cover of covers) {
          const [cx, cy, cz] = cover.pos;
          const [w, h, d] = cover.size;
          const coverY = cy + h / 2;
          
          if (
            checkX > cx - w / 2 && checkX < cx + w / 2 &&
            checkY > coverY - h / 2 && checkY < coverY + h / 2 &&
            checkZ > cz - d / 2 && checkZ < cz + d / 2
          ) {
            return false;
          }
        }
      }

      return true;
    };

    const findBestCover = (botX: number, botZ: number, targetX: number, targetZ: number) => {
      let bestCover = null;
      let bestScore = -Infinity;

      for (const cover of coverPositions) {
        const coverOffset = 2.0;
        const dxFromTarget = cover.x - targetX;
        const dzFromTarget = cover.z - targetZ;
        const distToTarget = Math.sqrt(dxFromTarget * dxFromTarget + dzFromTarget * dzFromTarget);
        
        if (distToTarget < 0.5) continue;
        
        const behindCoverX = cover.x + (dxFromTarget / distToTarget) * coverOffset;
        const behindCoverZ = cover.z + (dzFromTarget / distToTarget) * coverOffset;
        
        const dxFromBot = behindCoverX - botX;
        const dzFromBot = behindCoverZ - botZ;
        const distFromBot = Math.sqrt(dxFromBot * dxFromBot + dzFromBot * dzFromBot);
        
        const blocksLOS = !hasLineOfSight(behindCoverX, 1, behindCoverZ, targetX, 1, targetZ);
        const score = (blocksLOS ? 100 : 0) - distFromBot * 2 + (15 - distToTarget);
        
        if (score > bestScore && !checkBotCollision(behindCoverX, behindCoverZ)) {
          bestScore = score;
          bestCover = { x: behindCoverX, z: behindCoverZ };
        }
      }
      return bestCover;
    };

    const findFlankPosition = (botX: number, botZ: number, targetX: number, targetZ: number) => {
      const dx = targetX - botX;
      const dz = targetZ - botZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < 0.5) {
        return { x: botX + (Math.random() - 0.5) * 10, z: botZ + (Math.random() - 0.5) * 10 };
      }
      
      const angleToTarget = Math.atan2(dx, dz);
      const flankAngle = angleToTarget + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const flankDist = 8 + Math.random() * 5;
      
      const flankX = targetX + Math.sin(flankAngle) * flankDist;
      const flankZ = targetZ + Math.cos(flankAngle) * flankDist;
      
      const arenaSize = 18;
      return {
        x: Math.max(-arenaSize, Math.min(arenaSize, flankX)),
        z: Math.max(-arenaSize, Math.min(arenaSize, flankZ))
      };
    };

    const INITIAL_GRACE_PERIOD = 2000;

    const botInit = room.players.get(botId);
    const initialHeading = botInit ? Math.atan2(-botInit.position.x, -botInit.position.z) : 0;
    
    const aggressionLevel = 0.5 + Math.random() * 0.5;
    const startIndex = Math.floor(Math.random() * patrolPoints.length);
    
    let botState = {
      aiState: "PATROL" as AIState,
      targetPosition: { x: patrolPoints[startIndex].x, z: patrolPoints[startIndex].z },
      flankTarget: null as { x: number; z: number } | null,
      coverTarget: null as { x: number; z: number } | null,
      patrolIndex: startIndex,
      lastStateChange: Date.now(),
      lastShot: Date.now() + INITIAL_GRACE_PERIOD,
      lastPlayerSeen: 0,
      playerLastKnownPos: { x: 0, z: 0 },
      movementHeading: initialHeading,
      aimHeading: initialHeading,
      isAiming: false,
      stuckCounter: 0,
      lastPosition: { x: botInit?.position.x || 0, z: botInit?.position.z || 0 },
      aggression: aggressionLevel,
      behaviorSeed: Math.random(),
      lastDamageTime: 0,
      consecutiveHits: 0,
      currentMovementMode: Math.floor(Math.random() * 4),
      movementModeExpiry: Date.now() + 1500 + Math.random() * 2000,
      phaseOffset: Math.random() * Math.PI * 2,
      strafeDirection: Math.random() > 0.5 ? 1 : -1,
      dodgeAmplitude: 0.3 + Math.random() * 0.4,
      burstPhaseExpiry: Date.now() + 400 + Math.random() * 600,
      currentBurstPhase: 0,
      jitterOffset: 0,
    };

    const moveTowards = (bot: any, targetX: number, targetZ: number, speed: number) => {
      const dx = targetX - bot.position.x;
      const dz = targetZ - bot.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < 0.5) return { moved: false, heading: botState.movementHeading };
      
      const moveX = (dx / dist) * speed;
      const moveZ = (dz / dist) * speed;
      
      const newX = bot.position.x + moveX;
      const newZ = bot.position.z + moveZ;
      
      const arenaSize = 18;
      const clampedX = Math.max(-arenaSize, Math.min(arenaSize, newX));
      const clampedZ = Math.max(-arenaSize, Math.min(arenaSize, newZ));
      
      const heading = Math.atan2(dx, dz);
      
      if (!checkBotCollision(clampedX, clampedZ)) {
        bot.position.x = clampedX;
        bot.position.z = clampedZ;
        return { moved: true, heading };
      } else if (!checkBotCollision(clampedX, bot.position.z)) {
        bot.position.x = clampedX;
        return { moved: true, heading };
      } else if (!checkBotCollision(bot.position.x, clampedZ)) {
        bot.position.z = clampedZ;
        return { moved: true, heading };
      }
      
      const slideAngle = heading + Math.PI / 4;
      const slideX = bot.position.x + Math.sin(slideAngle) * speed;
      const slideZ = bot.position.z + Math.cos(slideAngle) * speed;
      if (!checkBotCollision(slideX, slideZ)) {
        bot.position.x = slideX;
        bot.position.z = slideZ;
        return { moved: true, heading: slideAngle };
      }
      
      return { moved: false, heading: botState.movementHeading };
    };

    const botUpdate = () => {
      const currentRoom = this.rooms.get(roomId);
      if (!currentRoom || currentRoom.status !== "playing") {
        if (currentRoom?.botUpdateInterval) {
          clearInterval(currentRoom.botUpdateInterval);
        }
        return;
      }

      const bot = currentRoom.players.get(botId);
      const target = currentRoom.players.get(targetPlayerId);

      if (!bot || !target || !bot.isAlive || !target.isAlive) {
        return;
      }

      bot.position.y = 0;

      const now = Date.now();

      const dx = target.position.x - bot.position.x;
      const dz = target.position.z - bot.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      const angleToTarget = Math.atan2(dx, dz);
      
      const canSeeTarget = hasLineOfSight(
        bot.position.x, 1, bot.position.z,
        target.position.x, 1, target.position.z
      );

      if (canSeeTarget) {
        botState.lastPlayerSeen = now;
        botState.playerLastKnownPos = { x: target.position.x, z: target.position.z };
      }

      const timeSinceSeenPlayer = now - botState.lastPlayerSeen;
      const healthPercent = bot.health / 100;
      const baseSpeed = 0.12;

      if (Math.abs(bot.position.x - botState.lastPosition.x) < 0.01 && 
          Math.abs(bot.position.z - botState.lastPosition.z) < 0.01) {
        botState.stuckCounter++;
      } else {
        botState.stuckCounter = 0;
      }
      botState.lastPosition = { x: bot.position.x, z: bot.position.z };

      if (botState.stuckCounter > 30) {
        botState.aiState = "PATROL";
        botState.patrolIndex = (botState.patrolIndex + 1) % patrolPoints.length;
        botState.stuckCounter = 0;
      }

      switch (botState.aiState) {
        case "PATROL":
          const patrolTarget = patrolPoints[botState.patrolIndex];
          const distToPatrol = Math.sqrt(
            Math.pow(patrolTarget.x - bot.position.x, 2) + 
            Math.pow(patrolTarget.z - bot.position.z, 2)
          );
          
          if (distToPatrol < 2) {
            const skipChance = Math.random();
            if (skipChance < 0.3) {
              botState.patrolIndex = (botState.patrolIndex + 2) % patrolPoints.length;
            } else {
              botState.patrolIndex = (botState.patrolIndex + 1) % patrolPoints.length;
            }
          }
          
          const patrolResult = moveTowards(bot, patrolTarget.x, patrolTarget.z, baseSpeed * 0.85);
          if (patrolResult.moved) {
            botState.movementHeading = patrolResult.heading;
          }
          
          if (canSeeTarget) {
            botState.isAiming = true;
            botState.aimHeading = angleToTarget;
            botState.aiState = "ATTACK";
            botState.currentMovementMode = Math.floor(Math.random() * 4);
            botState.movementModeExpiry = now + 1500 + Math.random() * 2000;
            botState.phaseOffset = Math.random() * Math.PI * 2;
            botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
            botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
            botState.lastStateChange = now;
          } else {
            botState.isAiming = false;
          }
          break;

        case "SEEK_PLAYER":
          const seekResult = moveTowards(bot, botState.playerLastKnownPos.x, botState.playerLastKnownPos.z, baseSpeed);
          if (seekResult.moved) {
            botState.movementHeading = seekResult.heading;
          }
          botState.isAiming = false;
          
          const distToLastKnown = Math.sqrt(
            Math.pow(botState.playerLastKnownPos.x - bot.position.x, 2) + 
            Math.pow(botState.playerLastKnownPos.z - bot.position.z, 2)
          );
          
          if (canSeeTarget) {
            botState.aiState = "ATTACK";
            botState.currentMovementMode = Math.floor(Math.random() * 4);
            botState.movementModeExpiry = now + 1500 + Math.random() * 2000;
            botState.phaseOffset = Math.random() * Math.PI * 2;
            botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
            botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
            botState.lastStateChange = now;
          } else if (distToLastKnown < 3 || now - botState.lastStateChange > 5000) {
            botState.aiState = "PATROL";
            botState.lastStateChange = now;
          }
          break;

        case "TAKE_COVER":
          if (!botState.coverTarget) {
            botState.coverTarget = findBestCover(bot.position.x, bot.position.z, target.position.x, target.position.z);
          }
          
          if (botState.coverTarget) {
            const coverResult = moveTowards(bot, botState.coverTarget.x, botState.coverTarget.z, baseSpeed * 1.2);
            if (coverResult.moved) {
              botState.movementHeading = coverResult.heading;
            }
            
            const distToCover = Math.sqrt(
              Math.pow(botState.coverTarget.x - bot.position.x, 2) + 
              Math.pow(botState.coverTarget.z - bot.position.z, 2)
            );
            
            if (distToCover < 1.5) {
              botState.isAiming = true;
              botState.aimHeading = angleToTarget;
              
              if (bot.health > 40 || now - botState.lastStateChange > 4000) {
                botState.aiState = canSeeTarget ? "ATTACK" : "FLANK";
                botState.coverTarget = null;
                botState.currentMovementMode = Math.floor(Math.random() * 4);
                botState.movementModeExpiry = now + 1500 + Math.random() * 2000;
                botState.phaseOffset = Math.random() * Math.PI * 2;
                botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
                botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
                botState.lastStateChange = now;
              }
            }
          } else {
            botState.aiState = "ATTACK";
            botState.currentMovementMode = Math.floor(Math.random() * 4);
            botState.movementModeExpiry = now + 1500 + Math.random() * 2000;
            botState.phaseOffset = Math.random() * Math.PI * 2;
            botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
            botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
            botState.lastStateChange = now;
          }
          break;

        case "ATTACK":
          botState.isAiming = true;
          botState.aimHeading = angleToTarget;
          
          const attackSpeed = baseSpeed * (0.85 + botState.aggression * 0.3);
          let attackMoveX = 0;
          let attackMoveZ = 0;
          
          if (now > botState.movementModeExpiry) {
            const weights = [0.25, 0.25, 0.2, 0.3];
            const rand = Math.random();
            let cumulative = 0;
            let newMode = 3;
            for (let i = 0; i < weights.length; i++) {
              cumulative += weights[i];
              if (rand < cumulative) {
                newMode = i;
                break;
              }
            }
            botState.currentMovementMode = newMode;
            botState.movementModeExpiry = now + 1500 + Math.random() * 2500;
            botState.phaseOffset = Math.random() * Math.PI * 2;
            botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
            botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
          }
          
          if (now > botState.burstPhaseExpiry) {
            botState.currentBurstPhase = (botState.currentBurstPhase + 1) % 3;
            botState.burstPhaseExpiry = now + 300 + Math.random() * 500;
            botState.jitterOffset = (Math.random() - 0.5) * 0.3;
            if (Math.random() < 0.2) {
              botState.strafeDirection = -botState.strafeDirection;
            }
          }
          
          const jitter = (Math.random() - 0.5) * 0.15 + botState.jitterOffset;
          const timeFactor = now * 0.001 + botState.phaseOffset + jitter;
          
          const isLongRange = distance > 30;
          const closingSpeed = isLongRange ? attackSpeed * 1.5 : attackSpeed;
          
          if (isLongRange) {
            switch (botState.currentMovementMode) {
              case 0:
                attackMoveX = Math.sin(angleToTarget) * closingSpeed;
                attackMoveZ = Math.cos(angleToTarget) * closingSpeed;
                const dodgeAngle0 = angleToTarget + Math.PI / 2;
                const dodgePhase0 = Math.sin(timeFactor * 1.8);
                const dodgeDir0 = dodgePhase0 > 0.4 ? botState.strafeDirection : dodgePhase0 < -0.4 ? -botState.strafeDirection : 0;
                attackMoveX += Math.sin(dodgeAngle0) * attackSpeed * botState.dodgeAmplitude * dodgeDir0;
                attackMoveZ += Math.cos(dodgeAngle0) * attackSpeed * botState.dodgeAmplitude * dodgeDir0;
                break;
                
              case 1:
                const zigzag = Math.sin(timeFactor * 2.5) * (0.4 + botState.dodgeAmplitude);
                const zigAngle = angleToTarget + zigzag * botState.strafeDirection;
                attackMoveX = Math.sin(zigAngle) * closingSpeed;
                attackMoveZ = Math.cos(zigAngle) * closingSpeed;
                break;
                
              case 2:
                const spiralOffset = Math.sin(timeFactor * 0.7) * botState.dodgeAmplitude;
                const spiralAngle = angleToTarget + spiralOffset * botState.strafeDirection;
                attackMoveX = Math.sin(spiralAngle) * closingSpeed * 1.1;
                attackMoveZ = Math.cos(spiralAngle) * closingSpeed * 1.1;
                const perpAngle = spiralAngle + Math.PI / 2 * botState.strafeDirection;
                attackMoveX += Math.sin(perpAngle) * attackSpeed * 0.3 * Math.cos(timeFactor);
                attackMoveZ += Math.cos(perpAngle) * attackSpeed * 0.3 * Math.cos(timeFactor);
                break;
                
              case 3:
                if (botState.currentBurstPhase === 0) {
                  attackMoveX = Math.sin(angleToTarget) * closingSpeed * (1.3 + Math.random() * 0.2);
                  attackMoveZ = Math.cos(angleToTarget) * closingSpeed * (1.3 + Math.random() * 0.2);
                } else if (botState.currentBurstPhase === 1) {
                  const sideAngle = angleToTarget + (Math.PI / 3 * botState.strafeDirection);
                  attackMoveX = Math.sin(sideAngle) * closingSpeed * (0.8 + Math.random() * 0.2);
                  attackMoveZ = Math.cos(sideAngle) * closingSpeed * (0.8 + Math.random() * 0.2);
                } else {
                  attackMoveX = Math.sin(angleToTarget) * closingSpeed * 1.2;
                  attackMoveZ = Math.cos(angleToTarget) * closingSpeed * 1.2;
                  const jukeMagnitude = botState.dodgeAmplitude * (0.7 + Math.random() * 0.6);
                  attackMoveX += Math.sin(angleToTarget + Math.PI / 2) * attackSpeed * jukeMagnitude * botState.strafeDirection;
                  attackMoveZ += Math.cos(angleToTarget + Math.PI / 2) * attackSpeed * jukeMagnitude * botState.strafeDirection;
                }
                break;
            }
          } else {
            switch (botState.currentMovementMode) {
              case 0:
                if (distance > 15) {
                  attackMoveX = Math.sin(angleToTarget) * attackSpeed * 1.2;
                  attackMoveZ = Math.cos(angleToTarget) * attackSpeed * 1.2;
                }
                const strafeAngle0s = angleToTarget + Math.PI / 2;
                const strafeDir0s = Math.sin(timeFactor * 1.5) > 0 ? botState.strafeDirection : -botState.strafeDirection;
                attackMoveX += Math.sin(strafeAngle0s) * attackSpeed * (0.4 + botState.dodgeAmplitude * 0.5) * strafeDir0s;
                attackMoveZ += Math.cos(strafeAngle0s) * attackSpeed * (0.4 + botState.dodgeAmplitude * 0.5) * strafeDir0s;
                break;
                
              case 1:
                const zigzagPhase = Math.sin(timeFactor * 3) * (0.5 + botState.dodgeAmplitude * 0.5);
                const zigzagAngle = angleToTarget + zigzagPhase * botState.strafeDirection;
                if (distance > 10) {
                  attackMoveX = Math.sin(zigzagAngle) * attackSpeed * 1.1;
                  attackMoveZ = Math.cos(zigzagAngle) * attackSpeed * 1.1;
                } else {
                  attackMoveX = Math.sin(zigzagAngle + Math.PI) * attackSpeed * 0.5;
                  attackMoveZ = Math.cos(zigzagAngle + Math.PI) * attackSpeed * 0.5;
                }
                break;
                
              case 2:
                const circleAngle = angleToTarget + Math.PI / 2 * botState.strafeDirection;
                const circleSpeed = attackSpeed * (0.7 + botState.dodgeAmplitude * 0.5);
                attackMoveX = Math.sin(circleAngle) * circleSpeed;
                attackMoveZ = Math.cos(circleAngle) * circleSpeed;
                if (distance > 18) {
                  attackMoveX += Math.sin(angleToTarget) * attackSpeed * 0.7;
                  attackMoveZ += Math.cos(angleToTarget) * attackSpeed * 0.7;
                }
                break;
                
              case 3:
                if (distance > 14) {
                  attackMoveX = Math.sin(angleToTarget) * attackSpeed * 1.4;
                  attackMoveZ = Math.cos(angleToTarget) * attackSpeed * 1.4;
                } else if (distance < 6) {
                  attackMoveX = -Math.sin(angleToTarget) * attackSpeed;
                  attackMoveZ = -Math.cos(angleToTarget) * attackSpeed;
                } else {
                  const strafeSign = Math.sin(timeFactor * 2) > 0 ? botState.strafeDirection : -botState.strafeDirection;
                  attackMoveX = Math.sin(angleToTarget + Math.PI / 2 * strafeSign) * attackSpeed * (0.6 + botState.dodgeAmplitude * 0.4);
                  attackMoveZ = Math.cos(angleToTarget + Math.PI / 2 * strafeSign) * attackSpeed * (0.6 + botState.dodgeAmplitude * 0.4);
                }
                break;
            }
          }
          
          const newAttackX = bot.position.x + attackMoveX;
          const newAttackZ = bot.position.z + attackMoveZ;
          const arenaSize = 18;
          const clampedAttackX = Math.max(-arenaSize, Math.min(arenaSize, newAttackX));
          const clampedAttackZ = Math.max(-arenaSize, Math.min(arenaSize, newAttackZ));
          
          if (!checkBotCollision(clampedAttackX, clampedAttackZ)) {
            bot.position.x = clampedAttackX;
            bot.position.z = clampedAttackZ;
            if (Math.abs(attackMoveX) > 0.01 || Math.abs(attackMoveZ) > 0.01) {
              botState.movementHeading = Math.atan2(attackMoveX, attackMoveZ);
            }
          }
          
          const stateTime = now - botState.lastStateChange;
          const flankChance = 0.3 + (stateTime / 10000) * 0.4;
          
          if (!canSeeTarget) {
            botState.aiState = "SEEK_PLAYER";
            botState.lastStateChange = now;
          } else if (healthPercent < 0.35) {
            botState.aiState = "TAKE_COVER";
            botState.coverTarget = null;
            botState.lastStateChange = now;
          } else if (stateTime > 3000 && Math.random() < flankChance * 0.02) {
            botState.aiState = "FLANK";
            botState.flankTarget = null;
            botState.currentMovementMode = Math.floor(Math.random() * 4);
            botState.movementModeExpiry = now + 1500 + Math.random() * 2000;
            botState.phaseOffset = Math.random() * Math.PI * 2;
            botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
            botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
            botState.lastStateChange = now;
          }
          break;

        case "FLANK":
          if (!botState.flankTarget) {
            botState.flankTarget = findFlankPosition(bot.position.x, bot.position.z, target.position.x, target.position.z);
          }
          
          const flankResult = moveTowards(bot, botState.flankTarget.x, botState.flankTarget.z, baseSpeed * 1.1);
          if (flankResult.moved) {
            botState.movementHeading = flankResult.heading;
          }
          
          const distToFlank = Math.sqrt(
            Math.pow(botState.flankTarget.x - bot.position.x, 2) + 
            Math.pow(botState.flankTarget.z - bot.position.z, 2)
          );
          
          if (canSeeTarget) {
            botState.isAiming = true;
            botState.aimHeading = angleToTarget;
          } else {
            botState.isAiming = false;
          }
          
          if (distToFlank < 2 || now - botState.lastStateChange > 3000) {
            botState.aiState = canSeeTarget ? "ATTACK" : "SEEK_PLAYER";
            botState.flankTarget = null;
            botState.currentMovementMode = Math.floor(Math.random() * 4);
            botState.movementModeExpiry = now + 1500 + Math.random() * 2000;
            botState.phaseOffset = Math.random() * Math.PI * 2;
            botState.strafeDirection = Math.random() > 0.5 ? 1 : -1;
            botState.dodgeAmplitude = 0.3 + Math.random() * 0.4;
            botState.lastStateChange = now;
          }
          break;

        case "RETREAT":
          const retreatAngle = angleToTarget + Math.PI;
          const retreatX = bot.position.x + Math.sin(retreatAngle) * baseSpeed * 1.3;
          const retreatZ = bot.position.z + Math.cos(retreatAngle) * baseSpeed * 1.3;
          
          if (!checkBotCollision(retreatX, retreatZ)) {
            bot.position.x = retreatX;
            bot.position.z = retreatZ;
            botState.movementHeading = retreatAngle;
          }
          
          botState.isAiming = canSeeTarget;
          if (canSeeTarget) {
            botState.aimHeading = angleToTarget;
          }
          
          if (distance > 20 || now - botState.lastStateChange > 3000) {
            botState.aiState = "TAKE_COVER";
            botState.coverTarget = null;
            botState.lastStateChange = now;
          }
          break;
      }

      if (botState.isAiming) {
        bot.rotation.y = botState.aimHeading;
      } else {
        bot.rotation.y = botState.movementHeading;
      }

      const targetWs = this.playerConnections.get(targetPlayerId);
      if (targetWs) {
        this.send(targetWs, {
          type: "player_moved",
          payload: {
            playerId: botId,
            position: bot.position,
            rotation: bot.rotation,
            movementHeading: botState.movementHeading,
            isAiming: botState.isAiming,
          },
        });
      }

      const shootInterval = bot.weapon === "sniper" ? 900 : 280;
      const maxShootDistance = bot.weapon === "sniper" ? 80 : 50;
      const minShootDistance = 0.5;
      
      if (now - botState.lastShot > shootInterval && distance > minShootDistance && distance < maxShootDistance && bot.ammo > 0 && !bot.isReloading && canSeeTarget && botState.isAiming) {
        const baseAccuracy = bot.weapon === "sniper" ? 0.82 : 0.72;
        const distancePenalty = Math.min(0.30, distance * 0.008);
        const accuracy = baseAccuracy - distancePenalty;
        const hitChance = Math.random();
        
        const safeDist = Math.max(distance, 0.1);
        const direction = {
          x: dx / safeDist + (Math.random() - 0.5) * (1 - accuracy) * 0.5,
          y: (target.position.y + 1 - bot.position.y - 0.5) / safeDist,
          z: dz / safeDist + (Math.random() - 0.5) * (1 - accuracy) * 0.5,
        };

        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        if (magnitude < 0.01) {
          direction.x = 0;
          direction.y = 0;
          direction.z = 1;
        } else {
          direction.x /= magnitude;
          direction.y /= magnitude;
          direction.z /= magnitude;
        }

        const bullet = {
          id: `bullet_bot_${Date.now()}_${Math.random()}`,
          playerId: botId,
          position: { x: bot.position.x, y: bot.position.y + 1, z: bot.position.z },
          direction,
          weaponType: bot.weapon,
          damage: bot.weapon === "sniper" ? 50 : 20,
          speed: bot.weapon === "sniper" ? 80 : 50,
          size: 0.15,
        };

        currentRoom.bullets.push(bullet);
        bot.ammo--;

        if (targetWs) {
          this.send(targetWs, {
            type: "bullet_fired",
            payload: bullet,
          });
        }

        botState.lastShot = now;

        if (hitChance < accuracy && target.isAlive) {
          setTimeout(() => {
            const currentTarget = currentRoom.players.get(targetPlayerId);
            const currentBot = currentRoom.players.get(botId);
            if (currentTarget && currentTarget.isAlive && currentBot && currentBot.isAlive) {
              const stillCanSee = hasLineOfSight(
                currentBot.position.x, currentBot.position.y + 1, currentBot.position.z,
                currentTarget.position.x, currentTarget.position.y + 1, currentTarget.position.z
              );
              
              if (!stillCanSee) {
                return;
              }
              
              const bulletDamage = bot.weapon === "sniper" ? 50 : 20;
              currentTarget.health = Math.max(0, currentTarget.health - bulletDamage);

              if (currentTarget.health <= 0) {
                currentTarget.isAlive = false;
                currentBot.kills += 1;

                const playerWs = this.playerConnections.get(targetPlayerId);
                if (playerWs) {
                  this.send(playerWs, {
                    type: "player_killed",
                    payload: {
                      killedPlayerId: targetPlayerId,
                      killerPlayerId: botId,
                      killerKills: currentBot.kills,
                    },
                  });
                }

                // Use round-based logic (best of 3)
                const currentWins = currentRoom.roundState.playerWins.get(botId) || 0;
                currentRoom.roundState.playerWins.set(botId, currentWins + 1);
                
                const winsNeeded = Math.ceil(currentRoom.roundState.maxRounds / 2); // 2 for best of 3
                const botRoundWins = currentRoom.roundState.playerWins.get(botId) || 0;
                
                // Convert wins map to object for broadcasting
                const playerWinsObj: Record<string, number> = {};
                currentRoom.roundState.playerWins.forEach((wins, pid) => {
                  playerWinsObj[pid] = wins;
                });
                
                if (botRoundWins >= winsNeeded) {
                  // Match is over - bot won best of 3
                  currentRoom.status = "finished";
                  currentRoom.roundState.roundPhase = "match_over";
                  
                  if (room.botUpdateInterval) {
                    clearInterval(room.botUpdateInterval);
                    room.botUpdateInterval = undefined;
                  }
                  
                  if (playerWs) {
                    this.send(playerWs, {
                      type: "match_ended",
                      payload: {
                        winner: currentBot,
                        players: Array.from(currentRoom.players.values()),
                        roundState: {
                          currentRound: currentRoom.roundState.currentRound,
                          maxRounds: currentRoom.roundState.maxRounds,
                          playerWins: playerWinsObj,
                          roundPhase: "match_over",
                        },
                      },
                    });
                  }

                  this.saveMatchResults(currentRoom, currentBot);
                } else {
                  // Round is over but match continues
                  currentRoom.roundState.roundPhase = "round_over";
                  
                  if (room.botUpdateInterval) {
                    clearInterval(room.botUpdateInterval);
                    room.botUpdateInterval = undefined;
                  }
                  
                  if (playerWs) {
                    this.send(playerWs, {
                      type: "round_ended",
                      payload: {
                        roundWinner: currentBot,
                        currentRound: currentRoom.roundState.currentRound,
                        playerWins: playerWinsObj,
                        nextRound: currentRoom.roundState.currentRound + 1,
                      },
                    });
                  }
                  
                  // Start next round after 3 seconds
                  setTimeout(() => {
                    this.startNextRound(roomId);
                  }, 3000);
                }
              } else {
                const playerWs = this.playerConnections.get(targetPlayerId);
                if (playerWs) {
                  this.send(playerWs, {
                    type: "player_damaged",
                    payload: { playerId: targetPlayerId, health: currentTarget.health },
                  });
                }
              }
            }
          }, Math.max(100, (distance / bullet.speed) * 1000));
        }

        setTimeout(() => {
          const idx = currentRoom.bullets.findIndex((b) => b.id === bullet.id);
          if (idx > -1) {
            currentRoom.bullets.splice(idx, 1);
          }
        }, 3000);
      }

      if (bot.ammo <= 0 && !bot.isReloading) {
        bot.isReloading = true;
        const reloadTime = bot.weapon === "sniper" ? 1800 : 1000;
        
        if (botState.aiState === "ATTACK") {
          botState.aiState = "TAKE_COVER";
          botState.lastStateChange = now;
        }
        
        setTimeout(() => {
          const reloadedBot = currentRoom.players.get(botId);
          if (reloadedBot) {
            reloadedBot.ammo = reloadedBot.weapon === "sniper" ? 6 : 15;
            reloadedBot.isReloading = false;
          }
        }, reloadTime);
      }

      if (!bot.isReloading) {
        const shouldUseSniper = distance > 20;
        const shouldUsePistol = distance < 12;
        
        if (shouldUseSniper && bot.weapon === "pistol") {
          bot.weapon = "sniper";
          bot.ammo = 6;
          if (targetWs) {
            this.send(targetWs, {
              type: "player_weapon_switched",
              payload: { playerId: botId, weapon: bot.weapon, ammo: bot.ammo, isReloading: false },
            });
          }
        } else if (shouldUsePistol && bot.weapon === "sniper") {
          bot.weapon = "pistol";
          bot.ammo = 15;
          if (targetWs) {
            this.send(targetWs, {
              type: "player_weapon_switched",
              payload: { playerId: botId, weapon: bot.weapon, ammo: bot.ammo, isReloading: false },
            });
          }
        }
      }
    };

    room.botUpdateInterval = setInterval(botUpdate, 50);
  }

  private async handleJoinRoom(ws: WebSocket, payload: any) {
    const { roomId } = payload;
    const playerId = (ws as any).playerId;
    const odellId = (ws as any).odellId;

    if (!playerId) {
      this.send(ws, { type: "error", payload: { message: "Not authenticated" } });
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.send(ws, { type: "error", payload: { message: "Room not found" } });
      return;
    }

    if (room.players.size >= room.maxPlayers) {
      this.send(ws, { type: "error", payload: { message: "Room is full" } });
      return;
    }

    // Handle wager room entry fee
    if (room.roomType === "wager" && room.entryFee > 0) {
      try {
        const wallet = await getOrCreateWallet(odellId, payload.username || "Player");
        
        if (wallet.balance < room.entryFee) {
          this.send(ws, { 
            type: "error", 
            payload: { 
              message: "Insufficient balance to join this wager room",
              required: room.entryFee,
              current: wallet.balance,
            } 
          });
          return;
        }

        // Deduct entry fee (escrow) - this is the critical operation
        const updated = await updateWalletBalance(odellId, room.entryFee, "subtract");
        if (!updated) {
          this.send(ws, { type: "error", payload: { message: "Failed to process entry fee" } });
          return;
        }

        // Create transaction record - if this fails, rollback the balance change
        try {
          await createTransaction({
            odellId,
            type: "wager_entry",
            amount: room.entryFee,
            currency: "usd",
            status: "completed",
            metadata: {
              roomId,
              description: `Wager room entry fee $${(room.entryFee / 100).toFixed(2)}`,
            },
          });
        } catch (txError) {
          // Rollback: refund the entry fee
          console.error("Transaction record failed, rolling back balance:", txError);
          await updateWalletBalance(odellId, room.entryFee, "add");
          this.send(ws, { type: "error", payload: { message: "Failed to join wager room, funds refunded" } });
          return;
        }

        // Update escrow and prize pool
        room.escrowBalances.set(odellId, room.entryFee);
        room.prizePool += room.entryFee;
        
        const playerUsername = payload.username || `Player ${odellId.substring(0, 6)}`;
        console.log(`Player ${playerUsername} joined wager room ${roomId}. Entry fee: $${(room.entryFee / 100).toFixed(2)}, Total pot: $${(room.prizePool / 100).toFixed(2)}`);

        // Send updated wallet balance
        this.send(ws, {
          type: "wallet_updated",
          payload: { balance: updated.balance, coins: updated.coins },
        });
      } catch (error) {
        console.error("Error processing wager entry:", error);
        this.send(ws, { type: "error", payload: { message: "Failed to process entry fee" } });
        return;
      }
    }

    const player: Player = {
      id: playerId,
      odellId,
      username: payload.username || `Player ${odellId.substring(0, 6)}`,
      profilePicture: payload.profilePicture || null,
      position: { x: 42, y: 0.5, z: 0 },
      rotation: { x: 0, y: -Math.PI / 2 },
      health: 100,
      kills: 0,
      isAlive: true,
      weapon: "pistol",
      ammo: 12,
      isReloading: false,
    };

    room.players.set(playerId, player);
    this.playerToRoom.set(playerId, roomId);

    this.broadcast(roomId, {
      type: "player_joined",
      payload: { player },
    });

    this.send(ws, {
      type: "room_joined",
      payload: {
        roomId,
        playerId,
        players: Array.from(room.players.values()),
        status: room.status,
        roomType: room.roomType,
        entryFee: room.entryFee,
        prizePool: room.prizePool,
        readyPlayers: Array.from(room.readyPlayers),
      },
    });

    this.broadcastLobbyUpdate(room.experienceId);

    // Don't automatically start - wait for both players to ready up
    // Notify all players that room is now full and they can ready up
    if (room.players.size === room.maxPlayers && room.status === "waiting") {
      this.broadcast(roomId, {
        type: "room_full",
        payload: { 
          players: Array.from(room.players.values()),
          message: "Room is full! Both players can now ready up.",
        },
      });
    }
  }

  private handlePlayerReady(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) {
      console.log("Player ready: No room found for player", playerId);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      console.log("Player ready: Room not found", roomId);
      return;
    }

    room.readyPlayers.add(playerId);
    console.log(`Player ${playerId} is ready. Ready players: ${room.readyPlayers.size}/${room.players.size - (room.botIds?.length || 0)}`);

    if (room.isSinglePlayer) {
      if (!room.gameActive && room.botIds && room.botIds.length > 0) {
        room.gameActive = true;
        console.log("Single player: Player ready, starting bot AI");
        
        this.send(ws, {
          type: "game_active",
          payload: { message: "Game is now active!" },
        });

        const botId = room.botIds[0];
        this.startBotAI(roomId, botId, playerId);
      }
    } else {
      const humanPlayers = Array.from(room.players.values()).filter(p => !p.odellId.startsWith("bot"));
      
      this.broadcast(roomId, {
        type: "player_ready_status",
        payload: { 
          playerId,
          readyCount: room.readyPlayers.size,
          totalPlayers: humanPlayers.length,
          readyPlayers: Array.from(room.readyPlayers),
        },
      });

      const allReady = humanPlayers.every(p => room.readyPlayers.has(p.id));

      if (allReady && humanPlayers.length >= 2 && !room.gameActive) {
        console.log("Multiplayer: All players ready, starting 5 second countdown");
        
        this.broadcast(roomId, {
          type: "countdown_start",
          payload: { countdown: 5 },
        });

        let countdown = 5;
        const countdownInterval = setInterval(() => {
          countdown--;
          
          if (countdown > 0) {
            this.broadcast(roomId, {
              type: "countdown_tick",
              payload: { countdown },
            });
          } else {
            clearInterval(countdownInterval);
            room.gameActive = true;
            room.status = "playing";
            room.startedAt = Date.now();
            
            // Reset player stats for game start
            room.players.forEach((player) => {
              player.health = 100;
              player.isAlive = true;
              player.kills = 0;
            });
            
            console.log("Multiplayer: Countdown finished, game is now active");
            
            this.broadcast(roomId, {
              type: "game_started",
              payload: { 
                players: Array.from(room.players.values()),
                roomType: room.roomType,
                prizePool: room.prizePool,
                entryFee: room.entryFee,
              },
            });
          }
        }, 1000);
      }
    }
  }

  private handlePlayerUpdate(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.position = payload.position || player.position;
      player.rotation = payload.rotation || player.rotation;
      if (payload.ammo !== undefined) player.ammo = payload.ammo;
      if (payload.isReloading !== undefined) player.isReloading = payload.isReloading;

      this.broadcast(roomId, {
        type: "player_moved",
        payload: { 
          playerId, 
          position: player.position, 
          rotation: player.rotation,
          ammo: player.ammo,
          isReloading: player.isReloading,
        },
      }, playerId);
    }
  }

  private handleShoot(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.status !== "playing") return;

    const bullet = {
      id: `bullet_${Date.now()}_${Math.random()}`,
      playerId,
      position: payload.position,
      direction: payload.direction,
      weaponType: payload.weaponType || "pistol",
      damage: payload.damage || 20,
      speed: payload.speed || 50,
      size: payload.size || 0.15,
    };

    room.bullets.push(bullet);

    this.broadcast(roomId, {
      type: "bullet_fired",
      payload: bullet,
    });

    setTimeout(() => {
      const index = room.bullets.findIndex((b) => b.id === bullet.id);
      if (index > -1) {
        room.bullets.splice(index, 1);
      }
    }, 3000);
  }

  private handleWeaponSwitch(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.weapon = payload.weapon || "pistol";
      player.ammo = payload.ammo || 12;
      player.isReloading = false;

      this.broadcast(roomId, {
        type: "player_weapon_switched",
        payload: { playerId, weapon: player.weapon, ammo: player.ammo, isReloading: false },
      });
    }
  }

  private handleReloadStart(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) {
      console.log("Reload start: No room found for player", playerId);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      console.log("Reload start: Room not found", roomId);
      return;
    }

    const player = room.players.get(playerId);
    console.log("Reload start for player:", playerId, "isReloading:", player?.isReloading, "reloadTime:", payload.reloadTime, "maxAmmo:", payload.maxAmmo);
    
    if (player && !player.isReloading) {
      player.isReloading = true;

      this.broadcast(roomId, {
        type: "reload_started",
        payload: { playerId, reloadTime: payload.reloadTime },
      });

      const reloadTime = payload.reloadTime || 1500;
      console.log("Setting reload timeout for", reloadTime, "ms");
      
      setTimeout(() => {
        const reloadedPlayer = room.players.get(playerId);
        console.log("Reload timeout fired for player:", playerId, "still reloading:", reloadedPlayer?.isReloading);
        
        if (reloadedPlayer && reloadedPlayer.isReloading) {
          reloadedPlayer.ammo = payload.maxAmmo || 12;
          reloadedPlayer.isReloading = false;

          console.log("Reload completed, broadcasting. New ammo:", reloadedPlayer.ammo);
          this.broadcast(roomId, {
            type: "reload_completed",
            payload: { playerId, ammo: reloadedPlayer.ammo },
          });
        }
      }, reloadTime);
    } else {
      console.log("Reload skipped - player not found or already reloading");
    }
  }

  private handleReloadComplete(ws: WebSocket, payload: any) {
  }

  private handleHit(ws: WebSocket, payload: any) {
    const { targetPlayerId, damage } = payload;
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.status !== "playing") return;

    const targetPlayer = room.players.get(targetPlayerId);
    const shooterPlayer = room.players.get(playerId);

    if (targetPlayer && targetPlayer.isAlive && shooterPlayer) {
      targetPlayer.health = Math.max(0, targetPlayer.health - damage);

      if (targetPlayer.health <= 0) {
        targetPlayer.isAlive = false;
        shooterPlayer.kills += 1;

        this.broadcast(roomId, {
          type: "player_killed",
          payload: {
            killedPlayerId: targetPlayerId,
            killerPlayerId: playerId,
            killerKills: shooterPlayer.kills,
          },
        });

        const alivePlayers = Array.from(room.players.values()).filter((p) => p.isAlive);
        if (alivePlayers.length <= 1) {
          const roundWinner = alivePlayers[0] || shooterPlayer;
          
          // Increment round wins for the winner
          const currentWins = room.roundState.playerWins.get(roundWinner.id) || 0;
          room.roundState.playerWins.set(roundWinner.id, currentWins + 1);
          
          const winsNeeded = Math.ceil(room.roundState.maxRounds / 2); // 2 for best of 3
          const winnerRoundWins = room.roundState.playerWins.get(roundWinner.id) || 0;
          
          // Convert wins map to object for broadcasting
          const playerWinsObj: Record<string, number> = {};
          room.roundState.playerWins.forEach((wins, pid) => {
            playerWinsObj[pid] = wins;
          });
          
          if (winnerRoundWins >= winsNeeded) {
            // Match is over - this player won best of 3
            room.status = "finished";
            room.roundState.roundPhase = "match_over";
            
            if (room.botUpdateInterval) {
              clearInterval(room.botUpdateInterval);
              room.botUpdateInterval = undefined;
            }
            
            this.broadcast(roomId, {
              type: "match_ended",
              payload: {
                winner: roundWinner,
                players: Array.from(room.players.values()),
                roundState: {
                  currentRound: room.roundState.currentRound,
                  maxRounds: room.roundState.maxRounds,
                  playerWins: playerWinsObj,
                  roundPhase: "match_over",
                },
              },
            });
            
            this.saveMatchResults(room, roundWinner);
          } else {
            // Round is over but match continues
            room.roundState.roundPhase = "round_over";
            
            this.broadcast(roomId, {
              type: "round_ended",
              payload: {
                roundWinner,
                currentRound: room.roundState.currentRound,
                playerWins: playerWinsObj,
                nextRound: room.roundState.currentRound + 1,
              },
            });
            
            // Start next round after 3 seconds
            setTimeout(() => {
              this.startNextRound(roomId);
            }, 3000);
          }
        }
      } else {
        this.broadcast(roomId, {
          type: "player_damaged",
          payload: { playerId: targetPlayerId, health: targetPlayer.health },
        });
      }
    }
  }

  private startNextRound(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.status === "finished") return;
    
    room.roundState.currentRound += 1;
    room.roundState.roundPhase = "playing";
    room.bullets = [];
    
    let playerIndex = 0;
    const spawnPositions = [
      { x: -42, y: 0.5, z: 0, rotY: Math.PI / 2 },
      { x: 42, y: 0.5, z: 0, rotY: -Math.PI / 2 },
    ];

    room.players.forEach((player) => {
      const spawn = spawnPositions[playerIndex % 2];
      player.health = 100;
      player.isAlive = true;
      player.position = { x: spawn.x, y: spawn.y, z: spawn.z };
      player.rotation = { x: 0, y: spawn.rotY };
      player.weapon = "pistol";
      player.ammo = 12;
      player.isReloading = false;
      playerIndex++;
    });
    
    // Convert wins map to object for broadcasting
    const playerWinsObj: Record<string, number> = {};
    room.roundState.playerWins.forEach((wins, pid) => {
      playerWinsObj[pid] = wins;
    });

    this.broadcast(roomId, {
      type: "round_started",
      payload: {
        currentRound: room.roundState.currentRound,
        maxRounds: room.roundState.maxRounds,
        playerWins: playerWinsObj,
        players: Array.from(room.players.values()),
      },
    });
    
    // Restart bot AI if single player
    if (room.isSinglePlayer && room.botIds && room.botIds.length > 0) {
      const botId = room.botIds[0];
      const humanPlayer = Array.from(room.players.values()).find(p => !room.botIds?.includes(p.id));
      if (humanPlayer) {
        this.startBotAI(roomId, botId, humanPlayer.id);
      }
    }
  }

  private handleStartGame(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const roomId = this.playerToRoom.get(playerId);

    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.botUpdateInterval) {
      clearInterval(room.botUpdateInterval);
      room.botUpdateInterval = undefined;
    }

    room.bullets = [];

    room.status = "playing";
    room.startedAt = Date.now();
    room.gameActive = true;

    // Reset round state for new match
    room.roundState = {
      currentRound: 1,
      maxRounds: 3,
      playerWins: new Map(),
      roundPhase: "playing",
    };

    let playerIndex = 0;
    const spawnPositions = [
      { x: -42, y: 0.5, z: 0, rotY: Math.PI / 2 },
      { x: 42, y: 0.5, z: 0, rotY: -Math.PI / 2 },
    ];

    room.players.forEach((player) => {
      const spawn = spawnPositions[playerIndex % 2];
      player.health = 100;
      player.isAlive = true;
      player.kills = 0;
      player.position = { x: spawn.x, y: spawn.y, z: spawn.z };
      player.rotation = { x: 0, y: spawn.rotY };
      player.weapon = "pistol";
      player.ammo = 12;
      player.isReloading = false;
      playerIndex++;
    });

    this.broadcast(roomId, {
      type: "game_started",
      payload: { players: Array.from(room.players.values()) },
    });

    if (room.isSinglePlayer && room.botIds && room.botIds.length > 0) {
      const botId = room.botIds[0];
      this.startBotAI(roomId, botId, playerId);
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const playerId = (ws as any).playerId;
    if (!playerId) return;

    const roomId = this.playerToRoom.get(playerId);
    if (roomId) {
      this.removePlayerFromRoom(playerId, roomId);
    }

    this.playerConnections.delete(playerId);
  }

  private async removePlayerFromRoom(playerId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const experienceId = room.experienceId;
    const leavingPlayer = room.players.get(playerId);

    if (room.botUpdateInterval) {
      clearInterval(room.botUpdateInterval);
      room.botUpdateInterval = undefined;
    }

    // Handle wager refunds for rooms that haven't started
    if (room.roomType === "wager" && room.status === "waiting" && leavingPlayer) {
      const escrowAmount = room.escrowBalances.get(leavingPlayer.odellId);
      if (escrowAmount && escrowAmount > 0 && !room.escrowBalances.has("refunded_" + leavingPlayer.odellId)) {
        try {
          // Mark as refunded to prevent double refunds
          room.escrowBalances.set("refunded_" + leavingPlayer.odellId, escrowAmount);
          
          await updateWalletBalance(leavingPlayer.odellId, escrowAmount, "add");
          await createTransaction({
            odellId: leavingPlayer.odellId,
            type: "wager_refund",
            amount: escrowAmount,
            currency: "usd",
            status: "completed",
            metadata: {
              roomId,
              description: `Wager room refund (disconnect) $${(escrowAmount / 100).toFixed(2)}`,
            },
          });
          
          room.escrowBalances.delete(leavingPlayer.odellId);
          room.prizePool = Math.max(0, room.prizePool - escrowAmount);
          
          console.log(`Refunded $${(escrowAmount / 100).toFixed(2)} to ${leavingPlayer.odellId} on disconnect`);
        } catch (error) {
          console.error("Error refunding wager on disconnect:", error);
          // Remove the refunded marker on error
          room.escrowBalances.delete("refunded_" + leavingPlayer.odellId);
        }
      }
    }

    if (room.status === "playing" && room.players.size === 2) {
      const remainingPlayer = Array.from(room.players.values()).find(p => p.id !== playerId);
      if (remainingPlayer && !room.botIds?.includes(remainingPlayer.id)) {
        room.status = "finished";
        this.broadcast(roomId, {
          type: "game_ended",
          payload: {
            winner: remainingPlayer,
            players: Array.from(room.players.values()),
          },
        });
        
        this.saveMatchResults(room, remainingPlayer);
      } else if (room.isSinglePlayer) {
        room.status = "finished";
      }
    }

    room.players.delete(playerId);
    this.playerToRoom.delete(playerId);

    this.broadcast(roomId, {
      type: "player_left",
      payload: { playerId },
    });

    if (room.players.size === 0 || (room.isSinglePlayer && !room.botIds?.includes(playerId))) {
      if (room.botIds) {
        room.botIds.forEach(botId => {
          room.players.delete(botId);
        });
      }
      this.rooms.delete(roomId);
    }

    this.broadcastLobbyUpdate(experienceId);
  }

  private broadcast(roomId: string, message: any, excludePlayerId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.forEach((player) => {
      if (player.id !== excludePlayerId) {
        const ws = this.playerConnections.get(player.id);
        if (ws) {
          this.send(ws, message);
        }
      }
    });
  }

  private broadcastLobbyUpdate(experienceId: string) {
    const rooms = Array.from(this.rooms.values())
      .filter((room) => room.experienceId === experienceId && room.status === "waiting")
      .map((room) => ({
        id: room.id,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        roomType: room.roomType,
        entryFee: room.entryFee,
        prizePool: room.prizePool,
      }));

    this.playerConnections.forEach((ws, playerId) => {
      const wsExp = (ws as any).experienceId;
      const playerRoom = this.playerToRoom.get(playerId);
      
      if (wsExp === experienceId && !playerRoom) {
        this.send(ws, { type: "rooms_list", payload: { rooms } });
      }
    });
  }

  private send(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private async saveMatchResults(room: GameRoom, winner: Player | null) {
    try {
      const endTime = Date.now();
      const durationSeconds = room.startedAt 
        ? Math.floor((endTime - room.startedAt) / 1000)
        : 0;

      const allPlayers = Array.from(room.players.values());
      const loser = allPlayers.find(p => p.id !== winner?.id && p.odellId !== "bot");

      // Handle wager payouts
      if (room.roomType === "wager" && winner && winner.odellId !== "bot") {
        const platformFee = Math.floor(room.prizePool * (room.platformFeePercent / 100));
        const winnerPayout = room.prizePool - platformFee;

        try {
          // Pay winner
          const updatedWallet = await updateWalletBalance(winner.odellId, winnerPayout, "add");
          
          await createTransaction({
            odellId: winner.odellId,
            type: "wager_win",
            amount: winnerPayout,
            currency: "usd",
            status: "completed",
            metadata: {
              roomId: room.id,
              matchId: room.id,
              prizePool: room.prizePool,
              platformFee,
              description: `Won wager match - $${(winnerPayout / 100).toFixed(2)}`,
            },
          });

          // Update winner stats
          const winnerStats = await getOrCreatePlayerStats(winner.odellId, winner.username);
          const newWinStreak = winnerStats.currentWinStreak + 1;
          await updatePlayerStats(winner.odellId, {
            lastMatchAt: new Date(),
          }, {
            totalWins: 1,
            totalEarnings: winnerPayout,
            totalWagered: room.entryFee,
            currentWinStreak: 1,
            bestWinStreak: newWinStreak > winnerStats.bestWinStreak ? 1 : 0,
            totalKills: winner.kills,
            matchesPlayed: 1,
          });

          // Notify winner of payout
          const winnerWs = this.playerConnections.get(winner.id);
          if (winnerWs && updatedWallet) {
            this.send(winnerWs, {
              type: "wallet_updated",
              payload: { 
                balance: updatedWallet.balance, 
                coins: updatedWallet.coins,
                winnings: winnerPayout,
              },
            });
          }

          // Update loser stats
          if (loser) {
            const loserStats = await getOrCreatePlayerStats(loser.odellId, loser.username);
            await updatePlayerStats(loser.odellId, {
              currentWinStreak: 0,
              lastMatchAt: new Date(),
            }, {
              totalLosses: 1,
              totalWagered: room.entryFee,
              totalKills: loser.kills,
              totalDeaths: 1,
              matchesPlayed: 1,
            });
          }

          console.log(`Wager payout: ${winner.username} won $${(winnerPayout / 100).toFixed(2)} (fee: $${(platformFee / 100).toFixed(2)})`);
        } catch (error) {
          console.error("Error processing wager payout:", error);
        }
      }

      // Handle solo mode coins reward
      if (room.roomType === "solo" && winner && winner.odellId !== "bot") {
        const baseCoins = 75; // Base reward
        const bonusCoins = Math.floor(Math.random() * 50); // Random bonus 0-50
        const totalCoins = baseCoins + bonusCoins;

        try {
          const updatedWallet = await updateWalletCoins(winner.odellId, totalCoins, "add");
          
          await createTransaction({
            odellId: winner.odellId,
            type: "coin_earn",
            amount: totalCoins,
            currency: "coins",
            status: "completed",
            metadata: {
              roomId: room.id,
              description: `Solo victory reward: ${totalCoins} coins`,
            },
          });

          // Update stats
          const stats = await getOrCreatePlayerStats(winner.odellId, winner.username);
          const newWinStreak = stats.currentWinStreak + 1;
          await updatePlayerStats(winner.odellId, {
            lastMatchAt: new Date(),
          }, {
            soloWins: 1,
            coinsEarned: totalCoins,
            totalKills: winner.kills,
            matchesPlayed: 1,
            currentWinStreak: 1,
            bestWinStreak: newWinStreak > stats.bestWinStreak ? 1 : 0,
          });

          // Notify winner
          const winnerWs = this.playerConnections.get(winner.id);
          if (winnerWs && updatedWallet) {
            this.send(winnerWs, {
              type: "wallet_updated",
              payload: { 
                balance: updatedWallet.balance, 
                coins: updatedWallet.coins,
                coinsEarned: totalCoins,
              },
            });
          }

          console.log(`Solo reward: ${winner.username} earned ${totalCoins} coins`);
        } catch (error) {
          console.error("Error processing solo reward:", error);
        }
      }

      // Handle free room stats
      if (room.roomType === "free" && winner) {
        try {
          // Update winner stats
          if (winner.odellId !== "bot") {
            await updatePlayerStats(winner.odellId, {
              lastMatchAt: new Date(),
            }, {
              totalWins: 1,
              totalKills: winner.kills,
              matchesPlayed: 1,
            });
          }

          // Update loser stats  
          if (loser && loser.odellId !== "bot") {
            await updatePlayerStats(loser.odellId, {
              currentWinStreak: 0,
              lastMatchAt: new Date(),
            }, {
              totalLosses: 1,
              totalKills: loser.kills,
              totalDeaths: 1,
              matchesPlayed: 1,
            });
          }
        } catch (error) {
          console.error("Error updating free match stats:", error);
        }
      }

      // Save to MongoDB match collection
      try {
        await createMongoMatch({
          matchId: room.id,
          roomId: room.id,
          experienceId: room.experienceId,
          type: room.roomType,
          entryFee: room.entryFee,
          prizePool: room.prizePool,
          platformFee: Math.floor(room.prizePool * (room.platformFeePercent / 100)),
          winnerId: winner?.odellId || null,
          loserId: loser?.odellId || null,
          players: allPlayers.map(p => ({
            odellId: p.odellId,
            odellname: p.username,
            odells: p.kills,
            deaths: p.isAlive ? 0 : 1,
            damageDealt: 0,
          })),
          duration: durationSeconds,
          createdAt: room.startedAt ? new Date(room.startedAt) : new Date(),
          endedAt: new Date(endTime),
        });
      } catch (error) {
        console.error("Error saving to MongoDB:", error);
      }

    } catch (error) {
      console.error("Error saving match results:", error);
    }
  }

  private async handleGetWallet(ws: WebSocket, payload: any) {
    const odellId = (ws as any).odellId;
    const { username } = payload;

    try {
      const wallet = await getOrCreateWallet(odellId, username || "Player");
      this.send(ws, {
        type: "wallet_data",
        payload: {
          balance: wallet.balance,
          coins: wallet.coins,
        },
      });
    } catch (error) {
      console.error("Error getting wallet:", error);
      this.send(ws, { type: "error", payload: { message: "Failed to get wallet" } });
    }
  }

  private async handleGetEquippedSkins(ws: WebSocket, payload: any) {
    const odellId = (ws as any).odellId;

    try {
      const equipped = await getEquippedSkins(odellId);
      const result: { [key: string]: string } = {};
      
      equipped.forEach(eq => {
        result[eq.category] = eq.skinId;
      });

      this.send(ws, {
        type: "equipped_skins",
        payload: result,
      });
    } catch (error) {
      console.error("Error getting equipped skins:", error);
      this.send(ws, { type: "error", payload: { message: "Failed to get equipped skins" } });
    }
  }

  private async handleLeaveRoom(ws: WebSocket, payload: any) {
    const playerId = (ws as any).playerId;
    const odellId = (ws as any).odellId;
    const roomId = this.playerToRoom.get(playerId);

    if (roomId) {
      const room = this.rooms.get(roomId);
      
      // Refund wager if room hasn't started
      if (room && room.roomType === "wager" && room.status === "waiting") {
        const escrowAmount = room.escrowBalances.get(odellId);
        if (escrowAmount && escrowAmount > 0 && !room.escrowBalances.has("refunded_" + odellId)) {
          try {
            // Mark as refunded to prevent double refunds
            room.escrowBalances.set("refunded_" + odellId, escrowAmount);
            
            await updateWalletBalance(odellId, escrowAmount, "add");
            await createTransaction({
              odellId,
              type: "wager_refund",
              amount: escrowAmount,
              currency: "usd",
              status: "completed",
              metadata: {
                roomId,
                description: `Wager room refund $${(escrowAmount / 100).toFixed(2)}`,
              },
            });
            
            room.escrowBalances.delete(odellId);
            room.prizePool = Math.max(0, room.prizePool - escrowAmount);
            
            console.log(`Refunded $${(escrowAmount / 100).toFixed(2)} to ${odellId}`);
          } catch (error) {
            console.error("Error refunding wager:", error);
            // Remove the refunded marker on error
            room.escrowBalances.delete("refunded_" + odellId);
          }
        }
      }

      this.removePlayerFromRoom(playerId, roomId);
    }
  }
}
