import type { GameModeId } from './types';

/**
 * What each mode actually is, written for the bots.
 *
 * Two things were making them sound wrong.
 *
 * The first is that Word Impostor calls its roles "crewmate" and "impostor",
 * which are Among Us words. Handed those and nothing else, a language model
 * reaches for the rest of that game: venting, electrical, bodies, tasks,
 * running between rooms. Players then read messages about a map that does not
 * exist. So each briefing says in plain terms what the game is and, just as
 * importantly, what it is not.
 *
 * The second is that bots were never told their own secret — the word, the
 * number, the category. A "crewmate who knows the secret word" was bluffing as
 * blindly as the impostor, which is both poor play and a tell. `secretBrief`
 * closes that.
 */
export interface ModeBriefing {
  /** What the game is and how a turn works. */
  readonly premise: string;
  /** What does not exist here. Kept explicit — this is what stops the drift. */
  readonly notThis: string;
  /** What a message should actually sound like. */
  readonly speak: string;
}

export const MODE_BRIEFINGS: Record<GameModeId, ModeBriefing> = {
  classic_mafia: {
    premise:
      'A conversation game played entirely in a chat room. At night a few hidden ' +
      'roles secretly choose a target; by day everyone argues about who the Mafia ' +
      'are and votes one person out.',
    notThis:
      'There is no map, no rooms, no movement, no tasks and no bodies to find. ' +
      'Nobody can see anybody. All you ever have is what people have typed.',
    speak:
      'Argue from what was actually said and how people voted. Name players. ' +
      'Claim or question roles.',
  },

  word_impostor: {
    premise:
      'A word game played entirely in a chat room. Everyone shares one secret ' +
      'word except the impostor, who knows only the category. Each round every ' +
      'player types one short clue about the word, then the table votes out ' +
      'whoever sounds like they do not know it.',
    notThis:
      'This is NOT Among Us and NOT a video game, despite the words "crewmate" ' +
      'and "impostor". There is no map, no rooms, no tasks, no sabotage, no ' +
      'venting, no bodies, no emergency meetings and no moving around. Never ' +
      'mention seeing anyone anywhere or doing anything physical.',
    speak:
      'Talk about the clues people gave: too vague, too specific, does not fit. ' +
      'Your own message is usually a clue about the word, or a read on someone.',
  },

  undercover: {
    premise:
      'A word game played entirely in a chat room. Most players share a common ' +
      'word; the Undercoverts have a similar but different one; a Blank has no ' +
      'word at all. Everyone describes their word without saying it, then the ' +
      'table votes out whoever seems to have a different one.',
    notThis:
      'There is no map, no rooms, no movement, no tasks and no bodies. Nobody ' +
      'can see anybody. Everything happens through typed descriptions.',
    speak:
      'Compare descriptions. Point out one that is subtly off, or too general to ' +
      'commit to anything.',
  },

  frequency_spy: {
    premise:
      'A number game played entirely in a chat room. There is a spectrum with a ' +
      'label at each end. Everyone except the Spy shares the same secret number ' +
      'on it; the Spy\'s number is somewhere else. Each player gives a clue whose ' +
      'strength should match their number, then the table votes out whoever ' +
      'sounds off-frequency.',
    notThis:
      'There is no map, no rooms, no movement, no tasks and no bodies. "Signal" ' +
      'and "frequency" are flavour for the number scale, not a place or a device ' +
      'you can go to.',
    speak:
      'Give a clue pitched at your number, or say whose clue felt too strong or ' +
      'too weak for where the group is.',
  },

  deadlock: {
    premise:
      'A station game on a flat 2D map. Players click to move one room at a time ' +
      'along connecting corridors, run console tasks, and watch each other. ' +
      'Impostors kill quietly and trigger sabotage. Finding a body calls everyone ' +
      'into a meeting, and the meeting is a text discussion followed by a vote.',
    notThis:
      'It is not a 3D game and nothing happens in real time during a meeting — ' +
      'while you are talking, nobody is moving. You only know where someone was ' +
      'if you were in the same room. Do not describe running, chasing, or seeing ' +
      'across the station.',
    speak:
      'Say which room you were in and what you were doing, who was with you, and ' +
      'whether that matches what they claim.',
  },
};

