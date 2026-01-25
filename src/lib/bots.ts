import { Player, Role, PlayerId } from './types';

const BOT_NAMES = [
  'Bot_Alice', 'Bot_Bob', 'Bot_Charlie', 'Bot_Dave', 'Bot_Eve', 
  'Bot_Frank', 'Bot_Grace', 'Bot_Heidi', 'Bot_Ivan', 'Bot_Judy',
  'Bot_Kevin', 'Bot_Leo', 'Bot_Mike', 'Bot_Nina', 'Bot_Oscar'
];

export function generateBotName(existingNames: string[]): string {
  const available = BOT_NAMES.filter(n => !existingNames.includes(n));
  if (available.length === 0) return `Bot_${Math.floor(Math.random() * 1000)}`;
  return available[Math.floor(Math.random() * available.length)];
}

export function getBotNightAction(
  botId: PlayerId, 
  role: Role, 
  players: Record<PlayerId, Player>, 
  allRoles: Record<PlayerId, Role>
): { action: 'KILL' | 'SAVE' | 'INVESTIGATE', targetId: PlayerId } | null {
  
  const alivePlayers = Object.values(players).filter(p => p.isAlive && p.id !== botId);
  if (alivePlayers.length === 0) return null;

  const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;

  switch (role) {
    case 'mafia':
      // Mafia bots kill non-mafia
      const nonMafia = alivePlayers.filter(p => allRoles[p.id] !== 'mafia');
      if (nonMafia.length > 0) {
        return { action: 'KILL', targetId: nonMafia[Math.floor(Math.random() * nonMafia.length)].id };
      }
      return { action: 'KILL', targetId: randomTarget }; // Should not happen if game logic is correct
      
    case 'doctor':
      // Doctor saves random player (including self sometimes)
      const potentialTargets = [...alivePlayers, players[botId]]; // Can save self
      const saveTarget = potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
      return { action: 'SAVE', targetId: saveTarget };

    case 'detective':
      // Detective investigates random player
      return { action: 'INVESTIGATE', targetId: randomTarget };

    default:
      return null;
  }
}

export function getBotDayVote(
  botId: PlayerId, 
  players: Record<PlayerId, Player>
): PlayerId | null {
  const alivePlayers = Object.values(players).filter(p => p.isAlive && p.id !== botId);
  if (alivePlayers.length === 0) return null;
  
  // 15% chance to skip vote
  if (Math.random() < 0.15) return null;

  return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
}
