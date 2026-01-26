export type PlayerId = string;

export type Role = 'mafia' | 'detective' | 'doctor' | 'civilian' | 'vigilante' | 'mayor' | 'serial_killer' | 'jester' | 'bodyguard' | 'medium';

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

export type GamePhase = 'lobby' | 'role_assignment' | 'night' | 'day_discussion' | 'voting' | 'game_over';

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
  // Current vote counts (for voting phase UI)
  voteCounts: Record<PlayerId, number>;
  winner: 'town' | 'mafia' | 'serial_killer' | 'jester' | null;
  allRoles: Record<PlayerId, Role> | null;
  settings: GameSettings;
  messages: ChatMessage[];
  timerEnd: number | null; // Timestamp for when the current phase ends
  myDeathReason: string | null;
}

export interface GameSettings {
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
  | 'KICK_PLAYER';

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
  };
}

export interface RoleAssignMessage extends BaseMessage {
  type: 'ROLE_ASSIGN';
  payload: {
    role: Role;
    mafiaPartners?: PlayerId[]; // Only sent to Mafia
  };
}

export interface NightActionMessage extends BaseMessage {
  type: 'NIGHT_ACTION';
  payload: {
    action: 'KILL' | 'SAVE' | 'INVESTIGATE' | 'PROTECT';
    targetId: PlayerId;
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
    winner: 'town' | 'mafia' | 'serial_killer' | 'jester';
    roles: Record<PlayerId, Role>;
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
  | KickPlayerMessage;
