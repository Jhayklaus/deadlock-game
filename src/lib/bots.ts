import { Player, Role, PlayerId } from './types';
import { generateAIResponse } from './ai';
import { ROLE_DEFINITIONS } from './roleData';

const ROLE_GUIDE = ROLE_DEFINITIONS.map(r => 
  `- ${r.name}: ${r.description} (${r.details.join(' ')})`
).join('\n');

const BOT_NAMES = [
  'Bot_Alice', 'Bot_Bob', 'Bot_Charlie', 'Bot_Dave', 'Bot_Eve', 
  'Bot_Frank', 'Bot_Grace', 'Bot_Heidi', 'Bot_Ivan', 'Bot_Judy',
  'Bot_Kevin', 'Bot_Leo', 'Bot_Mike', 'Bot_Nina', 'Bot_Oscar'
];

const PERSONALITIES = [
  "aggressive and accusatory",
  "analytical and calm",
  "confused but trying to help",
  "quiet and observant",
  "chaotic and unpredictable",
  "helpful and protective",
  "suspicious of everyone",
  "friendly but gullible"
];

// Map to store assigned personalities
const botPersonalities = new Map<string, string>();

export function generateBotName(existingNames: string[]): string {
  const available = BOT_NAMES.filter(n => !existingNames.includes(n));
  let name = '';
  if (available.length === 0) {
    name = `Bot_${Math.floor(Math.random() * 1000)}`;
  } else {
    name = available[Math.floor(Math.random() * available.length)];
  }
  
  // Assign personality if not already assigned
  if (!botPersonalities.has(name)) {
    const persona = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
    botPersonalities.set(name, persona);
  }
  
  return name;
}

export async function getBotNightAction(
  botId: PlayerId, 
  role: Role, 
  players: Record<PlayerId, Player>, 
  allRoles: Record<PlayerId, Role>,
  gameHistory: string = ""
): Promise<{ action: 'KILL' | 'SAVE' | 'INVESTIGATE', targetId: PlayerId } | null> {
  
  const alivePlayers = Object.values(players).filter(p => p.isAlive && p.id !== botId);
  const deadPlayers = Object.values(players).filter(p => !p.isAlive).map(p => p.name).join(', ');

  if (alivePlayers.length === 0) return null;

  const botName = players[botId]?.name || 'Bot';
  const personality = botPersonalities.get(botName) || 'neutral';
  
  // Prepare prompt based on role
  let goal = "";
  let actionType: 'KILL' | 'SAVE' | 'INVESTIGATE' | null = null;

  switch (role) {
    case 'mafia':
      const partners = Object.entries(allRoles)
        .filter(([id, r]) => r === 'mafia' && id !== botId)
        .map(([id]) => players[id]?.name)
        .filter(Boolean)
        .join(', ');
        
      goal = `You are MAFIA. Eliminate a non-Mafia player. ${partners ? `Your partners are: ${partners}.` : ''} Do NOT target them.`;
      actionType = 'KILL';
      break;
    case 'doctor':
      goal = "You are the DOCTOR. Save a player who might be targeted by Mafia (can be yourself). Do not try to save dead players.";
      actionType = 'SAVE';
      break;
    case 'detective':
      goal = "You are the DETECTIVE. Investigate a player to find the Mafia.";
      actionType = 'INVESTIGATE';
      break;
    case 'vigilante':
      goal = "You are the VIGILANTE. You can kill a suspect, but be careful not to kill a Town member. If you kill a Town member, you will die of guilt.";
      actionType = 'KILL';
      break;
    case 'serial_killer':
      goal = "You are the SERIAL KILLER. Kill anyone.";
      actionType = 'KILL';
      break;
    case 'bodyguard':
      goal = "You are the BODYGUARD. Protect a valuable town member. Do not try to protect dead players.";
      actionType = 'PROTECT' as any; // Using PROTECT internally if needed, or mapping to SAVE logic
      break;
    default:
      return null;
  }

  // If actionType is null (e.g. Townie/Medium), they don't act at night
  if (!actionType) return null;

  const targetsList = alivePlayers.map(p => p.name).join(', ');
  
  const prompt = `
    Role: ${role}
    Name: ${botName}
    Personality: ${personality}
    Goal: ${goal}
    Alive Players (Valid Targets): ${targetsList}
    Dead Players (Invalid Targets): ${deadPlayers || "None"}
    Recent Game History:
    ${gameHistory || "No history yet."}
    
    Role Guide:
    ${ROLE_GUIDE}

    Task: Choose one player name from the "Alive Players" list to target.
    Rules:
    1. You MUST choose a name from "Alive Players".
    2. Do NOT choose a name from "Dead Players".
    3. If you are Vigilante, only kill if you are reasonably sure the target is evil.
    Output: JUST the name. No explanations.
  `;

  console.log(`[Bot ${botName}] Generative Night Action...`);
  const responseName = await generateAIResponse(prompt);
  console.log(`[Bot ${botName}] AI Response: ${responseName}`);

  const target = alivePlayers.find(p => responseName.toLowerCase().includes(p.name.toLowerCase()));

  if (target) {
    return { action: actionType as any, targetId: target.id };
  }

  // Fallback to random if AI fails
  console.log(`[Bot ${botName}] AI failed/skipped, using random fallback.`);
  const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  return { action: actionType as any, targetId: randomTarget.id };
}

