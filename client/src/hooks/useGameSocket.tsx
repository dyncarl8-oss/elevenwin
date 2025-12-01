import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/lib/stores/useGameStore";

export function useGameSocket(experienceId: string, userToken: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const handleMessageRef = useRef<(message: any) => void>(() => {});
  const {
    setPlayerId,
    setUserId,
    setRoomId,
    setPhase,
    setPlayers,
    updatePlayer,
    removePlayer,
    addBullet,
    setRooms,
    setWinner,
    setConnected,
    setAmmo,
    setReloading,
    setCountdown,
    setOpponentInfo,
    setReadyPlayers,
    setRoundState,
    resetRoundState,
    setRoomType,
    setEntryFee,
    setPrizePool,
    setMatchWinnings,
    setSoloReward,
    setMyProfilePicture,
  } = useGameStore();

  const connect = useCallback(() => {
    if (!userToken) {
      console.log("No user token, skipping WebSocket connection");
      return;
    }

    const sessionToken = sessionStorage.getItem("session_token");
    if (!sessionToken && userToken !== "demo") {
      console.log("No session token available");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/game`;

    console.log("Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
      
      ws.send(
        JSON.stringify({
          type: "authenticate",
          payload: { sessionToken: sessionToken || userToken, experienceId },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessageRef.current(message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 3000);
    };
  }, [userToken, experienceId, setConnected]);

  const handleMessage = useCallback(
    (message: any) => {
      const { type, payload } = message;
      const currentPlayerId = useGameStore.getState().playerId;

      switch (type) {
        case "authenticated":
          console.log("Authenticated:", payload);
          setPlayerId(payload.playerId);
          setUserId(payload.userId);
          break;

        case "auth_error":
          console.error("Authentication error:", payload.message);
          sessionStorage.removeItem("session_token");
          sessionStorage.removeItem("user_id");
          window.location.reload();
          break;

        case "rooms_list":
          setRooms(payload.rooms);
          break;

        case "room_joined":
          console.log("Joined room:", payload);
          setRoomId(payload.roomId);
          setPlayers(payload.players);
          // Set wager info if available
          if (payload.roomType) {
            setRoomType(payload.roomType);
          }
          if (payload.entryFee !== undefined) {
            setEntryFee(payload.entryFee);
          }
          if (payload.prizePool !== undefined) {
            setPrizePool(payload.prizePool);
          }
          // Reset matchWinnings for new match
          setMatchWinnings(null);
          // Set ready players from the room state so joining player sees who's already ready
          if (payload.readyPlayers) {
            setReadyPlayers(payload.readyPlayers);
          }
          // Set player info from existing players in the room
          // Use payload.playerId first (from server response), then fall back to store state
          const myId = payload.playerId || useGameStore.getState().playerId;
          const myPlayer = payload.players.find((p: any) => p.id === myId);
          const opponent = payload.players.find((p: any) => p.id !== myId);
          // Set my own profile picture
          if (myPlayer?.profilePicture) {
            setMyProfilePicture(myPlayer.profilePicture);
          }
          // Set opponent info
          if (opponent) {
            setOpponentInfo({
              username: opponent.username,
              profilePicture: opponent.profilePicture || null,
              isBot: opponent.username?.includes("Bot") || false,
            });
          }
          // Don't change phase to waiting here - let VsScreen handle the transition
          // Only change if game is already playing (joining mid-game)
          if (payload.status === "playing") {
            setPhase("playing");
          }
          break;

        case "player_joined":
          console.log("Player joined:", payload.player);
          updatePlayer(payload.player.id, payload.player);
          if (payload.player.id !== currentPlayerId) {
            setOpponentInfo({
              username: payload.player.username,
              profilePicture: payload.player.profilePicture || null,
              isBot: payload.player.username?.includes("Bot") || false,
            });
          }
          break;

        case "player_left":
          console.log("Player left:", payload.playerId);
          removePlayer(payload.playerId);
          // If the player who left is not us, clear opponent info and reset ready state
          if (payload.playerId !== currentPlayerId) {
            setOpponentInfo({ username: "Waiting...", isBot: false });
            setReadyPlayers([]);
            setCountdown(null);
          }
          break;

        case "game_started":
          console.log("Game started - waiting for VsScreen countdown to complete");
          setPlayers(payload.players);
          // Reset round state for new match
          resetRoundState();
          // Reset match rewards for new match
          setMatchWinnings(null);
          setSoloReward(null);
          // Don't immediately change phase - let VsScreen complete the countdown animation
          // The countdown reaching 0 will trigger the phase change via VsScreen onComplete
          setCountdown(0);
          break;

        case "player_moved":
          updatePlayer(payload.playerId, {
            position: payload.position,
            rotation: payload.rotation,
            ammo: payload.ammo,
            isReloading: payload.isReloading,
          });
          break;

        case "bullet_fired":
          addBullet(payload);
          break;

        case "player_weapon_switched":
          updatePlayer(payload.playerId, { 
            weapon: payload.weapon,
            ammo: payload.ammo,
            isReloading: payload.isReloading,
          });
          break;

        case "reload_started":
          console.log("Reload started for player:", payload.playerId, "reload time:", payload.reloadTime);
          updatePlayer(payload.playerId, { isReloading: true });
          if (payload.playerId === currentPlayerId) {
            setReloading(true);
          }
          break;

        case "reload_completed":
          console.log("Reload completed for player:", payload.playerId, "new ammo:", payload.ammo, "currentPlayerId:", currentPlayerId);
          updatePlayer(payload.playerId, { ammo: payload.ammo, isReloading: false });
          if (payload.playerId === currentPlayerId) {
            console.log("Updating local player ammo to:", payload.ammo);
            setAmmo(payload.ammo);
            setReloading(false);
          }
          break;

        case "player_damaged":
          updatePlayer(payload.playerId, { health: payload.health });
          break;

        case "player_killed":
          updatePlayer(payload.killedPlayerId, { isAlive: false, health: 0 });
          updatePlayer(payload.killerPlayerId, { kills: payload.killerKills });
          break;

        case "game_ended":
          console.log("Game ended:", payload);
          setPhase("finished");
          setWinner(payload.winner);
          break;

        case "wallet_updated":
          console.log("Wallet updated:", payload);
          // Store winnings if this is from a wager match win
          if (payload.winnings !== undefined) {
            setMatchWinnings(payload.winnings);
          }
          // Store coins earned from solo match win
          if (payload.coinsEarned !== undefined) {
            setSoloReward(payload.coinsEarned);
          }
          break;

        case "round_ended": {
          console.log("Round ended:", payload);
          const myId = useGameStore.getState().playerId;
          const playerWins = payload.playerWins || {};
          const myWins = myId ? (playerWins[myId] || 0) : 0;
          const opponentWins = Object.entries(playerWins)
            .filter(([id]) => id !== myId)
            .reduce((sum, [, wins]) => sum + (wins as number), 0);
          
          setRoundState({
            currentRound: payload.currentRound,
            playerWins: myWins,
            opponentWins: opponentWins,
            roundPhase: "round_over",
          });
          break;
        }

        case "round_started": {
          console.log("Round started:", payload);
          setPlayers(payload.players);
          const myId = useGameStore.getState().playerId;
          const playerWins = payload.playerWins || {};
          const myWins = myId ? (playerWins[myId] || 0) : 0;
          const opponentWins = Object.entries(playerWins)
            .filter(([id]) => id !== myId)
            .reduce((sum, [, wins]) => sum + (wins as number), 0);
          
          setRoundState({
            currentRound: payload.currentRound,
            maxRounds: payload.maxRounds,
            playerWins: myWins,
            opponentWins: opponentWins,
            roundPhase: "playing",
          });
          break;
        }

        case "match_ended": {
          console.log("Match ended:", payload);
          const myId = useGameStore.getState().playerId;
          const roundState = payload.roundState || {};
          const playerWins = roundState.playerWins || {};
          const myWins = myId ? (playerWins[myId] || 0) : 0;
          const opponentWins = Object.entries(playerWins)
            .filter(([id]) => id !== myId)
            .reduce((sum, [, wins]) => sum + (wins as number), 0);
          
          setRoundState({
            currentRound: roundState.currentRound,
            maxRounds: roundState.maxRounds,
            playerWins: myWins,
            opponentWins: opponentWins,
            roundPhase: "match_over",
          });
          setPhase("finished");
          setWinner(payload.winner);
          break;
        }

        case "game_active":
          console.log("Game is now active:", payload.message);
          break;

        case "countdown_start":
          console.log("Countdown started:", payload.countdown);
          setCountdown(payload.countdown);
          break;

        case "countdown_tick":
          console.log("Countdown tick:", payload.countdown);
          setCountdown(payload.countdown);
          break;

        case "player_ready_status":
          console.log("Player ready status:", payload);
          setReadyPlayers(payload.readyPlayers || []);
          break;

        case "room_full":
          console.log("Room is full, players can ready up:", payload);
          setPlayers(payload.players);
          break;

        case "error":
          console.error("Server error:", payload.message);
          break;

        default:
          console.warn("Unknown message type:", type);
      }
    },
    [
      setPlayerId,
      setUserId,
      setRoomId,
      setPhase,
      setPlayers,
      updatePlayer,
      removePlayer,
      addBullet,
      setRooms,
      setWinner,
      setAmmo,
      setReloading,
      setCountdown,
      setOpponentInfo,
      setReadyPlayers,
    ]
  );

  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("WebSocket not connected");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { sendMessage };
}
