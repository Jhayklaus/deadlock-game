import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState, Player, PlayerId, GamePhase, Role, GameSettings, ChatMessage } from './types';

interface GameActions {
  setMyId: (id: PlayerId) => void;
  setHostId: (id: PlayerId) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (id: PlayerId, updates: Partial<Player>) => void;
  removePlayer: (id: PlayerId) => void;
  setPlayers: (players: Record<PlayerId, Player>) => void;
  setPhase: (phase: GamePhase) => void;
  setError: (error: string | null) => void;
  setMyRole: (role: Role, mafiaPartners?: PlayerId[]) => void;
  setAllRoles: (roles: Record<PlayerId, Role>) => void;
  setLastNightResult: (result: string) => void;
  setEliminationResult: (result: { eliminatedId: PlayerId | null; resultText: string } | null) => void;
  setVoteCounts: (counts: Record<PlayerId, number>) => void;
  setGameOver: (winner: 'town' | 'mafia' | 'serial_killer' | 'jester', allRoles: Record<PlayerId, Role>) => void;
  resetGame: () => void;
  resetSession: () => void;
  resetToLobby: () => void;
  setSettings: (settings: GameSettings) => void;
  addMessage: (message: ChatMessage) => void;
  setTimerEnd: (timestamp: number | null) => void;
  setMyDeathReason: (reason: string | null) => void;
  setTypingPlayers: (typingPlayers: Record<PlayerId, boolean>) => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  dayDuration: 180,
  discussionDuration: 60,
  votingDuration: 60,
  nightDuration: 30,
  roles: {
    mafia: { count: 1, chance: 100 },
    detective: { count: 1, chance: 100 },
    doctor: { count: 1, chance: 100 },
    vigilante: { count: 1, chance: 50 },
    mayor: { count: 1, chance: 50 },
    serial_killer: { count: 1, chance: 30 },
    jester: { count: 1, chance: 30 },
    bodyguard: { count: 1, chance: 50 },
    medium: { count: 1, chance: 50 },
  }
};

const initialState: GameState = {
  hostId: null,
  myId: '',
  players: {},
  phase: 'lobby',
  error: null,
  myRole: null,
  mafiaPartners: [],
  lastNightResult: '',
  eliminationResult: null,
  voteCounts: {},
  winner: null,
  allRoles: null,
  settings: DEFAULT_SETTINGS,
  messages: [],
  timerEnd: null,
  myDeathReason: null,
  typingPlayers: {},
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set) => ({
      ...initialState,

      setMyId: (id) => set({ myId: id }),
      setHostId: (id) => set({ hostId: id }),
      
      addPlayer: (player) => set((state) => ({
        players: { ...state.players, [player.id]: player }
      })),

      updatePlayer: (id, updates) => set((state) => {
        const player = state.players[id];
        if (!player) return state;
        return {
          players: {
            ...state.players,
            [id]: { ...player, ...updates }
          }
        };
      }),

      removePlayer: (id) => set((state) => {
        const newPlayers = { ...state.players };
        delete newPlayers[id];
        return { players: newPlayers };
      }),

      setPlayers: (players) => set({ players }),
      setPhase: (phase) => set({ phase }),
      setError: (error) => set({ error }),
      
      setMyRole: (role, mafiaPartners = []) => set({ myRole: role, mafiaPartners }),
      
      setAllRoles: (allRoles) => set({ allRoles }),

      setLastNightResult: (result) => set({ lastNightResult: result }),
      setEliminationResult: (result) => set({ eliminationResult: result }),
      setVoteCounts: (voteCounts) => set({ voteCounts }),
      setMyDeathReason: (reason) => set({ myDeathReason: reason }),
      
      setGameOver: (winner, allRoles) => set({ winner, allRoles, phase: 'game_over' }),

      resetGame: () => set(initialState),

      resetSession: () => {
        localStorage.removeItem('tno-game-storage');
        set((state) => ({
        ...initialState,
        myId: state.myId,
        settings: state.settings
      }))
      },

      resetToLobby: () => set((state) => {
        const resetPlayers = Object.entries(state.players).reduce((acc, [id, player]) => ({
          ...acc,
          [id]: { ...player, isAlive: true }
        }), {} as Record<PlayerId, Player>);

        return {
          phase: 'lobby',
          players: resetPlayers,
          myRole: null,
          mafiaPartners: [],
          lastNightResult: '',
          eliminationResult: null,
          voteCounts: {},
          winner: null,
          allRoles: null,
          messages: [],
          timerEnd: null,
          typingPlayers: {},
          error: null
        };
      }),

      setSettings: (settings) => set({ settings }),
      addMessage: (message) => set((state) => {
        if (state.messages.some(m => m.id === message.id)) return state;
        return { messages: [...state.messages, message] };
      }),
      setTimerEnd: (timerEnd) => set({ timerEnd }),
      setTypingPlayers: (typingPlayers) => set({ typingPlayers }),
    }),
    {
      name: 'tno-game-storage',
      partialize: (state) => ({
        hostId: state.hostId,
        myId: state.myId,
        players: state.players,
        phase: state.phase,
        myRole: state.myRole,
        mafiaPartners: state.mafiaPartners,
        lastNightResult: state.lastNightResult,
        eliminationResult: state.eliminationResult,
        winner: state.winner,
        allRoles: state.allRoles,
        settings: state.settings,
        messages: state.messages,
        timerEnd: state.timerEnd,
      }),
    }
  )
);
