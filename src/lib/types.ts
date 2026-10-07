export type PlayerId = string;

export type Role =
  // Town
  | 'civilian'
  | 'detective'
  | 'doctor'
  | 'bodyguard'
  | 'vigilante'
  | 'mayor'
  | 'medium'
  | 'escort'       // blocks a target's night action
  | 'veteran'      // can go on alert and kill anyone who visits
  | 'lookout'      // sees who visited their target
  | 'spy'          // learns where the Mafia struck
  // Mafia
  | 'mafia'
  | 'framer'       // makes a target read as suspicious to the Detective
  // Neutral
  | 'serial_killer'
  | 'jester'
  | 'survivor'     // wins by being alive at the end; has limited vests
  | 'executioner'  // wins if their assigned target is voted out
  | 'witch';       // redirects another player's night action

/** Roles that win with the Town. */
export const TOWN_ROLES: ReadonlyArray<Role> = [
  'civilian', 'detective', 'doctor', 'bodyguard', 'vigilante',
  'mayor', 'medium', 'escort', 'veteran', 'lookout', 'spy',
];

/** Roles that win with the Mafia. */
export const MAFIA_ROLES: ReadonlyArray<Role> = ['mafia', 'framer'];

/** Roles that win on their own terms. */
export const NEUTRAL_ROLES: ReadonlyArray<Role> = [
  'serial_killer', 'jester', 'survivor', 'executioner', 'witch',
];

export function isTownRole(role: Role | undefined): boolean {
  return !!role && TOWN_ROLES.includes(role);
}

export function isMafiaRole(role: Role | undefined): boolean {
  return !!role && MAFIA_ROLES.includes(role);
}

// ─── v2: Game Mode System ─────────────────────────────────────────────────────

export type UiScreen = 'mode_picker' | 'pre_join' | 'in_lobby' | 'in_game';

export type GameModeId =
  | 'classic_mafia'
  | 'word_impostor'
  | 'undercover'
  | 'frequency_spy';

export type ModeRoleId =
  | Role
  | 'crewmate'           // word_impostor: knows the word
  | 'impostor'           // word_impostor: knows only the category
  | 'common'             // undercover: has the common word
  | 'undercover'         // undercover: has the undercover word
  | 'blank'              // undercover: has no word at all
  | 'frequency_civilian' // frequency_spy: has the target number
  | 'frequency_spy';     // frequency_spy: has a divergent number

/** Who took a classic-mafia game. */
export type ClassicWinner =
  | 'town'
  | 'mafia'
  | 'serial_killer'
  | 'jester'
  | 'survivor'
  | 'executioner'
  | 'witch';

export interface WinResult {
  readonly winnerId: string;
  readonly winnerLabel: string;
  readonly description: string;
}

// JSON-serialisable — never contains functions or class instances
export type PlayerPayload = Record<string, string | number | boolean | null | string[]>;
export type HostPrivateState = Record<string, string | number | boolean | null | string[] | Record<string, string | number>>;

export interface PhaseAction {
  readonly senderId: PlayerId;
  readonly type: string;
  readonly payload: Record<string, string | number | boolean | null>;
}

export interface GameModeDefinition {
  readonly id: GameModeId;
  readonly name: string;
  readonly description: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly phases: ReadonlyArray<GamePhase>;

  distributeRoles(
    playerIds: ReadonlyArray<PlayerId>,
    settings: GameSettings
  ): Record<PlayerId, ModeRoleId>;

  /**
   * SECRECY ENFORCEMENT POINT.
   * Returns per-player payloads (Host sends each only their own entry)
   * and hostPrivateState (never forwarded to any client).
   */
  buildGameStartData(
    playerIds: ReadonlyArray<PlayerId>,
    roles: Record<PlayerId, ModeRoleId>,
    settings: GameSettings
  ): {
    readonly perPlayerPayloads: Record<PlayerId, PlayerPayload>;
    readonly hostPrivateState: HostPrivateState;
  };

  getNextPhase(
    currentPhase: GamePhase,
    hostPrivateState: HostPrivateState,
    players: Record<PlayerId, Player>
  ): GamePhase;

  processAction(
    action: PhaseAction,
    currentPhase: GamePhase,
    players: Record<PlayerId, Player>,
    hostPrivateState: HostPrivateState
  ): HostPrivateState;

  resolvePhase(
    phase: GamePhase,
    players: Record<PlayerId, Player>,
    hostPrivateState: HostPrivateState
  ): {
    readonly publicPayload: Record<string, string | number | boolean | null>;
    readonly perPlayerPayloads?: Record<PlayerId, PlayerPayload>;
    readonly updatedPrivateState: HostPrivateState;
  };

  checkWinCondition(
    players: Record<PlayerId, Player>,
    hostPrivateState: HostPrivateState,
    lastAction?: PhaseAction
  ): WinResult | null;
}

// ─── End v2 additions ─────────────────────────────────────────────────────────

