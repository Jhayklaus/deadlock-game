import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState, Player, PlayerId, GamePhase, Role, GameSettings, ChatMessage, GameModeId, ModeRoleId, UiScreen } from './types';

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
  // v2: mode actions
  setGameMode: (mode: GameModeId) => void;
  setModeAssign: (payload: {
    modeRoleId: ModeRoleId;
    assignedWord: string | null;
    assignedCategory: string | null;
    assignedNumber: number | null;
    commonWord: string | null;
  }) => void;
  setWordGuessResult: (result: { guess: string; correct: boolean } | null) => void;
  setImpostorGuessPlayerId: (id: PlayerId | null) => void;
  setModeGameOver: (winnerId: string, winnerLabel: string, description: string) => void;
  clearMessages: () => void;
  // v2 UI navigation
  setUiScreen: (screen: UiScreen) => void;
  setSelectedMode: (mode: GameModeId) => void;
  setAllModeRoles: (roles: Record<PlayerId, string>) => void;
  setRound: (round: number) => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  voiceRoomUrl: null,
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
  // v2
  gameMode: 'classic_mafia',
  myModeRoleId: null,
  myAssignedWord: null,
  myAssignedCategory: null,
  myAssignedNumber: null,
  myCommonWord: null,
  wordGuessResult: null,
  impostorGuessPlayerId: null,
  // v2 UI navigation
  uiScreen: 'mode_picker' as UiScreen,
  selectedMode: 'classic_mafia' as GameModeId,
  modeWinnerId: null,
  modeWinnerLabel: null,
  modeWinnerDescription: null,
  allModeRoles: {},
  round: 1,
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
          error: null,
          // v2
          myModeRoleId: null,
          myAssignedWord: null,
          myAssignedCategory: null,
          myAssignedNumber: null,
          myCommonWord: null,
          wordGuessResult: null,
          impostorGuessPlayerId: null,
          modeWinnerId: null,
          modeWinnerLabel: null,
          modeWinnerDescription: null,
          allModeRoles: {},
          round: 1,
          uiScreen: 'in_lobby' as UiScreen,
        };
      }),

      setSettings: (settings) => set({ settings }),
      addMessage: (message) => set((state) => {
        if (state.messages.some(m => m.id === message.id)) return state;
        return { messages: [...state.messages, message] };
      }),
      setTimerEnd: (timerEnd) => set({ timerEnd }),
      setTypingPlayers: (typingPlayers) => set({ typingPlayers }),

      // v2 actions
      setGameMode: (gameMode) => set({ gameMode }),

      setModeAssign: ({ modeRoleId, assignedWord, assignedCategory, assignedNumber, commonWord }) =>
        set({ myModeRoleId: modeRoleId, myAssignedWord: assignedWord, myAssignedCategory: assignedCategory, myAssignedNumber: assignedNumber, myCommonWord: commonWord }),

      setWordGuessResult: (wordGuessResult) => set({ wordGuessResult }),

      setImpostorGuessPlayerId: (impostorGuessPlayerId) => set({ impostorGuessPlayerId }),

      setModeGameOver: (modeWinnerId, modeWinnerLabel, modeWinnerDescription) =>
        set({ phase: 'game_over', modeWinnerId, modeWinnerLabel, modeWinnerDescription }),

      clearMessages: () => set({ messages: [] }),
      setUiScreen: (uiScreen) => set({ uiScreen }),
      setSelectedMode: (selectedMode) => set({ selectedMode }),
      setAllModeRoles: (allModeRoles) => set({ allModeRoles }),
      setRound: (round) => set({ round }),
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
        // v2
        gameMode: state.gameMode,
        myModeRoleId: state.myModeRoleId,
        myAssignedWord: state.myAssignedWord,
        myAssignedCategory: state.myAssignedCategory,
        myAssignedNumber: state.myAssignedNumber,
        myCommonWord: state.myCommonWord,
        impostorGuessPlayerId: state.impostorGuessPlayerId,
        // v2 UI navigation
        uiScreen: state.uiScreen,
        selectedMode: state.selectedMode,
        modeWinnerId: state.modeWinnerId,
        modeWinnerLabel: state.modeWinnerLabel,
        modeWinnerDescription: state.modeWinnerDescription,
        allModeRoles: state.allModeRoles,
        round: state.round,
      }),
    }
  )
);
