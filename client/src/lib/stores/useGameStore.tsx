import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { WeaponType } from "../weapons";

export interface Player {
  id: string;
  userId: string;
  username: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  kills: number;
  isAlive: boolean;
  weapon: WeaponType;
  ammo: number;
  isReloading: boolean;
}

export interface Bullet {
  id: string;
  playerId: string;
  position: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  weaponType: WeaponType;
  damage: number;
  speed: number;
  size: number;
}

export interface Room {
  id: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  roomType?: "free" | "wager" | "solo";
  entryFee?: number;
  prizePool?: number;
}

type GamePhase = "lobby" | "vsscreen" | "waiting" | "playing" | "finished";
type GameMode = "singleplayer" | "multiplayer" | null;

export interface OpponentInfo {
  username: string;
  profilePicture?: string | null;
  isBot?: boolean;
}

export interface EquippedSkins {
  sniper: string | null;
  pistol: string | null;
  crosshair: string | null;
}

export interface RoundState {
  currentRound: number;
  maxRounds: number;
  playerWins: number;
  opponentWins: number;
  roundPhase: "playing" | "round_over" | "match_over";
}

interface GameState {
  phase: GamePhase;
  playerId: string | null;
  userId: string | null;
  roomId: string | null;
  players: Map<string, Player>;
  bullets: Bullet[];
  rooms: Room[];
  winner: Player | null;
  isConnected: boolean;
  currentWeapon: WeaponType;
  ammo: number;
  isReloading: boolean;
  isScoping: boolean;
  countdown: number | null;
  lastShotTime: number;
  equippedSkins: EquippedSkins;
  gameMode: GameMode;
  opponentInfo: OpponentInfo | null;
  assetsPreloaded: boolean;
  readyPlayers: string[];
  roundState: RoundState;
  pendingRestart: boolean;
  roomType: "free" | "wager" | "solo" | null;
  entryFee: number;
  prizePool: number;
  matchWinnings: number | null;
  soloReward: number | null;
  myProfilePicture: string | null;

  setPhase: (phase: GamePhase) => void;
  setPlayerId: (playerId: string) => void;
  setUserId: (userId: string) => void;
  setRoomId: (roomId: string | null) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  addBullet: (bullet: Bullet) => void;
  removeBullet: (bulletId: string) => void;
  setRooms: (rooms: Room[]) => void;
  setWinner: (winner: Player | null) => void;
  setConnected: (connected: boolean) => void;
  setCurrentWeapon: (weapon: WeaponType) => void;
  setAmmo: (ammo: number) => void;
  setReloading: (reloading: boolean) => void;
  setScoping: (scoping: boolean) => void;
  setCountdown: (countdown: number | null) => void;
  triggerShot: () => void;
  setEquippedSkins: (skins: EquippedSkins) => void;
  setGameMode: (mode: GameMode) => void;
  setOpponentInfo: (info: OpponentInfo | null) => void;
  setAssetsPreloaded: (preloaded: boolean) => void;
  setReadyPlayers: (players: string[]) => void;
  setRoundState: (state: Partial<RoundState>) => void;
  resetRoundState: () => void;
  setPendingRestart: (pending: boolean) => void;
  setRoomType: (roomType: "free" | "wager" | "solo" | null) => void;
  setEntryFee: (fee: number) => void;
  setPrizePool: (pool: number) => void;
  setMatchWinnings: (winnings: number | null) => void;
  setSoloReward: (reward: number | null) => void;
  setMyProfilePicture: (picture: string | null) => void;
  reset: () => void;
}

const initialRoundState: RoundState = {
  currentRound: 1,
  maxRounds: 3,
  playerWins: 0,
  opponentWins: 0,
  roundPhase: "playing",
};

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set) => ({
    phase: "lobby",
    playerId: null,
    userId: null,
    roomId: null,
    players: new Map(),
    bullets: [],
    rooms: [],
    winner: null,
    isConnected: false,
    currentWeapon: "sniper",
    ammo: 5,
    isReloading: false,
    isScoping: false,
    countdown: null,
    lastShotTime: 0,
    equippedSkins: { sniper: null, pistol: null, crosshair: null },
    gameMode: null,
    opponentInfo: null,
    assetsPreloaded: false,
    readyPlayers: [],
    roundState: { ...initialRoundState },
    pendingRestart: false,
    roomType: null,
    entryFee: 0,
    prizePool: 0,
    matchWinnings: null,
    soloReward: null,
    myProfilePicture: null,

    setPhase: (phase) => set({ phase }),
    setPlayerId: (playerId) => set({ playerId }),
    setUserId: (userId) => set({ userId }),
    setRoomId: (roomId) => set({ roomId }),

    setPlayers: (players) =>
      set({ players: new Map(players.map((p) => [p.id, p])) }),

    updatePlayer: (playerId, updates) =>
      set((state) => {
        const newPlayers = new Map(state.players);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, { ...player, ...updates });
        }
        return { players: newPlayers };
      }),

    removePlayer: (playerId) =>
      set((state) => {
        const newPlayers = new Map(state.players);
        newPlayers.delete(playerId);
        return { players: newPlayers };
      }),

    addBullet: (bullet) =>
      set((state) => ({ bullets: [...state.bullets, bullet] })),

    removeBullet: (bulletId) =>
      set((state) => ({
        bullets: state.bullets.filter((b) => b.id !== bulletId),
      })),

    setRooms: (rooms) => set({ rooms }),
    setWinner: (winner) => set({ winner }),
    setConnected: (connected) => set({ isConnected: connected }),
    setCurrentWeapon: (weapon) => set({ currentWeapon: weapon }),
    setAmmo: (ammo) => set({ ammo }),
    setReloading: (reloading) => set({ isReloading: reloading }),
    setScoping: (scoping) => set({ isScoping: scoping }),
    setCountdown: (countdown) => set({ countdown }),
    triggerShot: () => set({ lastShotTime: Date.now() }),
    setEquippedSkins: (skins) => set({ equippedSkins: skins }),
    setGameMode: (mode) => set({ gameMode: mode }),
    setOpponentInfo: (info) => set({ opponentInfo: info }),
    setAssetsPreloaded: (preloaded) => set({ assetsPreloaded: preloaded }),
    setReadyPlayers: (players) => set({ readyPlayers: players }),
    
    setRoundState: (state) =>
      set((prev) => ({
        roundState: { ...prev.roundState, ...state },
      })),
    
    resetRoundState: () => set({ roundState: { ...initialRoundState } }),
    
    setPendingRestart: (pending) => set({ pendingRestart: pending }),
    setRoomType: (roomType) => set({ roomType }),
    setEntryFee: (fee) => set({ entryFee: fee }),
    setPrizePool: (pool) => set({ prizePool: pool }),
    setMatchWinnings: (winnings) => set({ matchWinnings: winnings }),
    setSoloReward: (reward) => set({ soloReward: reward }),
    setMyProfilePicture: (picture) => set({ myProfilePicture: picture }),

    reset: () =>
      set({
        phase: "lobby",
        roomId: null,
        players: new Map(),
        bullets: [],
        winner: null,
        currentWeapon: "sniper",
        ammo: 5,
        isReloading: false,
        isScoping: false,
        countdown: null,
        equippedSkins: { sniper: null, pistol: null, crosshair: null },
        gameMode: null,
        opponentInfo: null,
        assetsPreloaded: false,
        readyPlayers: [],
        roundState: { ...initialRoundState },
        pendingRestart: false,
        roomType: null,
        entryFee: 0,
        prizePool: 0,
        matchWinnings: null,
        soloReward: null,
      }),
  }))
);