/**
 * The bot's own private information, phrased so it can act on it.
 *
 * Takes the same per-player payload the real player receives, so a bot knows
 * exactly what a human in its seat would know — no more.
 */
export function secretBrief(
  mode: GameModeId,
  roleId: string,
  payload: Record<string, unknown> | undefined
): string {
  const p = payload ?? {};
  const word = (p.assignedWord as string | null) ?? null;
  const category = (p.assignedCategory as string | null) ?? null;
  const num = (p.assignedNumber as number | null) ?? null;

  switch (mode) {
    case 'word_impostor':
      return roleId === 'impostor'
        ? `You do NOT know the secret word. All you know is the category: "${category ?? 'unknown'}". ` +
          'Give a clue vague enough to fit anything in that category, and work out the word from what others say.'
        : `The secret word is "${word ?? 'unknown'}" (category: "${category ?? 'unknown'}"). ` +
          'Give a clue that genuinely fits it without naming it or any part of it.';

    case 'undercover':
      if (roleId === 'blank') {
        return 'You have NO word. Everyone else has one. Infer it from what others say and describe ' +
               'it convincingly enough that nobody notices you are guessing.';
      }
      return `Your word is "${word ?? 'unknown'}"${category ? ` (hint: "${category}")` : ''}. ` +
        (roleId === 'undercover'
          ? 'Most players have a DIFFERENT word that is close to yours. Describe yours in terms that ' +
            'would also fit theirs, so you blend in.'
          : 'Describe it without saying it, and watch for anyone whose description does not quite fit.');

    case 'frequency_spy': {
      const topic = (p.frequencyTopic as string | null) ?? 'the scale';
      const low = (p.frequencyLowLabel as string | null) ?? 'low';
      const high = (p.frequencyHighLabel as string | null) ?? 'high';
      return `The spectrum is "${topic}", running from "${low}" (1) to "${high}" (100). ` +
        `Your secret number is ${num ?? '?'}. Give an example or statement pitched at exactly that ` +
        `point on the scale — not a number, a thing that sits there.` +
        (roleId === 'frequency_spy'
          ? ' Yours differs from everyone else\'s, so aim slightly toward where you think the group is.'
          : ' Everyone else on your side shares this number.');
    }

    case 'deadlock': {
      const tasks = (p.tasks as string[] | undefined) ?? [];
      return roleId === 'station_impostor'
        ? 'You are an impostor. You cannot complete tasks — your task list is a cover story. ' +
          'Account for your movements plausibly and cast doubt elsewhere.'
        : `Your assigned task rooms are: ${tasks.length ? tasks.join(', ') : 'none yet'}. ` +
          'Say honestly where you were and what you were doing.';
    }

    default:
      return '';
  }
}

/** The full briefing block that goes into a bot prompt. */
export function briefingBlock(mode: GameModeId): string {
  const b = MODE_BRIEFINGS[mode] ?? MODE_BRIEFINGS.classic_mafia;
  return [
    `THE GAME: ${b.premise}`,
    `IMPORTANT — WHAT THIS GAME IS NOT: ${b.notThis}`,
    `HOW TO TALK: ${b.speak}`,
  ].join('\n    ');
}

/**
 * How each classic role should play the conversation.
 *
 * Every Town role used to be handed the same line — "be honest about being a
 * Civilian" — which told a Detective to throw away the one thing it knew and
 * left nine roles with no guidance at all. A role's value in Mafia is mostly
 * in what it learns and when it says so, which is exactly what was missing.
 */
export interface RolePlay {
  /** What you are trying to achieve. */
  readonly goal: string;
  /** What you privately know, and what to do with it. */
  readonly play: string;
}

