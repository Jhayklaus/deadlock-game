/**
 * Per-mode walkthroughs for players meeting a game for the first time.
 *
 * Each guide is a short sequence of steps covering the goal, what you are
 * given, how a round runs, and how the game is actually won. Rules here must
 * track the mode definitions in src/modes/ — in particular that side modes
 * run over MULTIPLE rounds and do not end on the first elimination.
 */
import type { GameModeId } from '../lib/types';

/** Icon keys, resolved to Lucide components in ModeGuide.tsx. */
export type GuideIcon =
  | 'users'
  | 'moon'
  | 'sun'
  | 'vote'
  | 'trophy'
  | 'lightbulb'
  | 'eye'
  | 'message'
  | 'key'
  | 'radio'
  | 'skull'
  | 'repeat';

export interface GuideExample {
  readonly label: string;
  readonly lines: ReadonlyArray<string>;
}

export interface GuideStep {
  readonly icon: GuideIcon;
  readonly title: string;
  readonly body: string;
  readonly example?: GuideExample;
  /** `win` highlights victory conditions, `warn` highlights common mistakes. */
  readonly tone?: 'default' | 'win' | 'warn';
}

export interface ModeGuide {
  readonly modeId: GameModeId;
  readonly name: string;
  readonly tagline: string;
  readonly length: string;
  readonly steps: ReadonlyArray<GuideStep>;
}

const classicMafia: ModeGuide = {
  modeId: 'classic_mafia',
  name: 'Classic Mafia',
  tagline: 'Trust no one',
  length: '15–30 min',
  steps: [
    {
      icon: 'users',
      title: 'Two sides, secret roles',
      body:
        'Everyone is secretly dealt a role. Most of you are Town — ordinary people who do not know who anyone else is. A small group is Mafia, and they know each other. The Town has numbers; the Mafia has information. Some games also include neutral roles who play only for themselves.',
    },
    {
      icon: 'moon',
      title: 'Night: the Mafia move',
      body:
        'The town sleeps and the special roles act. The Mafia agree on someone to kill in their private chat. The Doctor picks someone to protect. The Detective investigates one player and learns whether they are Mafia. Everyone else simply waits for morning.',
      example: {
        label: 'During the night',
        lines: [
          'Mafia choose a target together',
          'Doctor shields one player',
          'Detective checks one player',
        ],
      },
    },
    {
      icon: 'sun',
      title: 'Day: work out who did it',
      body:
        'Morning reveals who died, if anyone — the Doctor may have saved them. Now everyone talks. Share what you know, claim a role if it helps, and watch who contradicts themselves. The Mafia are in this conversation too, sounding just as helpful as everyone else.',
    },
    {
      icon: 'vote',
      title: 'Vote someone out',
      body:
        'When discussion ends, everyone votes. Whoever takes the most votes is put on trial. You can also skip — a tie or a skip majority means nobody goes to trial at all, and night falls.',
    },
    {
      icon: 'skull',
      title: 'The trial',
      body:
        'The accused gets the floor to defend themselves — claim a role, name a suspect, say anything that helps. Then everyone else votes guilty, innocent or abstain. Only a guilty majority eliminates them, and a tie acquits, so the town has to be sure. The Mayor\u2019s vote counts double here too. Hosts can switch trials off for a faster game.',
      example: {
        label: 'A verdict',
        lines: [
          'Guilty 4  \u2013  Innocent 3   \u2192  eliminated',
          'Guilty 3  \u2013  Innocent 3   \u2192  walks free',
        ],
      },
    },
    {
      icon: 'trophy',
      title: 'How it ends',
      tone: 'win',
      body:
        'The Town wins by eliminating every Mafia member and killer. The Mafia win once they equal the number of remaining townspeople, because from there they cannot be outvoted. Neutral roles like the Jester have their own private goal and can win on their own terms.',
    },
    {
      icon: 'eye',
      title: 'Beyond the basics',
      body:
        'Hosts can switch on extra roles, and they change how the night works. An Escort blocks someone\u2019s action outright. A Framer makes an innocent read as Mafia to the Detective. A Lookout sees everyone who visits a player — the hardest evidence in the game. A Veteran can go on alert and kill anyone who comes to their door, which includes the Doctor coming to help. And some players answer to nobody: a Survivor just needs to be alive at the end, while an Executioner only wants one specific person lynched.',
      example: {
        label: 'Why night order matters',
        lines: [
          'The Escort blocks the Doctor → the Mafia kill gets through',
          'The Framer marks you  → the Detective reads you as Mafia',
          'You visit an alert Veteran → you die, however innocent you are',
        ],
      },
    },
    {
      icon: 'lightbulb',
      title: 'Tips for your first game',
      body:
        'Say something early — silence reads as hiding. Pay attention to who pushes a vote hardest, and who quietly agrees with everything. If you have a power role, think carefully about when to reveal it: claiming Detective makes you useful to the Town and a target for the Mafia on the very same night.',
    },
  ],
};

