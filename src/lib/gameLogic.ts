import { GameSettings, PlayerId, Role } from './types';

export function distributeRoles(playerIds: PlayerId[], settings: GameSettings): Record<PlayerId, Role> {
  const count = playerIds.length;
  const assignments: Record<PlayerId, Role> = {};
  
  // Use settings for counts, but respect maximums based on player count
  // (Optional: You could remove the hard limits and trust the host, but keeping some sanity checks is good)
  const { mafia, detective, doctor } = settings.roles;
  
  // Create pool of roles based on settings
  const roles: Role[] = [];
  
  // Helper to add roles based on count and chance
  const addRoles = (role: Role, config: { count: number; chance: number }) => {
    for (let i = 0; i < config.count; i++) {
      if (Math.random() * 100 <= config.chance) {
        roles.push(role);
      }
    }
  };

  addRoles('mafia', mafia);
  addRoles('detective', detective);
  addRoles('doctor', doctor);
  
  // Fill rest with civilians
  const currentRoleCount = roles.length;
  if (currentRoleCount > count) {
    // If too many roles, truncate (prioritize Mafia -> Detective -> Doctor order of insertion)
    roles.length = count;
  } else {
    const civilianCount = count - currentRoleCount;
    for (let i = 0; i < civilianCount; i++) roles.push('civilian');
  }

  // Shuffle roles
  const shuffledRoles = roles.sort(() => Math.random() - 0.5);

  // Assign
  playerIds.forEach((id, index) => {
    assignments[id] = shuffledRoles[index];
  });

  return assignments;
}
