/**
 * Undercover Mode
 *
 * Three word tiers: Common (most players), Undercover (1-2 agents),
 * Blank (1 player gets nothing). Players give one clue per round,
 * trying to identify the Undercoverts without revealing the Common Word.
 * Single round: discuss → vote → reveal.
 *
 * Phase flow: role_assignment → day_discussion → voting → elimination_reveal → game_over
 */
import type {
  GameModeDefinition,
  GameModeId,
  GamePhase,
  ModeRoleId,
  PlayerPayload,
  HostPrivateState,
  PlayerId,
  WinResult,
  GameSettings,
} from '../lib/types';
import { drawRandomUndercoverEntry } from '../data/wordPacks/index';

const PHASES: ReadonlyArray<GamePhase> = [
  'lobby',
  'role_assignment',
  'day_discussion',
  'voting',
  'elimination_reveal',
  'game_over',
];

export const undercoverMode: GameModeDefinition = {
  id: 'undercover' as GameModeId,
  name: 'Undercover',
  description:
    'Most players share one word. Undercoverts have a similar but different word. One player gets nothing. Spot the odd ones out.',
  minPlayers: 6,
  maxPlayers: 12,
  phases: PHASES,

  distributeRoles(playerIds, _settings: GameSettings): Record<PlayerId, ModeRoleId> {
    const count = playerIds.length;
    const undercoverCount = count >= 9 ? 2 : 1;
    const blankCount = count >= 7 ? 1 : 0;

    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const roles: Record<PlayerId, ModeRoleId> = {};

    shuffled.forEach((id, i) => {
      if (i < undercoverCount) {
        roles[id] = 'undercover';
      } else if (i < undercoverCount + blankCount) {
        roles[id] = 'blank';
      } else {
        roles[id] = 'common';
      }
    });

    return roles;
  },

  buildGameStartData(playerIds, roles, _settings) {
    const entry = drawRandomUndercoverEntry();
    const { commonWord, undercoverWord, blankHint } = entry;

    const undercoverIds = Object.entries(roles)
      .filter(([_, r]) => r === 'undercover')
      .map(([id]) => id);
    const blankIds = Object.entries(roles)
      .filter(([_, r]) => r === 'blank')
      .map(([id]) => id);

    const perPlayerPayloads: Record<PlayerId, PlayerPayload> = {};

    for (const id of playerIds) {
      const role = roles[id];
      let assignedWord: string | null;

      if (role === 'common') {
        assignedWord = commonWord;
      } else if (role === 'undercover') {
        assignedWord = undercoverWord;
      } else {
        // blank: receives no word, only the category hint
        assignedWord = null;
      }

      perPlayerPayloads[id] = {
        modeRoleId: role,
        assignedWord,
        assignedCategory: blankHint, // everyone sees the category hint
        assignedNumber: null,
        commonWord: null, // never reveal commonWord to undercover/blank clients
      };
    }

    const hostPrivateState: HostPrivateState = {
      commonWord,
      undercoverWord,
      blankHint,
      undercoverIds,
      blankIds,
    };

    return { perPlayerPayloads, hostPrivateState };
  },

  getNextPhase(currentPhase, _hostPrivateState, _players): GamePhase {
    switch (currentPhase) {
      case 'role_assignment': return 'day_discussion';
      case 'day_discussion': return 'voting';
      case 'voting': return 'elimination_reveal';
      case 'elimination_reveal': return 'game_over';
      default: return 'game_over';
    }
  },

  processAction(_action, _currentPhase, _players, hostPrivateState): HostPrivateState {
    return hostPrivateState;
  },

  resolvePhase(_phase, _players, hostPrivateState) {
    return { publicPayload: {} as Record<string, string | number | boolean | null>, updatedPrivateState: hostPrivateState };
  },

  checkWinCondition(players, hostPrivateState, _lastAction): WinResult | null {
    const undercoverIds = (hostPrivateState.undercoverIds as string[]) ?? [];
    const alive = Object.values(players).filter(p => p.isAlive);
    const aliveUndercoverCount = alive.filter(p => undercoverIds.includes(p.id)).length;
    const aliveTownCount = alive.filter(p => !undercoverIds.includes(p.id)).length;

    if (aliveUndercoverCount === 0) {
      return {
        winnerId: 'town',
        winnerLabel: 'The Town',
        description: 'All Undercoverts have been identified!',
      };
    }
    if (aliveUndercoverCount >= aliveTownCount) {
      return {
        winnerId: 'undercover',
        winnerLabel: 'The Undercoverts',
        description: 'The Undercoverts have taken over!',
      };
    }
    return null;
  },
};