// Public player info (synced to everyone)
export interface Player {
  id: PlayerId;
  name: string;
  isHost: boolean;
  isOnline: boolean;
  isAlive: boolean;
  isBot?: boolean;
  // Role is NOT included here for security, or is strictly optional/local only
  role?: Role; 
  // Revealed upon death
  lastWill?: string;
}

export type GamePhase =
  | 'lobby'
  | 'role_assignment'
  | 'night'
  | 'day_discussion'
  | 'voting'
  | 'elimination_reveal'
  | 'impostor_guess'   // v2: word_impostor — voted-out impostor guesses the word
  | 'game_over';

export interface GameState {
  hostId: PlayerId | null;
  myId: PlayerId;
  players: Record<PlayerId, Player>;
  phase: GamePhase;
  error: string | null;
  // Local player's role (private)
  myRole: Role | null;
  // For Mafia: list of other mafia IDs
  mafiaPartners: PlayerId[];
  // Result of the night phase
  lastNightResult: string;
  // Result of the elimination phase
  eliminationResult: { eliminatedId: PlayerId | null; resultText: string } | null;
  // Current vote counts (for voting phase UI)
  voteCounts: Record<PlayerId, number>;
  winner: ClassicWinner | null;
  allRoles: Record<PlayerId, Role> | null;
  settings: GameSettings;
  messages: ChatMessage[];
  timerEnd: number | null;
  myDeathReason: string | null;
  typingPlayers: Record<PlayerId, boolean>;
  // v2: game mode fields
  gameMode: GameModeId;
  myModeRoleId: ModeRoleId | null;
  myAssignedWord: string | null;       // word_impostor / undercover: word for crewmates, null for impostors
  myAssignedCategory: string | null;  // word_impostor: category hint shown to everyone
  myAssignedNumber: number | null;     // frequency_spy: the player's secret number
  myCommonWord: string | null;         // undercover common word (for blank player context)
  wordGuessResult: { guess: string; correct: boolean } | null;
  impostorGuessPlayerId: PlayerId | null; // word_impostor: who is currently guessing
  // v2 UI navigation
  uiScreen: UiScreen;
  selectedMode: GameModeId; // mode chosen on ModePicker (host flow only)
  // v2 mode game-over fields (stored so GameOver screens can display them)
  modeWinnerId: string | null;
  modeWinnerLabel: string | null;
  modeWinnerDescription: string | null;
  // v2 mode roles revealed at game over (for all players)
  allModeRoles: Record<PlayerId, string>;
  // Current discussion round, 1-based (non-classic modes loop over rounds)
  round: number;
  // Neutral roles that met their own goal, revealed at game over
  alsoWon: PlayerId[];
}

export interface GameSettings {
  /**
   * External voice room (Meet / Zoom / Discord) the host pastes in the lobby.
   * Null when none is set. Muting is on the honour system here — the game
   * cannot control an external call.
   */
  voiceRoomUrl?: string | null;
  dayDuration: number; // seconds
  discussionDuration: number; // seconds
  votingDuration: number; // seconds
  nightDuration: number; // seconds
  roles: {
    mafia: { count: number; chance: number };
    detective: { count: number; chance: number };
    doctor: { count: number; chance: number };
    vigilante: { count: number; chance: number };
    mayor: { count: number; chance: number };
    serial_killer: { count: number; chance: number };
    jester: { count: number; chance: number };
    bodyguard: { count: number; chance: number };
    medium: { count: number; chance: number };
    escort: { count: number; chance: number };
    veteran: { count: number; chance: number };
    lookout: { count: number; chance: number };
    spy: { count: number; chance: number };
    framer: { count: number; chance: number };
    survivor: { count: number; chance: number };
    executioner: { count: number; chance: number };
    witch: { count: number; chance: number };
  };
}

export interface ChatMessage {
  id: string;
  senderId: PlayerId;
  senderName: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
  channel?: 'global' | 'mafia' | 'dead';
  recipientId?: PlayerId; // For whispers
}

// Network Message Types
export type MessageType =
  | 'JOIN'
  | 'WELCOME'
  | 'PLAYER_UPDATE'
  | 'GAME_START'
  | 'ROLE_ASSIGN'
  | 'NIGHT_ACTION'
  | 'PHASE_CHANGE'
  | 'VOTE'
  | 'VOTE_UPDATE'
  | 'GAME_OVER'
  | 'CHAT_MESSAGE'
  | 'LOBBY_CLOSED'
  | 'UPDATE_LAST_WILL'
  | 'WHISPER'
  | 'DEATH_INFO'
  | 'KICK_PLAYER'
  | 'TYPING'
  | 'SETTINGS_UPDATE' // host → all: live lobby settings change
  | 'MODE_ASSIGN'   // v2: per-player mode payload (sent individually, never broadcast)
  | 'MODE_ACTION'   // v2: player → host generic action
  | 'MODE_RESULT';  // v2: host → all result broadcast

export interface BaseMessage {
  type: MessageType;
  senderId: PlayerId;
}

export interface ChatMessagePayload extends BaseMessage {
  type: 'CHAT_MESSAGE';
  payload: ChatMessage;
}

