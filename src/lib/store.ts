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
  setGameOver: (winner: 'town' | 'mafia', allRoles: Record<PlayerId, Role>) => void;
  resetGame: () => void;
  resetSession: () => void;
  resetToLobby: () => void;
  setSettings: (settings: GameSettings) => void;
  addMessage: (message: ChatMessage) => void;
  setTimerEnd: (timestamp: number | null) => void;
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
  winner: null,
  allRoles: null,
  settings: DEFAULT_SETTINGS,
  messages: [],
  timerEnd: null,
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
      
      setGameOver: (winner, allRoles) => set({ winner, allRoles, phase: 'game_over' }),

      resetGame: () => set(initialState),

      resetSession: () => set((state) => ({
        ...initialState,
        myId: state.myId,
        settings: state.settings
      })),

      resetToLobby: () => set(() => ({
        phase: 'lobby',
        myRole: null,
        mafiaPartners: [],
        lastNightResult: '',
        winner: null,
        allRoles: null,
        messages: [],
        timerEnd: null,
        error: null
      })),

      setSettings: (settings) => set({ settings }),
      addMessage: (message) => set((state) => {
        if (state.messages.some(m => m.id === message.id)) return state;
        return { messages: [...state.messages, message] };
      }),
      setTimerEnd: (timerEnd) => set({ timerEnd }),
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
        winner: state.winner,
        allRoles: state.allRoles,
        settings: state.settings,
        messages: state.messages,
        timerEnd: state.timerEnd,
      }),
    }
  )
);
