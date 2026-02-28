/**
 * Word Impostor Mode
 *
 * Inspired by Spyfall. Crewmates share a secret word; Impostors know only
 * the category. Players give clues, then vote. If the Impostor is voted out
 * they get one final chance to guess the word.
 *
 * Phase flow: role_assignment → day_discussion → voting →
 *   [impostor_guess if impostor eliminated] → game_over
 *
 * SECRECY: secretWord lives ONLY in hostPrivateState, which is never forwarded
 * to any client. Impostor receives assignedWord: null.
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
import { drawRandomWordPair, type WordPackId } from '../data/wordPacks/index';

const PHASES: ReadonlyArray<GamePhase> = [
  'lobby',
  'role_assignment',
  'day_discussion',
  'voting',
  'impostor_guess',
  'game_over',
];

function pickPack(): WordPackId {
  const packs: WordPackId[] = ['animals', 'food', 'landmarks'];
  return packs[Math.floor(Math.random() * packs.length)];
}

export const wordImpostorMode: GameModeDefinition = {
  id: 'word_impostor' as GameModeId,
  name: 'Word Impostor',
  description:
    'Crewmates share a secret word. Impostors only know the category. Give clues, vote out the fraud.',
  minPlayers: 5,
  maxPlayers: 15,
  phases: PHASES,

  distributeRoles(playerIds, _settings: GameSettings): Record<PlayerId, ModeRoleId> {
    const count = playerIds.length;
    // 1 impostor for 5-8 players, 2 for 9+
    const impostorCount = count >= 9 ? 2 : 1;
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const roles: Record<PlayerId, ModeRoleId> = {};

    shuffled.forEach((id, i) => {
      roles[id] = i < impostorCount ? 'impostor' : 'crewmate';
    });

    return roles;
  },

  buildGameStartData(playerIds, roles, _settings) {
    // ── SECRECY ENFORCEMENT ──────────────────────────────────────────────────
    // secretWord is drawn here and stored ONLY in hostPrivateState.
    // It is NEVER placed in any perPlayerPayload for an impostor.
    const packId = pickPack();
    const { word: secretWord, category: secretCategory } = drawRandomWordPair(packId);

    const impostorIds = Object.entries(roles)
      .filter(([_, r]) => r === 'impostor')
      .map(([id]) => id);

    const perPlayerPayloads: Record<PlayerId, PlayerPayload> = {};

    for (const id of playerIds) {
      const isImpostor = impostorIds.includes(id);
      perPlayerPayloads[id] = {
        modeRoleId: roles[id],
        // Crewmates get the word. Impostors get null.
        assignedWord: isImpostor ? null : secretWord,
        assignedCategory: secretCategory,
        assignedNumber: null,
        commonWord: null,
      };
    }

    // hostPrivateState contains secretWord — never sent to any client
    const hostPrivateState: HostPrivateState = {
      secretWord,
      secretCategory,
      impostorIds,
      packId,
    };

    return { perPlayerPayloads, hostPrivateState };
  },

  getNextPhase(currentPhase, hostPrivateState, _players): GamePhase {
    switch (currentPhase) {
      case 'role_assignment':
        return 'day_discussion';
      case 'day_discussion':
        return 'voting';
      case 'voting':
        // Branching is handled by NetworkManager after vote resolution.
        // If impostor voted out → impostor_guess; else → game_over.
        // This fallback is safe because NetworkManager overrides it.
        return (hostPrivateState.eliminatedIsImpostor as boolean)
          ? 'impostor_guess'
          : 'game_over';
      case 'impostor_guess':
        return 'game_over';
      default:
        return 'game_over';
    }
  },

  processAction(action, currentPhase, _players, hostPrivateState): HostPrivateState {
    if (currentPhase === 'impostor_guess' && action.type === 'IMPOSTOR_GUESS') {
      const guess = String(action.payload.guess ?? '').trim().toLowerCase();
      const secretWord = String(hostPrivateState.secretWord ?? '').toLowerCase();
      const correct = guess === secretWord;
      return { ...hostPrivateState, impostorGuess: guess, guessCorrect: correct };
    }
    return hostPrivateState;
  },

  resolvePhase(phase, _players, hostPrivateState) {
    if (phase === 'impostor_guess') {
      const correct = Boolean(hostPrivateState.guessCorrect);
      const guess = String(hostPrivateState.impostorGuess ?? '');
      const secretWord = String(hostPrivateState.secretWord ?? '');

      return {
        publicPayload: {
          guess,
          correct,
          secretWord,
          resultText: correct
            ? `The Impostor guessed correctly! The word was "${secretWord}". Impostor wins!`
            : `Wrong guess! The word was "${secretWord}". Crewmates win!`,
        },
        updatedPrivateState: hostPrivateState,
      };
    }
    return { publicPayload: {} as Record<string, string | number | boolean | null>, updatedPrivateState: hostPrivateState };
  },

  checkWinCondition(players, hostPrivateState, lastAction): WinResult | null {
    // Win via guess result (called after resolvePhase for impostor_guess)
    if (
      hostPrivateState.impostorGuess !== undefined &&
      hostPrivateState.guessCorrect !== undefined
    ) {
      if (Boolean(hostPrivateState.guessCorrect)) {
        return {
          winnerId: 'impostor',
          winnerLabel: 'The Impostor',
          description: `Guessed the secret word correctly!`,
        };
      }
      return {
        winnerId: 'crewmates',
        winnerLabel: 'The Crewmates',
        description: `The Impostor's guess was wrong.`,
      };
    }

    // Vote-phase win: if a non-impostor was eliminated (checked by NetworkManager)
    if (
      lastAction?.type === 'VOTE_RESOLVED' &&
      lastAction.payload.eliminatedIsImpostor === false
    ) {
      return {
        winnerId: 'impostor',
        winnerLabel: 'The Impostor',
        description: 'An innocent player was eliminated. The Impostor escapes!',
      };
    }

    // Check if all impostors have been voted out (no living impostors)
    const impostorIds = (hostPrivateState.impostorIds as string[]) ?? [];
    const allImpostorsDead = impostorIds.every(id => !players[id]?.isAlive);
    if (allImpostorsDead && impostorIds.length > 0) {
      // Only trigger if the impostor didn't get a guess opportunity
      // NetworkManager handles the impostor_guess branching, so this
      // path fires if we skipped the guess (e.g. impostor was silent).
      return null; // Let NetworkManager handle the impostor_guess phase
    }

    return null;
  },
};