export const ROLE_PLAY: Record<string, RolePlay> = {
  // ── Town ──────────────────────────────────────────────────────────────────
  civilian: {
    goal: 'Find and vote out the Mafia. You have no night action.',
    play: 'You genuinely know nothing private, so your value is reading others. ' +
      'Say so honestly if asked; a fake claim muddies the real ones.',
  },
  detective: {
    goal: 'Find the Mafia by investigating one player each night.',
    play: 'Your results are the most valuable thing the Town has. Hold a claim ' +
      'back until it changes a vote, because claiming marks you for death. When ' +
      'you do speak, name who you checked and what came back.',
  },
  doctor: {
    goal: 'Keep the Town alive by saving one player each night.',
    play: 'Never claim early — the Mafia will kill you first. If you saved ' +
      'someone, you know an attack happened and roughly who was targeted. Use ' +
      'that without explaining how you know.',
  },
  bodyguard: {
    goal: 'Protect one player each night, dying in their place if attacked.',
    play: 'Stay quiet about who you are guarding. If your charge was attacked ' +
      'you know they were a target, which usually means they are Town.',
  },
  vigilante: {
    goal: 'Shoot someone you are confident is evil. Shooting Town kills you.',
    play: 'Push hard for information before firing, because a wrong shot ends ' +
      'you too. Do not claim unless you need the Town to trust a kill you made.',
  },
  mayor: {
    goal: 'Lead the Town. Your vote counts double.',
    play: 'Revealing makes you a target but makes your vote visibly count. ' +
      'Weigh it. Until then you argue like anyone else.',
  },
  medium: {
    goal: 'Talk to the dead at night and bring what they know back to the Town.',
    play: 'The dead know who killed them. That is real evidence, but relaying ' +
      'it marks you immediately — decide whether this vote is worth your life.',
  },
  escort: {
    goal: 'Block one player\'s night action each night.',
    play: 'If the person you blocked complains that nothing happened, that tells ' +
      'you they had an action. A quiet night after you blocked someone is a hint ' +
      'they were the killer.',
  },
  veteran: {
    goal: 'Go on alert and kill everyone who visits you that night.',
    play: 'Anyone who died at your door visited you, which is suspicious but not ' +
      'proof — Doctors and Lookouts visit too. You have limited alerts.',
  },
  lookout: {
    goal: 'Watch one player each night and see everyone who visited them.',
    play: 'A visitor list on a player who then died is close to proof. Say who ' +
      'you watched and who you saw, but expect to be killed for it.',
  },
  spy: {
    goal: 'Listen in on the Mafia and learn where they struck.',
    play: 'You know the target but not the killer. That still narrows things: ' +
      'whoever defended the target hardest beforehand is worth a second look.',
  },

  // ── Mafia ─────────────────────────────────────────────────────────────────
  mafia: {
    goal: 'Kill the Town at night and survive the vote by day.',
    play: 'Claim Civilian and behave like one. Never defend a partner too hard ' +
      'and never accuse one convincingly late — both read as theatre. Agreeing ' +
      'with a Town read is cheaper than inventing one.',
  },
  framer: {
    goal: 'Make an innocent player read as Mafia to the Detective.',
    play: 'You are Mafia. Set up the player you framed by nudging suspicion ' +
      'their way early, so the Detective\'s result lands on prepared ground.',
  },

  // ── Neutral ───────────────────────────────────────────────────────────────
  serial_killer: {
    goal: 'Be the last one standing. Everyone is your enemy.',
    play: 'Blend in with the Town and let them fight the Mafia for you. Avoid ' +
      'being the loudest voice in either direction.',
  },
  jester: {
    goal: 'Get yourself voted out. That is how you win.',
    play: 'Be irritating enough to draw a vote but not so obvious that they ' +
      'realise what you are and spare you. Overacting loses you the game.',
  },
  survivor: {
    goal: 'Simply be alive when the game ends. You have limited vests.',
    play: 'Back whichever side is winning and avoid making enemies. You can ' +
      'admit to being Survivor safely — nobody gains from killing you.',
  },
  executioner: {
    goal: 'Get your assigned target voted out. Nothing else matters.',
    play: 'Build a case against your target that sounds like honest Town ' +
      'reasoning. Pushing too hard too early gets you read as the Executioner.',
  },
  witch: {
    goal: 'Control a player each night and point their action where you like.',
    play: 'You win with the last side standing, so stir things up. You know ' +
      'what the player you controlled was able to do, which is information ' +
      'nobody else has.',
  },
};

/** The role block for a classic-mafia bot prompt. */
export function rolePlayBlock(role: string): string {
  const r = ROLE_PLAY[role];
  if (!r) return '';
  return `YOUR ROLE (${role.replace(/_/g, ' ')}): ${r.goal}\n    HOW YOU PLAY IT: ${r.play}`;
}
