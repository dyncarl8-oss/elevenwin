import { storage } from "./storage";
import { logger } from "./logger";
import { initializeChessBoard } from "./chess-logic";

// Game initialization functions that can be shared between routes and websocket

export async function initializeYahtzeeGame(gameId: string) {
  try {
    const participants = await storage.getGameParticipants(gameId);
    const game = await storage.getGame(gameId);
    
    // Guard against premature initialization
    if (!game || participants.length === 0) {
      logger.debug(`Init Guard: Cannot initialize - missing game or no participants`);
      return;
    }
    
    // Check if yahtzee player states already exist to prevent duplicate initialization
    const existingStates = await storage.getYahtzeeGameStates(gameId);
    if (existingStates && existingStates.length > 0) {
      logger.debug(`Init Guard: Game ${gameId} already has yahtzee player states, skipping initialization`);
      return;
    }
    
    if (participants.length < game.maxPlayers) {
      logger.debug(`Init Guard: Game ${gameId} not full (${participants.length}/${game.maxPlayers}), cannot start`);
      return;
    }

    logger.debug(`Init Guard: Starting game ${gameId} with ${participants.length}/${game.maxPlayers} players`);
    
    // Initialize Yahtzee player states for all participants FIRST
    for (const participant of participants) {
      await storage.createYahtzeePlayerState({
        gameId,
        userId: participant.userId,
      });
    }

    // Set first player as current turn player and start round 1
    const firstPlayerId = participants[0].userId;
    await storage.updateGameTurn(gameId, 1, firstPlayerId);

    // Create the first turn for the first player
    const firstTurn = await storage.createYahtzeeTurn({
      gameId,
      userId: firstPlayerId,
      round: 1,
    });

    // Verify turn was created successfully before proceeding
    if (!firstTurn) {
      logger.error(`Failed to create first turn for game ${gameId}`);
      throw new Error('Failed to initialize game turn');
    }

    // ONLY NOW update game status to running - all required data is ready
    if (game.status !== "running") {
      await storage.updateGameStatus(gameId, "running");
    }

    logger.info(`Initialized Yahtzee game ${gameId}`);
  } catch (error) {
    console.error("Error initializing Yahtzee game:", error);
  }
}

export async function initializeChessGame(gameId: string) {
  try {
    const participants = await storage.getGameParticipants(gameId);
    const game = await storage.getGame(gameId);
    
    if (!game || participants.length === 0) {
      logger.debug(`Chess Init: Cannot initialize - missing game or no participants`);
      return;
    }
    
    // Check if chess state already exists to prevent duplicate initialization
    const existingChessState = await storage.getChessGameState(gameId);
    if (existingChessState) {
      logger.debug(`Chess Init: Game ${gameId} already has chess state, skipping initialization`);
      return;
    }
    
    if (participants.length < 2) {
      logger.debug(`Chess Init: Chess game ${gameId} needs 2 players (currently ${participants.length})`);
      return;
    }

    logger.debug(`Chess Init: Starting chess game ${gameId} with ${participants.length} players`);
    
    // Only update status to running if it's not already running
    if (game.status !== "running") {
      await storage.updateGameStatus(gameId, "running");
    }

    const whitePlayerId = participants[0].userId;
    const blackPlayerId = participants[1].userId;
    
    const initialBoard = initializeChessBoard();
    
    await storage.createChessGameState({
      gameId,
      boardState: JSON.stringify(initialBoard),
      whitePlayerId,
      blackPlayerId,
      currentTurn: "white",
      gameStatus: "in_progress",
      whiteKingsideCastle: true,
      whiteQueensideCastle: true,
      blackKingsideCastle: true,
      blackQueensideCastle: true,
      enPassantTarget: null,
      moveCount: 0,
      halfmoveClock: 0,
      capturedPieces: "[]",
    });
    
    logger.info(`Initialized Chess game ${gameId}`);
  } catch (error) {
    console.error("Error initializing Chess game:", error);
  }
}