const wordImpostor: ModeGuide = {
  modeId: 'word_impostor',
  name: 'Word Impostor',
  tagline: 'Find the fake',
  length: '10–20 min',
  steps: [
    {
      icon: 'key',
      title: 'Almost everyone gets the word',
      body:
        'A secret word is drawn and shown to every Crewmate. One player — two in larger games — is the Impostor, and they see only the category. They know the subject of the conversation, but not the thing itself.',
      example: {
        label: 'What each side sees',
        lines: [
          'Crewmates:  "Guitar"  (category: Instruments)',
          'Impostor:   category: Instruments',
        ],
      },
    },
    {
      icon: 'message',
      title: 'Give a clue in turn',
      body:
        'Each player says one short clue about the word. The trick is aiming between two failures: too vague and the Crewmates suspect you, too precise and you have just handed the word to the Impostor. The Impostor has to invent a clue that sounds like it came from someone who knows.',
      example: {
        label: 'Clues for "Guitar"',
        lines: [
          'Good:     "Strings"     — proves you know, gives little away',
          'Too much: "Six strings" — the Impostor can work it out',
          'Too thin: "Loud"        — could be anything, looks evasive',
        ],
      },
    },
    {
      icon: 'vote',
      title: 'Vote out your suspect',
      body:
        'After the clues, everyone votes for whoever felt off. The player with the most votes is eliminated and the game tells you whether you were right.',
    },
    {
      icon: 'repeat',
      title: 'Getting it wrong is not the end',
      tone: 'warn',
      body:
        'Vote out a Crewmate and play simply continues into another round with one fewer player. You lose information and ground, but not the game. Keep going until you catch the Impostor — or until there are too few of you left to outvote them.',
    },
    {
      icon: 'eye',
      title: 'The Impostor gets one last shot',
      body:
        'An Impostor who is voted out is not finished. They get 45 seconds to name the secret word. Guess it and they steal the win outright, however well the Crewmates played. If two Impostors are in the game and the first guesses wrong, the second is still out there and the game carries on.',
    },
    {
      icon: 'trophy',
      title: 'How it ends',
      tone: 'win',
      body:
        'Crewmates win by voting out every Impostor without any of them guessing the word. Impostors win by guessing it, or by surviving until they match the number of Crewmates left.',
    },
  ],
};

