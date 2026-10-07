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
    name: 'Escort',
    description: 'Distract and disable.',
    details: [
      'Blocks one player\u2019s night action.',
      'The blocked player is told, but not by whom.',
      'Visiting a Veteran on alert will get you killed.',
    ]
  },
  {
    name: 'Veteran',
    description: 'Dangerous to approach.',
    details: [
      'Go on alert to kill everyone who visits you.',
      'Immune to attacks while on alert.',
      'Three alerts per game \u2014 and visitors are often innocent.',
    ]
  },
  {
    name: 'Lookout',
    description: 'Watches the doors.',
    details: [
      'Stake out one player each night.',
      'You see the name of everyone who visits them.',
      'The single best source of hard evidence in the game.',
    ]
  },
  {
    name: 'Spy',
    description: 'Listens in.',
    details: [
      'Each night you learn who the Mafia attacked.',
      'You do not learn which Mafia member did it.',
      'Requires no action and cannot be roleblocked.',
    ]
  },
  {
    name: 'Framer',
    description: 'Mafia deceiver.',
    details: [
      'Frame one player each night.',
      'They read as suspicious to the Detective.',
      'Wins with the Mafia and shares their chat.',
    ]
  },
  {
    name: 'Survivor',
    description: 'Neutral. Just stay alive.',
    details: [
      'Wins with whoever wins, as long as you live.',
      'Three bulletproof vests per game.',
      'Everyone\u2019s friend, nobody\u2019s ally.',
    ]
  },
  {
    name: 'Executioner',
    description: 'Neutral. One mark.',
    details: [
      'Assigned a Town player at the start.',
      'Wins the moment that player is voted out.',
      'The win is banked \u2014 the game plays on without you.',
    ]
  },
  {
    name: 'Witch',
    description: 'Neutral puppeteer.',
    details: [
      'Control one player each night.',
      'Their action is redirected wherever you point it.',
      'Wins by surviving to the end of the game.',
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
