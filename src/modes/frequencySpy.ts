/**
 * Frequency Spy Mode
 *
 * All players receive the same secret "target number" (1-100) on a
 * conceptual spectrum (e.g. "Temperature: Freezing → Scorching"). One
 * Spy receives a number far from the group's number. Players give one-word
 * clues hinting at their number. Vote to find the Spy.
 *
 * MULTI-ROUND: voting out a Civilian does NOT end the game — play loops back
 * into another discussion round. The game ends only when the Spy is voted out
 * (Civilians win) or the Spy reaches numerical parity with the Civilians
 * (Spy wins).
 *
 * Phase flow: role_assignment → (day_discussion → voting → elimination_reveal)* → game_over
 *
 * 🎲 BALANCE NOTE: The Spy has a higher win rate than Word Impostor (~50%)
 * because the clue-number mapping is subjective. Playtesting recommended.
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
import { drawRandomFrequencyTopic } from '../data/wordPacks/index';

const PHASES: ReadonlyArray<GamePhase> = [
  'lobby',
  'role_assignment',
  'day_discussion',
  'voting',
  'elimination_reveal',
  'game_over',
];

/** Generate a spy number that is at least `minGap` away from targetNumber */
function generateSpyNumber(targetNumber: number, minGap: number = 30): number {
  let spy: number;
  do {
    spy = Math.floor(Math.random() * 100) + 1;
  } while (Math.abs(spy - targetNumber) < minGap);
  return spy;
}

export const frequencySpyMode: GameModeDefinition = {
  id: 'frequency_spy' as GameModeId,
  name: 'Frequency Spy',
  description:
    'Everyone shares a secret number on a spectrum. One Spy is way off. Give a clue hinting at your number — vote out the one who seems off-frequency.',
  minPlayers: 5,
  maxPlayers: 12,
  phases: PHASES,

  distributeRoles(playerIds, _settings: GameSettings): Record<PlayerId, ModeRoleId> {
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const roles: Record<PlayerId, ModeRoleId> = {};

    shuffled.forEach((id, i) => {
      roles[id] = i === 0 ? 'frequency_spy' : 'frequency_civilian';
    });

    return roles;
  },

  buildGameStartData(playerIds, roles, _settings) {
    const topic = drawRandomFrequencyTopic();
    const targetNumber = Math.floor(Math.random() * 100) + 1;
    const spyNumber = generateSpyNumber(targetNumber);

    const spyIds = Object.entries(roles)
      .filter(([_, r]) => r === 'frequency_spy')
      .map(([id]) => id);

    const perPlayerPayloads: Record<PlayerId, PlayerPayload> = {};

    for (const id of playerIds) {
      const isSpy = spyIds.includes(id);
      perPlayerPayloads[id] = {
        modeRoleId: roles[id],
        assignedWord: null,
        assignedCategory: null,
        assignedNumber: isSpy ? spyNumber : targetNumber,
        commonWord: null,
        frequencyTopic: topic.topic,
        frequencyLowLabel: topic.lowLabel,
        frequencyHighLabel: topic.highLabel,
      };
    }

    const hostPrivateState: HostPrivateState = {
      targetNumber,
      spyNumber,
      spyIds,
      frequencyTopic: topic.topic,
      frequencyLowLabel: topic.lowLabel,
      frequencyHighLabel: topic.highLabel,
    };

    return { perPlayerPayloads, hostPrivateState };
  },

  getNextPhase(currentPhase, _hostPrivateState, _players): GamePhase {
    switch (currentPhase) {
      case 'role_assignment': return 'day_discussion';
      case 'day_discussion': return 'voting';
      case 'voting': return 'elimination_reveal';
      // Loop back for another round. NetworkManager checks the win condition
      // first and only reaches here when nobody has won yet.
      case 'elimination_reveal': return 'day_discussion';
      default: return 'game_over';
    }
  },

  processAction(_action, _currentPhase, _players, hostPrivateState): HostPrivateState {
    return hostPrivateState;
  },

  resolvePhase(phase, _players, hostPrivateState) {
    if (phase === 'elimination_reveal') {
      return {
        publicPayload: {
          targetNumber: hostPrivateState.targetNumber as number,
          spyNumber: hostPrivateState.spyNumber as number,
          frequencyTopic: hostPrivateState.frequencyTopic as string,
          frequencyLowLabel: hostPrivateState.frequencyLowLabel as string,
          frequencyHighLabel: hostPrivateState.frequencyHighLabel as string,
        },
        updatedPrivateState: hostPrivateState,
      };
    }
    return { publicPayload: {} as Record<string, string | number | boolean | null>, updatedPrivateState: hostPrivateState };
  },

  checkWinCondition(players, hostPrivateState, _lastAction): WinResult | null {
    const spyIds = (hostPrivateState.spyIds as string[]) ?? [];
    const alive = Object.values(players).filter(p => p.isAlive);
    const aliveSpyCount = alive.filter(p => spyIds.includes(p.id)).length;

    if (aliveSpyCount === 0) {
      return {
        winnerId: 'civilians',
        winnerLabel: 'The Civilians',
        description: 'The Frequency Spy was detected and voted out!',
      };
    }

    const aliveCivilianCount = alive.filter(p => !spyIds.includes(p.id)).length;
    if (aliveSpyCount >= aliveCivilianCount) {
      return {
        winnerId: 'frequency_spy',
        winnerLabel: 'The Spy',
        description: 'The Spy survived undetected. Mission complete.',
      };
    }

    return null;
  },
};
