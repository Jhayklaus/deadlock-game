/**
 * Who may speak, where, and when.
 *
 * This is the point of in-app voice over an external call: the game decides
 * the audio, so "stay muted outside discussion" is enforced rather than
 * promised. The server can make that call because the host already streams its
 * authoritative state here for host migration, so roles, phase and liveness
 * are known without trusting the requesting client.
 *
 * Kept as a pure function with no server imports so the rules can be tested
 * directly — a mistake here leaks the Mafia's night chat to the Town.
 */

const MAFIA_ROLES = ['mafia', 'framer'];

/** Audio channels, each a separate LiveKit room so membership is enforced. */
const CHANNELS = {
  TOWN: 'town',
  MAFIA: 'mafia',
  DEAD: 'dead',
};

/**
 * Decides the audio grant for one player.
 *
 * @param {object} snapshot  Latest host state for the room.
 * @param {string} userId    Who is asking.
 * @returns {{channel: string|null, canPublish: boolean, reason: string}}
 *   `channel` null means this player gets no voice at all right now.
 */
function resolveVoiceGrant(snapshot, userId) {
  const deny = reason => ({ channel: null, canPublish: false, reason });

  if (!snapshot) return deny('no game state');

  const player = snapshot.players?.[userId];
  if (!player) return deny('not in this game');

  const phase = snapshot.phase || 'lobby';
  const role = snapshot.allRoles?.[userId];

  // The dead talk among themselves and are never audible to the living.
  if (player.isAlive === false) {
    return { channel: CHANNELS.DEAD, canPublish: true, reason: 'dead chat' };
  }

  switch (phase) {
    // Before and after the game, and during reveals, everyone talks freely.
    case 'lobby':
    case 'role_assignment':
    case 'elimination_reveal':
    case 'game_over':
      return { channel: CHANNELS.TOWN, canPublish: true, reason: 'open floor' };

    // Night: only the Mafia have a voice, and only to each other.
    case 'night':
      if (MAFIA_ROLES.includes(role)) {
        return { channel: CHANNELS.MAFIA, canPublish: true, reason: 'mafia night chat' };
      }
      return deny('asleep');

    // The accused holds the floor alone. Everyone else listens.
    case 'trial_defense':
      if (snapshot.accusedId === userId) {
        return { channel: CHANNELS.TOWN, canPublish: true, reason: 'defending' };
      }
      return { channel: CHANNELS.TOWN, canPublish: false, reason: 'listening to the defense' };

    case 'day_discussion':
    case 'voting':
    case 'trial_verdict':
      return { channel: CHANNELS.TOWN, canPublish: true, reason: 'discussion' };

    default:
      return { channel: CHANNELS.TOWN, canPublish: false, reason: 'unknown phase' };
  }
}

/** LiveKit room name for a game room and channel. */
function voiceRoomName(roomId, channel) {
  return `mafieux-${roomId}-${channel}`;
}

export { resolveVoiceGrant, voiceRoomName, CHANNELS };