const undercover: ModeGuide = {
  modeId: 'undercover',
  name: 'Undercover',
  tagline: 'Blend in',
  length: '10–20 min',
  steps: [
    {
      icon: 'users',
      title: 'Three kinds of player',
      body:
        'Most of you are Civilians sharing one common word. One or two Undercover agents get a different word — related, but not the same. In larger games one player is Blank: they get no word at all and have to work out what everyone is talking about while pretending they already know.',
      example: {
        label: 'A typical deal',
        lines: [
          'Civilians:  "Coffee"',
          'Undercover: "Tea"',
          'Blank:      nothing at all',
        ],
      },
    },
    {
      icon: 'message',
      title: 'Describe your word',
      body:
        'Each player gives one clue describing their own word. Because the two words are so close, the Undercover can often blend in for a round or two without realising they are the odd one out — and neither can anyone else.',
      example: {
        label: 'Clues for "Coffee" vs "Tea"',
        lines: [
          '"Morning"  — true of both, totally safe',
          '"Beans"    — Civilian-only, and a gift to the Undercover',
          '"Hot"      — safe but weak, two of these and you look suspect',
        ],
      },
    },
    {
      icon: 'vote',
      title: 'Vote out the odd one',
      body:
        'After everyone has spoken, vote for whoever seemed least sure of the word. The eliminated player is revealed.',
    },
    {
      icon: 'repeat',
      title: 'Rounds keep going',
      tone: 'warn',
      body:
        'Voting out a Civilian does not end the game. Everyone describes their word again, with one voice fewer and better information than before. Clues naturally get bolder each round as the safe ones get used up.',
    },
    {
      icon: 'trophy',
      title: 'How it ends',
      tone: 'win',
      body:
        'Civilians win by voting out every Undercover agent. The Undercover win by surviving until they equal the number of Civilians left. The Blank player wins alongside the Civilians — if they can stay in long enough to work out the word.',
    },
    {
      icon: 'lightbulb',
      title: 'Tips for your first game',
      body:
        'As a Civilian, do not lead with your most specific clue — you will hand the Undercover everything they need. As the Undercover, listen hard to the first round and steer toward whatever both words share. As the Blank, speak late and stay general until the picture comes together.',
    },
  ],
};

const frequencySpy: ModeGuide = {
  modeId: 'frequency_spy',
  name: 'Frequency Spy',
  tagline: 'Find the outlier',
  length: '10–20 min',
  steps: [
    {
      icon: 'radio',
      title: 'A spectrum and a number',
      body:
        'Everyone sees the same spectrum — something like Temperature, running from Freezing to Scorching. Everyone also gets the same secret number from 1 to 100, placing them somewhere along it. Everyone except the Spy, who gets a number far away from the rest of you.',
      example: {
        label: 'Spectrum: Freezing → Scorching',
        lines: [
          'Everyone:  72   (fairly hot)',
          'The Spy:   18   (quite cold)',
        ],
      },
    },
    {
      icon: 'message',
      title: 'Give a clue at your number',
      body:
        'Each player names something that sits at their number on the spectrum. Everyone but the Spy is aiming at the same point, so the clues should cluster — and the Spy, aiming at a different one, has to guess where everybody else is standing.',
      example: {
        label: 'Clues at 72 on Freezing → Scorching',
        lines: [
          '"Beach day"     — lands around 70, fits',
          '"Sauna"         — more like 95, too far up',
          '"Light jacket"  — around 40, you are the Spy',
        ],
      },
    },
    {
      icon: 'vote',
      title: 'Vote out the off-frequency player',
      body:
        'After the clues, vote for whoever sat furthest from the group. Someone slightly off may simply have read the spectrum differently — the Spy is usually the one who is off in a consistent direction.',
    },
    {
      icon: 'repeat',
      title: 'One wrong vote is survivable',
      tone: 'warn',
      body:
        'Voting out a Civilian costs you a voice but not the game. A new spectrum round begins and the remaining players clue again. The Spy has to stay plausible every single round; you only have to catch them once.',
    },
    {
      icon: 'trophy',
      title: 'How it ends',
      tone: 'win',
      body:
        'Civilians win by voting out the Spy. The Spy wins by surviving until they equal the number of Civilians left.',
    },
    {
      icon: 'lightbulb',
      title: 'Tips for your first game',
      body:
        'Clue in the same units everyone else is using — if the group is naming places and you name a feeling, you look off even when your number is right. As the Spy, go second or third if you can: one clue from the group tells you roughly where to aim.',
    },
  ],
};


