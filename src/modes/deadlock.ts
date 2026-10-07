/**
 * Deadlock — the station mode.
 *
 * Players move room to room, run tasks, and try not to be alone with the wrong
 * person. Impostors kill quietly and leave bodies behind; anyone who finds one
 * can call everybody together.
 *
 * Meetings reuse the existing discussion and voting phases, so the whole
 * social-deduction engine is shared with the other modes — the map layer only
 * decides *when* a meeting happens and who is still alive to attend it.
 *
 * Phase flow:
 *   role_assignment → roaming → (meeting: day_discussion → voting →
 *   elimination_reveal) → roaming → … → game_over
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
} from '../lib/types';
import { assignTasks, SPAWN_ROOM } from '../data/deadlockMap';

const PHASES: ReadonlyArray<GamePhase> = [
  'lobby',
  'role_assignment',
  'roaming',
  'day_discussion',
  'voting',
  'elimination_reveal',
  'game_over',
];

/** Fallbacks, used when the host has not set these. */
export const TASKS_PER_CREW = 3;
export const KILL_COOLDOWN_SECONDS = 25;
export const SABOTAGE_COOLDOWN_SECONDS = 35;

/** How long each sabotage runs before it resolves on its own. */
export const SABOTAGE_DURATIONS: Record<'lights' | 'doors' | 'reactor', number> = {
  lights: 30,
  doors: 15,
  // The reactor is the only one that can lose the crew the game, so it gets
  // enough time for someone to realistically cross the station.
  reactor: 45,
};

/** Where the crew must go to deal with each sabotage. */
export const SABOTAGE_FIX_ROOM: Record<'lights' | 'doors' | 'reactor', string | null> = {
  lights: 'engineering',
  doors: null,      // doors simply time out
  reactor: 'reactor',
};

/**
 * How many impostors to deal.
 *
 * The host's choice wins, clamped so a game is always playable: at least one
 * impostor, and never so many that they start at parity and win instantly.
 */
export function resolveImpostorCount(playerCount: number, requested?: number): number {
  const maxSafe = Math.max(1, Math.floor((playerCount - 1) / 2));
  const fallback = playerCount >= 9 ? 2 : 1;
  const wanted = requested && requested > 0 ? requested : fallback;
  return Math.min(Math.max(1, wanted), maxSafe);
}

export const deadlockMode: GameModeDefinition = {
  id: 'deadlock' as GameModeId,
  name: 'Deadlock',
  description:
    'Move around a dead station, run your tasks, and watch your back. Impostors kill quietly — find a body and call everyone together.',
  minPlayers: 5,
  maxPlayers: 12,
  phases: PHASES,

  distributeRoles(playerIds, settings): Record<PlayerId, ModeRoleId> {
    const impostorCount = resolveImpostorCount(playerIds.length, settings?.deadlockImpostors);
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

    const roles: Record<PlayerId, ModeRoleId> = {};
    shuffled.forEach((id, i) => {
      roles[id] = i < impostorCount ? 'station_impostor' : 'station_crew';
    });
    return roles;
  },

  buildGameStartData(playerIds, roles, settings) {
    const impostorIds = Object.entries(roles)
      .filter(([, r]) => r === 'station_impostor')
      .map(([id]) => id);

    const tasksPerCrew = Math.max(1, settings?.deadlockTasks ?? TASKS_PER_CREW);

    const perPlayerPayloads: Record<PlayerId, PlayerPayload> = {};
    const taskAssignments: Record<PlayerId, string[]> = {};
    const positions: Record<PlayerId, string> = {};

    for (const id of playerIds) {
      positions[id] = SPAWN_ROOM;

      const isImpostor = impostorIds.includes(id);
      // Impostors sabotage rather than work. They still see a list, because
      // "what are your tasks?" is the first question asked in any meeting and
      // an impostor with no answer is caught for free — but it is labelled as
      // cover and they cannot complete any of it.
      const tasks = assignTasks(tasksPerCrew);
      if (!isImpostor) taskAssignments[id] = tasks;

      perPlayerPayloads[id] = {
        modeRoleId: roles[id],
        assignedWord: null,
        assignedCategory: null,
        assignedNumber: null,
        commonWord: null,
        // Sent per player, so nobody learns anyone else's route.
        tasks: tasks,
      };
    }

    const crewIds = playerIds.filter(id => !impostorIds.includes(id));

    const hostPrivateState: HostPrivateState = {
      impostorIds,
      positions,
      // Stored flat: HostPrivateState holds no nested arrays.
      taskAssignmentsJson: JSON.stringify(taskAssignments),
      tasksDoneJson: JSON.stringify({}),
      bodiesJson: JSON.stringify([]),
      killReadyJson: JSON.stringify({}),
      sabotageReadyJson: JSON.stringify({}),
      sabotageJson: JSON.stringify(null),
      emergenciesUsedJson: JSON.stringify([]),
      tasksTotal: crewIds.length * tasksPerCrew,
      tasksCompleted: 0,
      round: 1,
    };

    return { perPlayerPayloads, hostPrivateState };
  },

  getNextPhase(currentPhase): GamePhase {
    switch (currentPhase) {
      case 'role_assignment':
        return 'roaming';
      // A meeting runs the shared discussion/vote machinery, then everyone
      // goes back to the station.
      case 'roaming':
        return 'day_discussion';
      case 'day_discussion':
        return 'voting';
      case 'voting':
        return 'elimination_reveal';
      case 'elimination_reveal':
        return 'roaming';
      default:
        return 'game_over';
    }
  },

  processAction(_action, _currentPhase, _players, hostPrivateState): HostPrivateState {
    // Movement, kills and tasks are applied by the host as they arrive, since
    // they are continuous rather than phase-resolved.
    return hostPrivateState;
  },

  resolvePhase(_phase, _players, hostPrivateState) {
    return {
      publicPayload: {} as Record<string, string | number | boolean | null>,
      updatedPrivateState: hostPrivateState,
    };
  },

  checkWinCondition(players, hostPrivateState): WinResult | null {
    const impostorIds = (hostPrivateState.impostorIds as string[]) ?? [];
    if (impostorIds.length === 0) return null;

    const alive = Object.values(players).filter(p => p.isAlive);
    const aliveImpostors = alive.filter(p => impostorIds.includes(p.id)).length;
    const aliveCrew = alive.length - aliveImpostors;

    // The crew can win without ever catching anyone, just by finishing the job.
    const tasksTotal = Number(hostPrivateState.tasksTotal ?? 0);
    const tasksCompleted = Number(hostPrivateState.tasksCompleted ?? 0);
    if (tasksTotal > 0 && tasksCompleted >= tasksTotal) {
      return {
        winnerId: 'crew',
        winnerLabel: 'The Crew',
        description: 'Every task was completed. The station is back online.',
      };
    }

    if (aliveImpostors === 0) {
      return {
        winnerId: 'crew',
        winnerLabel: 'The Crew',
        description: 'Every impostor was found and thrown out.',
      };
    }

    if (aliveImpostors >= aliveCrew) {
      return {
        winnerId: 'impostor',
        winnerLabel: 'The Impostors',
        description: 'The impostors outnumber the crew. The station is lost.',
      };
    }

    // A reactor meltdown nobody stabilised in time ends it outright.
    if (hostPrivateState.reactorBlown === true) {
      return {
        winnerId: 'impostor',
        winnerLabel: 'The Impostors',
        description: 'Nobody reached the reactor in time. The station is gone.',
      };
    }

    return null;
  },
};
