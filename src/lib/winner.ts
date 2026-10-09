import type { PlayerId } from './types';

/**
 * Did the player looking at the screen win?
 *
 * Each mode's game-over screen used to work this out for itself, and every one
 * of them got it wrong in a different way. Word Impostor compared the winner id
 * against `'crewmate'` when the engine emits `'crewmates'`, so a crewmate win
 * never matched and the winning team was shown DEFEAT under a headline reading
 * "The Crewmates win". Undercover used *alive or dead* as a stand-in for which
 * side you were on, which is not the same question: a surviving civilian read
 * as a winner when the Undercoverts took it, and a civilian who had been voted
 * out read as a loser when their own side won.
 *
 * The answer only ever depended on two things — who won, and what you were —
 * so it lives here once, with the role ids taken from the modes themselves
 * rather than guessed at.
 */

/** Role ids that share a win, keyed by the winner id the engine reports. */
const WINNERS: Record<string, ReadonlyArray<string>> = {
  // Word Impostor — note the plural, which is what the engine actually sends.
  crewmates: ['crewmate'],
  impostor: ['impostor', 'station_impostor'],

  // Undercover. A Blank is not counted among the Undercoverts by the mode's
  // own win check, so they take the Town's result.
  town: ['common', 'blank'],
  undercover: ['undercover'],

  // Frequency Spy
  civilians: ['frequency_civilian'],
  frequency_spy: ['frequency_spy'],

  // Deadlock
  crew: ['station_crew'],
};

/**
 * True when `roleId` is on the winning side.
 *
 * Returns false when either is missing rather than guessing — an unknown role
 * showing DEFEAT is wrong, but showing VICTORY to everyone is worse.
 */
export function roleWon(winnerId: string | null, roleId: string | null): boolean {
  if (!winnerId || !roleId) return false;
  return (WINNERS[winnerId] ?? []).includes(roleId);
}

/** The viewing player's result, from the roles revealed at game over. */
export function didIWin(
  winnerId: string | null,
  allModeRoles: Record<PlayerId, string> | null | undefined,
  myId: PlayerId
): boolean {
  return roleWon(winnerId, allModeRoles?.[myId] ?? null);
}

/** Every role id that shares the win, for highlighting the roster. */
export function winningRoles(winnerId: string | null): ReadonlyArray<string> {
  return winnerId ? WINNERS[winnerId] ?? [] : [];
}