export interface JoinMessage extends BaseMessage {
  type: 'JOIN';
  payload: { name: string };
}

export interface WelcomeMessage extends BaseMessage {
  type: 'WELCOME';
  payload: {
    hostId: PlayerId;
    players: Record<PlayerId, Player>;
    phase: GamePhase;
    settings: GameSettings;
    gameMode: GameModeId;
  };
}

export interface PlayerUpdateMessage extends BaseMessage {
  type: 'PLAYER_UPDATE';
  payload: { players: Record<PlayerId, Player> };
}

export interface GameStartMessage extends BaseMessage {
  type: 'GAME_START';
  payload: {
    settings: GameSettings;
    gameMode: GameModeId;
  };
}

export interface RoleAssignMessage extends BaseMessage {
  type: 'ROLE_ASSIGN';
  payload: {
    role: Role;
    mafiaPartners?: PlayerId[]; // Only sent to Mafia
  };
}

export type NightActionType =
  | 'KILL'        // mafia, vigilante, serial killer
  | 'SAVE'        // doctor
  | 'INVESTIGATE' // detective
  | 'PROTECT'     // bodyguard
  | 'ROLEBLOCK'   // escort
  | 'FRAME'       // framer
  | 'ALERT'       // veteran — targets themselves
  | 'WATCH'       // lookout
  | 'VEST'        // survivor — targets themselves
  | 'CONTROL';    // witch — needs secondTargetId

export interface NightActionMessage extends BaseMessage {
  type: 'NIGHT_ACTION';
  payload: {
    action: NightActionType;
    targetId: PlayerId;
    /** Witch only: where the controlled player's action is redirected. */
    secondTargetId?: PlayerId;
  };
}

export interface PhaseChangeMessage extends BaseMessage {
  type: 'PHASE_CHANGE';
  payload: {
    phase: GamePhase;
    payload?: any; // Optional payload for specific phases (e.g. night results)
    timerEnd?: number;
  };
}

export interface VoteMessage extends BaseMessage {
  type: 'VOTE';
  payload: {
    targetId: PlayerId | null; // null = skip vote
  };
}

export interface VoteUpdateMessage extends BaseMessage {
  type: 'VOTE_UPDATE';
  payload: {
    voteCounts: Record<PlayerId, number>;
  };
}

export interface GameOverMessage extends BaseMessage {
  type: 'GAME_OVER';
  payload: {
    winner: ClassicWinner;
    roles: Record<PlayerId, Role>;
    /** Neutral roles that also achieved their own goal this game. */
    alsoWon?: PlayerId[];
  };
}

export interface LobbyClosedMessage extends BaseMessage {
  type: 'LOBBY_CLOSED';
}

export interface UpdateLastWillMessage extends BaseMessage {
  type: 'UPDATE_LAST_WILL';
  payload: {
    content: string;
  };
}

export interface WhisperMessage extends BaseMessage {
  type: 'WHISPER';
  payload: ChatMessage;
}

export interface DeathInfoMessage extends BaseMessage {
  type: 'DEATH_INFO';
  payload: {
    reason: string;
  };
}

export interface KickPlayerMessage extends BaseMessage {
  type: 'KICK_PLAYER';
  payload: {};
}

/**
 * Lobby settings changed on the host. Previously settings only reached players
 * on WELCOME and GAME_START, so anything the host changed after people joined
 * stayed invisible until the game began.
 */
export interface SettingsUpdateMessage extends BaseMessage {
  type: 'SETTINGS_UPDATE';
  payload: {
    settings: GameSettings;
  };
}

export interface TypingMessage extends BaseMessage {
  type: 'TYPING';
  payload: {
    isTyping: boolean;
  };
}

// v2 messages ─────────────────────────────────────────────────────────────────

export interface ModeAssignMessage extends BaseMessage {
  type: 'MODE_ASSIGN';
  payload: {
    modeId: GameModeId;
    modeRoleId: ModeRoleId;
    assignedWord: string | null;
    assignedCategory: string | null;
    assignedNumber: number | null;
    commonWord: string | null;
  };
}

export interface ModeActionMessage extends BaseMessage {
  type: 'MODE_ACTION';
  payload: {
    actionType: string;
    actionPayload: Record<string, string | number | boolean | null>;
  };
}

export interface ModeResultMessage extends BaseMessage {
  type: 'MODE_RESULT';
  payload: {
    resultType: string;
    publicPayload: Record<string, string | number | boolean | null>;
  };
}

export type NetworkMessage =
  | JoinMessage
  | WelcomeMessage
  | PlayerUpdateMessage
  | GameStartMessage
  | RoleAssignMessage
  | NightActionMessage
  | PhaseChangeMessage
  | VoteMessage
  | VoteUpdateMessage
  | GameOverMessage
  | ChatMessagePayload
  | LobbyClosedMessage
  | UpdateLastWillMessage
  | WhisperMessage
  | DeathInfoMessage
  | KickPlayerMessage
  | TypingMessage
  | SettingsUpdateMessage
  | ModeAssignMessage
  | ModeActionMessage
  | ModeResultMessage;