const deadlock: ModeGuide = {
  modeId: 'deadlock',
  name: 'Deadlock',
  tagline: 'Nobody is coming',
  length: '10\u201320 min',
  steps: [
    {
      icon: 'users',
      title: 'A station and a problem',
      body:
        'Everyone is aboard a dead station. Most of you are Crew, with repairs to run. One or two are Impostors, who are here to kill the rest of you quietly. Nobody knows who is who.',
    },
    {
      icon: 'repeat',
      title: 'Moving around',
      body:
        'Click any room connected to yours to walk there. You can see who else is in a room from the dots on the map, so where you go is public \u2014 and so is who you were alone with.',
      example: {
        label: 'Reading the map',
        lines: [
          'Dots      \u2014  players standing in that room',
          'Ringed dot\u2014  that is you',
          'Amber dot \u2014  one of your tasks is in there',
          'Red cross \u2014  a body nobody has reported yet',
        ],
      },
    },
    {
      icon: 'key',
      title: 'Run your tasks',
      body:
        'Each of you is dealt three tasks in specific rooms. Go to the room, open the console, finish the job. Impostors get a task list too \u2014 theirs does nothing, but standing at a console is good cover, and doing nothing all game is what gets people caught.',
    },
    {
      icon: 'skull',
      title: 'Killing, and being seen',
      body:
        'An Impostor can kill anyone standing in the same room, then has to wait out a cooldown before killing again. The body stays where it fell. The real danger is a third person walking in \u2014 or noticing that you and the victim were last seen together.',
    },
    {
      icon: 'eye',
      title: 'Sabotage',
      body:
        'Impostors do not run tasks. Instead they break the station: cut the lights so nobody can see past their own room, seal the doors of the room they are standing in, or trigger a reactor meltdown. The reactor is the dangerous one \u2014 if no crewmate reaches it in time, the crew lose outright, so it drags everyone away from whatever they were doing.',
      example: {
        label: 'What each one does',
        lines: [
          'Lights   \u2014  nobody sees other rooms. Fix in Engineering',
          'Doors    \u2014  seals the saboteur\u2019s room. Lapses on its own',
          'Reactor  \u2014  crew lose if nobody reaches it. Fix in the Reactor',
        ],
      },
    },
    {
      icon: 'eye',
      title: 'The shafts',
      body:
        'Impostors can also use the maintenance shafts, which join rooms that are nowhere near each other on foot. It is the fastest way across the station and the easiest way to be caught \u2014 arriving somewhere you could not possibly have walked from is exactly what the crew is watching for.',
    },
    {
      icon: 'vote',
      title: 'Calling everyone together',
      body:
        'Find a body and you can report it. You can also call one emergency meeting per game from anywhere, for when something is obviously wrong. Either way everyone is pulled back to the bridge and you argue it out and vote \u2014 exactly like a round of Mafia. The meeting shows where every player was standing when it was called, which is the hard evidence in the room. Then it is back to the station.',
    },
    {
      icon: 'trophy',
      title: 'How it ends',
      tone: 'win',
      body:
        'The Crew win by voting out every Impostor \u2014 or by finishing every task on the station, without catching anyone at all. The Impostors win once they match the number of Crew still alive.',
    },
    {
      icon: 'lightbulb',
      title: 'Tips for your first game',
      body:
        'As Crew, do your tasks where people can see you \u2014 an alibi is worth more than speed, and the task bar is a win condition the Impostors cannot touch. Try not to be the last person alone with anybody. As an Impostor, kill where nobody is heading and leave before the body is found; the hardest question to answer in a meeting is simply "where were you?".',
    },
  ],
};

const GUIDES: Record<GameModeId, ModeGuide> = {
  classic_mafia: classicMafia,
  word_impostor: wordImpostor,
  undercover: undercover,
  frequency_spy: frequencySpy,
  deadlock: deadlock,
};

export function getModeGuide(modeId: GameModeId): ModeGuide {
  return GUIDES[modeId] ?? classicMafia;
}

export function getAllModeGuides(): ReadonlyArray<ModeGuide> {
  return Object.values(GUIDES);
}
