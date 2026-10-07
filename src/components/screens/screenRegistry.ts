import { lazy, ComponentType } from 'react';
import type { GameModeId } from '../../lib/types';

export interface ModeScreens {
  lobby: ComponentType;
  roleReveal: ComponentType;
  dayPhase: ComponentType;
  gameOver: ComponentType;
  impostorGuess?: ComponentType;
  /** Deadlock: the station map, shown during the roaming phase. */
  station?: ComponentType;
}

const screenRegistry: Record<GameModeId, ModeScreens> = {
  classic_mafia: {
    lobby: lazy(() => import('./classic/LobbyRoom')),
    roleReveal: lazy(() => import('./classic/RoleReveal')),
    dayPhase: lazy(() => import('./classic/DayPhase')),
    gameOver: lazy(() => import('./classic/GameOver')),
  },
  word_impostor: {
    lobby: lazy(() => import('./word_impostor/LobbyRoom')),
    roleReveal: lazy(() => import('./word_impostor/RoleReveal')),
    dayPhase: lazy(() => import('./word_impostor/DayPhase')),
    gameOver: lazy(() => import('./word_impostor/GameOver')),
    impostorGuess: lazy(() => import('./word_impostor/ImpostorGuessScreen')),
  },
  undercover: {
    lobby: lazy(() => import('./undercover/LobbyRoom')),
    roleReveal: lazy(() => import('./undercover/RoleReveal')),
    dayPhase: lazy(() => import('./undercover/DayPhase')),
    gameOver: lazy(() => import('./undercover/GameOver')),
  },
  frequency_spy: {
    lobby: lazy(() => import('./frequency_spy/LobbyRoom')),
    roleReveal: lazy(() => import('./frequency_spy/RoleReveal')),
    dayPhase: lazy(() => import('./frequency_spy/DayPhase')),
    gameOver: lazy(() => import('./frequency_spy/GameOver')),
  },
  deadlock: {
    lobby: lazy(() => import('./deadlock/LobbyRoom')),
    roleReveal: lazy(() => import('./deadlock/RoleReveal')),
    // Meetings share the voting machinery but are framed around the station,
    // so they get their own screen rather than Word Impostor's.
    dayPhase: lazy(() => import('./deadlock/Meeting')),
    gameOver: lazy(() => import('./deadlock/GameOver')),
    station: lazy(() => import('./deadlock/Station')),
  },
};

export function getScreens(modeId: GameModeId): ModeScreens {
  return screenRegistry[modeId];
}
