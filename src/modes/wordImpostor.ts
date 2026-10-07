/**
 * Word Impostor Mode
 *
 * Inspired by Spyfall. Crewmates share a secret word; Impostors know only
 * the category. Players give clues, then vote. If an Impostor is voted out
 * they get one final chance to guess the word.
 *
 * MULTI-ROUND: voting out an innocent does NOT end the game — play loops back
 * into another discussion round. The game ends only when every Impostor has
 * been voted out (Crewmates win), an Impostor guesses the word (Impostors
 * win), or the Impostors reach numerical parity with the Crewmates
 * (Impostors win).
 *
 * Phase flow: role_assignment → (day_discussion → voting →
 *   [impostor_guess if an impostor was eliminated] → elimination_reveal)* → game_over
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
  'elimination_reveal',
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
        // If an impostor was voted out → impostor_guess; else → elimination_reveal.
        return (hostPrivateState.eliminatedIsImpostor as boolean)
          ? 'impostor_guess'
          : 'elimination_reveal';
      case 'impostor_guess':
        return 'elimination_reveal';
      case 'elimination_reveal':
        // Loop back for another round. NetworkManager checks the win
        // condition first and only reaches here when nobody has won yet.
        return 'day_discussion';
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

  checkWinCondition(players, hostPrivateState, _lastAction): WinResult | null {
    const impostorIds = (hostPrivateState.impostorIds as string[]) ?? [];
    if (impostorIds.length === 0) return null;

    // A correct guess from a voted-out Impostor wins outright, whatever else
    // is true on the board.
    if (hostPrivateState.guessCorrect === true) {
      const secretWord = String(hostPrivateState.secretWord ?? '');
      return {
        winnerId: 'impostor',
        winnerLabel: 'The Impostor',
        description: `Guessed the secret word "${secretWord}" correctly!`,
      };
    }

    const alive = Object.values(players).filter(p => p.isAlive);
    const aliveImpostors = alive.filter(p => impostorIds.includes(p.id)).length;
    const aliveCrewmates = alive.length - aliveImpostors;

    if (aliveImpostors === 0) {
      // Every Impostor is out — but a freshly voted-out Impostor is still owed
      // their guess. Returning null lets the host run `impostor_guess` first;
      // it sets `guessResolved` once that guess has been settled.
      if (hostPrivateState.guessResolved !== true) return null;
      return {
        winnerId: 'crewmates',
        winnerLabel: 'The Crewmates',
        description: 'Every Impostor was voted out and none guessed the word.',
      };
    }

    // Impostors take over once they match or outnumber the remaining Crewmates.
    if (aliveImpostors >= aliveCrewmates) {
      const secretWord = String(hostPrivateState.secretWord ?? '');
      return {
        winnerId: 'impostor',
        winnerLabel: 'The Impostor',
        description: `The Impostors outnumber the Crewmates. The word was "${secretWord}".`,
      };
    }

    // Nobody has won — the game continues into another round.
    return null;
  },
};
