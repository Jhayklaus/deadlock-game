export interface RoleDefinition {
  name: string;
  description: string;
  details: string[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: 'Mafia',
    description: 'Eliminate all Town members.',
    details: [
      'Knows other Mafia members.',
      'Can kill one person each Night.',
      'Wins when Mafia >= Town.',
    ]
  },
  {
    name: 'Doctor',
    description: 'Protect players from death.',
    details: [
      'Can choose one person to Save each Night.',
      'Saved target cannot be killed by Mafia or Vigilante.',
      'Can save themselves.'
    ]
  },
  {
    name: 'Detective',
    description: 'Gather information.',
    details: [
      'Can Investigate one person each Night.',
      'Learns if the target is Mafia or Innocent.',
      'Results are private.'
    ]
  },
  {
    name: 'Vigilante',
    description: 'High-risk justice.',
    details: [
      'Can choose to Kill someone at Night.',
      'If target is Mafia -> Mafia dies.',
      'If target is Innocent -> Vigilante dies of guilt.'
    ]
  },
  {
    name: 'Mayor',
    description: 'Political power.',
    details: [
      'Vote counts as 2 during Day phase.',
      'Revealed only when voting (or keeps it secret).',
      'Otherwise acts as a Civilian.'
    ]
  },
  {
    name: 'Serial Killer',
    description: 'Neutral Killing.',
    details: [
      'Kills one person each Night.',
      'Wins if last player alive (or 1v1).',
      'Enemy to both Town and Mafia.'
    ]
  },
  {
    name: 'Jester',
    description: 'Neutral Evil.',
    details: [
      'Wants to be voted out during the Day.',
      'Wins immediately if eliminated by vote.',
      'Loses if killed at Night or survives.'
    ]
  },
  {
    name: 'Civilian',
    description: 'The innocent majority.',
    details: [
      'No night abilities.',
      'Must use discussion and voting to find Mafia.',
      'Wins when all Mafia are eliminated.'
    ]
  },
  {
    name: 'Bodyguard',
    description: 'Protects others at a cost.',
    details: [
      'Choose one person to Protect each Night.',
      'If target is attacked, you die instead.',
      'Cannot protect themselves.'
    ]
  },
  {
    name: 'Medium',
    description: 'Speaks to the dead.',
    details: [
      'Can read Dead Chat during the Night.',
      'Can whisper to dead players.',
      'Gathers information from eliminated players.'
    ]
  }
];
