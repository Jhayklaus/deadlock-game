/**
 * Classic Mafia — Adapter
 *
 * Implements GameModeDefinition as a thin adapter over the existing
 * NetworkManager night/day logic. The actual phase resolution remains in
 * network.ts (Option A: wrap, don't break). This adapter provides:
 *  - Metadata (phases, player counts, name)
 *  - Role distribution (delegates to existing distributeRoles)
 *  - Per-player payload building (wraps existing ROLE_ASSIGN logic)
 *  - Win-condition checking (delegates to NetworkManager's existing logic)
 *
 * NetworkManager branches on mode.id === 'classic_mafia' to use its
 * original hardcoded phase resolution methods.
 */
import type {
  GameModeDefinition,
  GameModeId,
  GamePhase,
  ModeRoleId,
  PlayerPayload,
  HostPrivateState,
  PlayerId,
  Role,
  WinResult,
  GameSettings,
} from '../lib/types';
import { distributeRoles } from '../lib/gameLogic';

const CLASSIC_MAFIA_PHASES: ReadonlyArray<GamePhase> = [
  'lobby',
  'role_assignment',
  'night',
  'day_discussion',
  'voting',
  'elimination_reveal',
  'game_over',
];

export const classicMafiaMode: GameModeDefinition = {
  id: 'classic_mafia' as GameModeId,
  name: 'Classic Mafia',
  description:
    'The original Trust-No-One experience. Mafia kills at night, Town eliminates by day.',
  minPlayers: 7,
  maxPlayers: 20,
  phases: CLASSIC_MAFIA_PHASES,

  distributeRoles(playerIds, settings: GameSettings): Record<PlayerId, ModeRoleId> {
    // Delegate to the existing role distribution function
    return distributeRoles([...playerIds], settings) as Record<PlayerId, ModeRoleId>;
  },

  buildGameStartData(playerIds, roles, _settings) {
    // Build per-player payloads with mafia partner info (secrecy preserved)
    const perPlayerPayloads: Record<PlayerId, PlayerPayload> = {};
    const mafiaIds = Object.entries(roles)
      .filter(([_, r]) => r === 'mafia')
      .map(([id]) => id);

    for (const id of playerIds) {
      const role = roles[id] as Role;
      const mafiaPartners: string[] = role === 'mafia'
        ? mafiaIds.filter(mid => mid !== id)
        : [];

      perPlayerPayloads[id] = {
        modeRoleId: role,
        mafiaPartners,
        // word_impostor fields not used
        assignedWord: null,
        assignedCategory: null,
        assignedNumber: null,
        commonWord: null,
      };
    }

    // Classic Mafia has no secret host state beyond what's already in store.allRoles
    const hostPrivateState: HostPrivateState = {
      allRoles: roles as unknown as Record<string, string>,
    };

    return { perPlayerPayloads, hostPrivateState };
  },

  getNextPhase(currentPhase, _hostPrivateState, _players): GamePhase {
    const transitions: Partial<Record<GamePhase, GamePhase>> = {
      role_assignment: 'night',
      night: 'day_discussion',
      day_discussion: 'voting',
      voting: 'elimination_reveal',
      elimination_reveal: 'night',
    };
    return transitions[currentPhase] ?? 'game_over';
  },

  processAction(_action, _currentPhase, _players, hostPrivateState): HostPrivateState {
    // Classic Mafia actions (KILL, SAVE, INVESTIGATE, VOTE) are handled directly
    // by NetworkManager's existing methods. This adapter is a no-op here.
    return hostPrivateState;
  },

  resolvePhase(_phase, _players, hostPrivateState) {
    // Delegated entirely to NetworkManager's existing methods.
    return { publicPayload: {}, updatedPrivateState: hostPrivateState };
  },

  checkWinCondition(players, _hostPrivateState): WinResult | null {
    const alive = Object.values(players).filter(p => p.isAlive);
    const mafiaCount = alive.filter(p => p.role === 'mafia').length;
    const skCount = alive.filter(p => p.role === 'serial_killer').length;
    const townCount = alive.filter(
      p => p.role !== 'mafia' && p.role !== 'serial_killer' && p.role !== 'jester'
    ).length;

    if (mafiaCount === 0 && skCount === 0) {
      return { winnerId: 'town', winnerLabel: 'The Town', description: 'All threats have been eliminated.' };
    }
    if (mafiaCount >= townCount + skCount && skCount === 0) {
      return { winnerId: 'mafia', winnerLabel: 'The Mafia', description: 'The Mafia now controls the town.' };
    }
    if (skCount >= townCount + mafiaCount) {
      return { winnerId: 'serial_killer', winnerLabel: 'The Serial Killer', description: 'No one could stop them.' };
    }
    return null;
  },
};
