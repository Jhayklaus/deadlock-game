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

/** Tasks dealt to each crewmate. */
export const TASKS_PER_CREW = 3;

/** Seconds an impostor must wait between kills. */
export const KILL_COOLDOWN_SECONDS = 25;

export const deadlockMode: GameModeDefinition = {
  id: 'deadlock' as GameModeId,
  name: 'Deadlock',
  description:
    'Move around a dead station, run your tasks, and watch your back. Impostors kill quietly — find a body and call everyone together.',
  minPlayers: 5,
  maxPlayers: 12,
  phases: PHASES,

  distributeRoles(playerIds): Record<PlayerId, ModeRoleId> {
    const count = playerIds.length;
    // One impostor up to 8 players, two beyond that.
    const impostorCount = count >= 9 ? 2 : 1;
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

    const roles: Record<PlayerId, ModeRoleId> = {};
    shuffled.forEach((id, i) => {
      roles[id] = i < impostorCount ? 'station_impostor' : 'station_crew';
    });
    return roles;
  },

  buildGameStartData(playerIds, roles) {
    const impostorIds = Object.entries(roles)
      .filter(([, r]) => r === 'station_impostor')
      .map(([id]) => id);

    const perPlayerPayloads: Record<PlayerId, PlayerPayload> = {};
    const taskAssignments: Record<PlayerId, string[]> = {};
    const positions: Record<PlayerId, string> = {};

    for (const id of playerIds) {
      positions[id] = SPAWN_ROOM;

      // Impostors get a task list too, so that standing at a console proves
      // nothing on its own.
      const tasks = assignTasks(TASKS_PER_CREW);
      taskAssignments[id] = tasks;

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

    // Only real crew tasks count toward the win, otherwise impostors could
    // finish the game for the crew by faking them.
    const crewIds = playerIds.filter(id => !impostorIds.includes(id));

    const hostPrivateState: HostPrivateState = {
      impostorIds,
      positions,
      // Stored flat: HostPrivateState holds no nested arrays.
      taskAssignmentsJson: JSON.stringify(taskAssignments),
      tasksDoneJson: JSON.stringify({}),
      bodiesJson: JSON.stringify([]),
      killReadyJson: JSON.stringify({}),
      emergenciesUsedJson: JSON.stringify([]),
      tasksTotal: crewIds.length * TASKS_PER_CREW,
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

    return null;
  },
};
