import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { initializeChessGame, initializeYahtzeeGame } from "./game-init";

interface GameRoom {
  gameId: string;
  clients: Set<WebSocket>;
}

interface TournamentRoom {
  tournamentId: string;
  clients: Set<WebSocket>;
}

interface ConnectedUser {
  userId: string;
  username: string;
  ws: WebSocket;
  lastSeen: Date;
}

class GameWebSocketServer {
  private wss: WebSocketServer;
  private gameRooms: Map<string, GameRoom>;
  private tournamentRooms: Map<string, TournamentRoom>;
  private connectedUsers: Map<string, ConnectedUser>;
  private tournamentTimers: Map<string, NodeJS.Timeout>;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.gameRooms = new Map();
    this.tournamentRooms = new Map();
    this.connectedUsers = new Map();
    this.tournamentTimers = new Map();
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws: WebSocket, req) => {
      console.log("WebSocket client connected");

      ws.on("message", async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      });

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
        this.removeClientFromRooms(ws);
        this.removeUserConnection(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });
  }

  private async handleMessage(ws: WebSocket, data: any) {
    const { type, gameId, userId, username, tournamentId } = data;

    switch (type) {
      case "authenticate":
        await this.authenticateUser(ws, userId, username);
        break;
      case "join_game_room":
        this.joinGameRoom(ws, gameId);
        break;
      case "leave_game_room":
        this.leaveGameRoom(ws, gameId);
        break;
      case "join_tournament_room":
        await this.joinTournamentRoom(ws, tournamentId);
        break;
      case "leave_tournament_room":
        this.leaveTournamentRoom(ws, tournamentId);
        break;
      case "get_game_state":
        await this.sendGameState(ws, gameId);
        break;
      case "get_invitations":
        await this.sendUserInvitations(ws, userId);
        break;
    }
  }

  private joinGameRoom(ws: WebSocket, gameId: string) {
    if (!this.gameRooms.has(gameId)) {
      this.gameRooms.set(gameId, {
        gameId,
        clients: new Set(),
      });
    }

    const room = this.gameRooms.get(gameId)!;
    room.clients.add(ws);
    
    console.log(`Client joined game room: ${gameId}`);
  }

  private leaveGameRoom(ws: WebSocket, gameId: string) {
    const room = this.gameRooms.get(gameId);
    if (room) {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        this.gameRooms.delete(gameId);
      }
    }
  }

  private async joinTournamentRoom(ws: WebSocket, tournamentId: string) {
    if (!this.tournamentRooms.has(tournamentId)) {
      this.tournamentRooms.set(tournamentId, {
        tournamentId,
        clients: new Set(),
      });
    }

    const room = this.tournamentRooms.get(tournamentId)!;
    room.clients.add(ws);
    
    console.log(`Client joined tournament room: ${tournamentId}`);
    
    // Check if tournament has an active countdown and send it to the new client
    try {
      const tournament = await storage.getTournament(tournamentId);
      if (tournament && tournament.startingAt && tournament.status === 'active') {
        const countdownMessage = JSON.stringify({
          type: "tournament_countdown",
          data: {
            tournamentId,
            tournamentName: tournament.name,
            startingAt: tournament.startingAt.toISOString(),
          },
        });
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(countdownMessage);
          console.log(`Sent active countdown to newly joined client for tournament ${tournamentId}`);
        }
      }
    } catch (error) {
      console.error(`Error sending countdown to new tournament room client: ${error}`);
    }
  }

  private leaveTournamentRoom(ws: WebSocket, tournamentId: string) {
    const room = this.tournamentRooms.get(tournamentId);
    if (room) {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        this.tournamentRooms.delete(tournamentId);
      }
    }
  }

  private removeClientFromRooms(ws: WebSocket) {
    for (const [gameId, room] of Array.from(this.gameRooms.entries())) {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        this.gameRooms.delete(gameId);
      }
    }
    
    for (const [tournamentId, room] of Array.from(this.tournamentRooms.entries())) {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        this.tournamentRooms.delete(tournamentId);
      }
    }
  }

  private async sendGameState(ws: WebSocket, gameId: string) {
    try {
      const game = await storage.getGame(gameId);
      const participants = await storage.getGameParticipants(gameId);
      
      if (game) {
        ws.send(JSON.stringify({
          type: "game_state",
          data: {
            game,
            participants: participants.length,
          },
        }));
      }
    } catch (error) {
      console.error("Error sending game state:", error);
    }
  }

  // Broadcast game updates to all clients in a room
  public async broadcastGameUpdate(gameId: string) {
    const room = this.gameRooms.get(gameId);
    if (!room) return;

    try {
      const game = await storage.getGame(gameId);
      const participants = await storage.getGameParticipants(gameId);

      if (game) {
        const updateMessage = JSON.stringify({
          type: "game_update",
          data: {
            game,
            participants: participants.length,
          },
        });

        room.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(updateMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error broadcasting game update:", error);
    }
  }

  // Broadcast winner announcement
  public async broadcastWinnerAnnouncement(gameId: string, winnerId: string) {
    const room = this.gameRooms.get(gameId);
    if (!room) return;

    try {
      const game = await storage.getGame(gameId);
      const winner = await storage.getUser(winnerId);

      if (game && winner) {
        const winnerMessage = JSON.stringify({
          type: "winner_announced",
          data: {
            gameId,
            gameName: game.name,
            winner: {
              id: winner.id,
              username: winner.username,
            },
            prizeAmount: game.prizeAmount,
          },
        });

        room.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(winnerMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error broadcasting winner announcement:", error);
    }
  }

  // Broadcast forfeit notification
  public async broadcastForfeitNotification(gameId: string, forfeitedUserId: string) {
    const room = this.gameRooms.get(gameId);
    if (!room) return;

    try {
      const game = await storage.getGame(gameId);
      const forfeitedUser = await storage.getUser(forfeitedUserId);

      if (game && forfeitedUser) {
        const forfeitMessage = JSON.stringify({
          type: "player_forfeited",
          data: {
            gameId,
            gameName: game.name,
            forfeitedPlayer: {
              id: forfeitedUser.id,
              username: forfeitedUser.username,
            },
          },
        });

        room.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(forfeitMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error broadcasting forfeit notification:", error);
    }
  }

  // Broadcast AI action for visual feedback
  public async broadcastAIAction(gameId: string, aiUserId: string, action: {
    type: 'rolling' | 'holding' | 'scoring' | 'thinking';
    message: string;
    holdPattern?: boolean[];
    category?: string;
    diceValues?: number[];
  }) {
    const room = this.gameRooms.get(gameId);
    if (!room) return;

    try {
      const aiUser = await storage.getUser(aiUserId);
      if (aiUser) {
        const actionMessage = JSON.stringify({
          type: "ai_action",
          data: {
            gameId,
            playerId: aiUserId,
            playerName: aiUser.username,
            action: action.type,
            message: action.message,
            holdPattern: action.holdPattern,
            category: action.category,
            diceValues: action.diceValues,
            timestamp: Date.now(),
          },
        });

        room.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(actionMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error broadcasting AI action:", error);
    }
  }

  // Broadcast tournament countdown
  public async broadcastTournamentCountdown(tournamentId: string, startingAt: Date) {
    const room = this.tournamentRooms.get(tournamentId);
    if (!room) return;

    try {
      const tournament = await storage.getTournament(tournamentId);
      if (tournament) {
        const countdownMessage = JSON.stringify({
          type: "tournament_countdown",
          data: {
            tournamentId,
            tournamentName: tournament.name,
            startingAt: startingAt.toISOString(),
          },
        });

        room.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(countdownMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error broadcasting tournament countdown:", error);
    }
  }

  // Broadcast tournament start
  public async broadcastTournamentStart(tournamentId: string) {
    const room = this.tournamentRooms.get(tournamentId);
    if (!room) return;

    try {
      const tournament = await storage.getTournament(tournamentId);
      if (tournament) {
        const startMessage = JSON.stringify({
          type: "tournament_started",
          data: {
            tournamentId,
            tournamentName: tournament.name,
            gameId: tournament.gameId,
            gameType: tournament.gameType,
          },
        });

        room.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(startMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error broadcasting tournament start:", error);
    }
  }

  // Schedule tournament start
  public scheduleTournamentStart(tournamentId: string, startingAt: Date) {
    // Clear any existing timer
    const existingTimer = this.tournamentTimers.get(tournamentId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = startingAt.getTime() - Date.now();
    
    if (delay > 0) {
      const timer = setTimeout(async () => {
        try {
          console.log(`Starting tournament ${tournamentId}...`);
          const tournament = await storage.getTournament(tournamentId);
          
          // Only start if still in active status
          if (tournament && tournament.status === 'active' && tournament.startingAt) {
            const game = await storage.startTournament(tournamentId);
            console.log(`Auto-started tournament ${tournamentId}, created game ${game.id}`);
            
            // Initialize the game based on game type
            if (game.gameType === "chess") {
              await initializeChessGame(game.id);
              console.log(`Initialized chess game ${game.id} for tournament ${tournamentId}`);
            } else if (game.gameType === "yahtzee") {
              await initializeYahtzeeGame(game.id);
              console.log(`Initialized yahtzee game ${game.id} for tournament ${tournamentId}`);
            }
            
            // Broadcast tournament start
            await this.broadcastTournamentStart(tournamentId);
          }
        } catch (error) {
          console.error(`Error auto-starting tournament ${tournamentId}:`, error);
        } finally {
          this.tournamentTimers.delete(tournamentId);
        }
      }, delay);
      
      this.tournamentTimers.set(tournamentId, timer);
      console.log(`Scheduled tournament ${tournamentId} to start in ${delay}ms`);
    } else {
      console.log(`Tournament ${tournamentId} start time has already passed`);
    }
  }

  // User authentication and tracking
  private async authenticateUser(ws: WebSocket, userId: string, username: string) {
    try {
      // Verify user exists in storage
      const user = await storage.getUser(userId);
      if (user) {
        // Update user activity
        await storage.updateUserActivity(userId);
        
        // Store user connection
        this.connectedUsers.set(userId, {
          userId,
          username: user.username,
          ws,
          lastSeen: new Date(),
        });

        // Send authentication confirmation
        ws.send(JSON.stringify({
          type: "authenticated",
          data: {
            userId,
            username: user.username,
          },
        }));

        // Send pending invitations
        await this.sendUserInvitations(ws, userId);
        
        console.log(`User authenticated: ${user.username} (${userId})`);
      } else {
        ws.send(JSON.stringify({
          type: "authentication_failed",
          error: "User not found",
        }));
      }
    } catch (error) {
      console.error("Authentication error:", error);
      ws.send(JSON.stringify({
        type: "authentication_failed",
        error: "Authentication failed",
      }));
    }
  }

  private removeUserConnection(ws: WebSocket) {
    for (const [userId, user] of Array.from(this.connectedUsers.entries())) {
      if (user.ws === ws) {
        this.connectedUsers.delete(userId);
        console.log(`User disconnected: ${user.username} (${userId})`);
        break;
      }
    }
  }

  private async sendUserInvitations(ws: WebSocket, userId: string) {
    try {
      const invitations = await storage.getUserInvitations(userId, "pending");
      
      if (invitations.length > 0) {
        // Populate invitation data with game and sender info
        const enrichedInvitations = await Promise.all(
          invitations.map(async (invitation) => {
            const game = await storage.getGame(invitation.gameId);
            const sender = await storage.getUser(invitation.fromUserId);
            
            return {
              ...invitation,
              game: game ? {
                id: game.id,
                name: game.name,
                entryFee: game.entryFee,
                maxPlayers: game.maxPlayers,
                currentPlayers: game.currentPlayers,
              } : null,
              sender: sender ? {
                id: sender.id,
                username: sender.username,
                profileImageUrl: sender.profileImageUrl,
              } : null,
            };
          })
        );

        ws.send(JSON.stringify({
          type: "invitations",
          data: enrichedInvitations,
        }));
      }
    } catch (error) {
      console.error("Error sending user invitations:", error);
    }
  }

  // Send invitation notification to specific user
  public async sendInvitationNotification(toUserId: string, invitation: any) {
    const userConnection = this.connectedUsers.get(toUserId);
    if (!userConnection || userConnection.ws.readyState !== WebSocket.OPEN) {
      console.log(`User ${toUserId} not connected - invitation will be stored for later`);
      return;
    }

    try {
      // Get game and sender information
      const game = await storage.getGame(invitation.gameId);
      const sender = await storage.getUser(invitation.fromUserId);

      if (game && sender) {
        const notificationData = {
          type: "invitation_received",
          data: {
            ...invitation,
            game: {
              id: game.id,
              name: game.name,
              entryFee: game.entryFee,
              maxPlayers: game.maxPlayers,
              currentPlayers: game.currentPlayers,
            },
            sender: {
              id: sender.id,
              username: sender.username,
              profileImageUrl: sender.profileImageUrl,
            },
          },
        };

        userConnection.ws.send(JSON.stringify(notificationData));
        console.log(`Invitation notification sent to ${userConnection.username}`);
      }
    } catch (error) {
      console.error("Error sending invitation notification:", error);
    }
  }

  // Get list of online users for invitation purposes
  public getOnlineUsers(): { userId: string; username: string; lastSeen: Date }[] {
    return Array.from(this.connectedUsers.values()).map(user => ({
      userId: user.userId,
      username: user.username,
      lastSeen: user.lastSeen,
    }));
  }

  // Send balance update to specific user
  public async sendBalanceUpdate(userId: string) {
    const userConnection = this.connectedUsers.get(userId);
    if (!userConnection || userConnection.ws.readyState !== WebSocket.OPEN) {
      console.log(`User ${userId} not connected - balance update will be available on next refresh`);
      return;
    }

    try {
      const user = await storage.getUser(userId);
      if (user) {
        const balanceUpdateMessage = JSON.stringify({
          type: "balance_update",
          data: {
            userId: user.id,
            balance: user.balance,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            totalWinnings: user.totalWinnings,
          },
        });

        userConnection.ws.send(balanceUpdateMessage);
        console.log(`Balance update sent to ${userConnection.username}: $${user.balance}`);
      }
    } catch (error) {
      console.error("Error sending balance update:", error);
    }
  }
}

let wsServer: GameWebSocketServer | null = null;

export function setupWebSocket(server: HttpServer) {
  wsServer = new GameWebSocketServer(server);
  return wsServer;
}

export function getWebSocketServer(): GameWebSocketServer | null {
  return wsServer;
}