export async function getBotDayVote(
  botId: PlayerId, 
  players: Record<PlayerId, Player>,
  chatHistory: string = ""
): Promise<PlayerId | null> {
  const alivePlayers = Object.values(players).filter(p => p.isAlive && p.id !== botId);
  if (alivePlayers.length === 0) return null;
  
  const botName = players[botId]?.name || 'Bot';
  const personality = botPersonalities.get(botName) || 'neutral';
  const targetsList = alivePlayers.map(p => p.name).join(', ');

  const prompt = `
    Name: ${botName}
    Personality: ${personality}
    Alive Players: ${targetsList}
    Chat Log:
    ${chatHistory}
    
    Role Guide:
    ${ROLE_GUIDE}

    Task: Vote to eliminate a player based on the chat.
    Output: The exact name of the player to vote for, or "SKIP" to abstain.
    Rules: 
    1. If you are unsure, you can SKIP.
    2. Respond with ONLY the name or SKIP.
  `;

  console.log(`[Bot ${botName}] Generative Day Vote...`);
  const response = await generateAIResponse(prompt);
  console.log(`[Bot ${botName}] AI Vote: ${response}`);
  
  if (response.toUpperCase().includes('SKIP')) return null;
  
  const target = alivePlayers.find(p => response.toLowerCase().includes(p.name.toLowerCase()));
  return target ? target.id : null;
}

export async function getBotChat(
  botId: PlayerId,
  players: Record<PlayerId, Player>,
  chatHistory: string,
  phase: string,
  allRoles: Record<PlayerId, Role> = {},
  channel: 'global' | 'mafia' | 'dead' = 'global'
): Promise<string | null> {
  const botName = players[botId]?.name || 'Bot';
  const personality = botPersonalities.get(botName) || 'neutral';
  const role = allRoles[botId] || 'unknown';

  const deadPlayers = Object.values(players).filter(p => !p.isAlive).map(p => p.name).join(', ');
  const alivePlayers = Object.values(players).filter(p => p.isAlive).map(p => p.name).join(', ');

  // 30% chance to speak if not prompted (to avoid spam)
  if (Math.random() > 0.3) return null;

  // Role Honesty Logic
  let roleInstruction = "Don't reveal your exact role unless necessary.";
  
  if (channel === 'dead') {
      roleInstruction = "You are DEAD. You are a spirit. Comment on the game from the afterlife. You can mock the living or root for your team. You cannot affect the game anymore.";
  } else if (channel === 'mafia') {
      roleInstruction = "You are speaking in the SECRET MAFIA CHAT. Discuss with your fellow Mafia members. Decide who to kill or how to deceive the Town. Be conspiratorial.";
  } else {
      // Global Chat Logic
      if (phase === 'game_over') {
          roleInstruction = "The game is over. Discuss the result. If you were Mafia, you can reveal it now and brag or complain. If you were Town, react to the outcome. Be gracious or salty based on your personality.";
      } else {
          // Roles aligned with Town/Civilians
          if (['civilian', 'doctor', 'detective', 'bodyguard', 'vigilante', 'medium', 'mayor'].includes(role)) {
              roleInstruction = "You are on the Civilian/Town team. Be honest about being a Civilian. Do NOT lie and claim to be Mafia. You want to eliminate the Mafia.";
          } else if (role === 'mafia') {
              roleInstruction = "You are MAFIA. You must deceive everyone. Pretend to be a Civilian. Do NOT reveal you are Mafia.";
          }
      }
  }

  const prompt = `
    Name: ${botName}
    Role: ${role}
    Personality: ${personality}
    Phase: ${phase}
    Channel: ${channel}
    Alive Players: ${alivePlayers}
    Dead Players: ${deadPlayers || "None"}
    Chat Log:
    ${chatHistory}
    
    Role Guide (Terminology Source):
    ${ROLE_GUIDE}

    Instruction: ${roleInstruction}
    Task: Write a short chat message (max 15 words).
    Rules:
    1. Sound natural, like a human player.
    2. Don't reveal you are a bot.
    3. If the chat is empty, start a conversation.
    4. IMPORTANT: Use ONLY the role names and terminology from the Role Guide above. 
       - Do NOT use terms like "crewmate" or "impostor".
       - Use "Civilian" instead of "villager".
       - Use "Mafia" instead of "impostor".
    5. React to the latest messages.
    6. If the phase is 'game_over', discuss who won and the roles revealed.
    7. Be aware of who is dead. Do not talk to them as if they are alive (unless you are also dead).
    Output: Just the message text.
  `;

  const response = await generateAIResponse(prompt);
  return response.replace(/"/g, '').trim();
}
