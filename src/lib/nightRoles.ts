/**
 * What each role can do after dark.
 *
 * Declaring abilities in one table keeps the night UI honest: a role that is
 * absent here simply has no night action and gets the "sleep" screen, so
 * adding a role is a matter of adding a row rather than editing a chain of
 * conditionals across the component.
 */
import type { Role, NightActionType } from './types';

export interface NightAbility {
  /** Message sent to the host. */
  readonly action: NightActionType;
  /** Button label. */
  readonly label: string;
  /** Heading above the target list. */
  readonly prompt: string;
  /** Targets the actor themselves — no picker, just a confirmation. */
  readonly selfTarget?: boolean;
  /** Needs a second pick (the Witch redirects a victim onto a new target). */
  readonly twoTargets?: boolean;
  /** Prompt for the second pick. */
  readonly secondPrompt?: string;
  /** May the actor pick themselves? */
  readonly canTargetSelf?: boolean;
  /** Total uses for the whole game, when limited. */
  readonly charges?: number;
  /** Styling hint for the confirm button. */
  readonly tone: 'danger' | 'primary' | 'accent';
  /** One line explaining the ability, shown above the picker. */
  readonly hint: string;
}

export const NIGHT_ABILITIES: Partial<Record<Role, NightAbility>> = {
  mafia: {
    action: 'KILL',
    label: 'Kill Target',
    prompt: 'Choose tonight’s victim',
    tone: 'danger',
    hint: 'Agree on a target with your partners. Only one kill lands per night.',
  },
  serial_killer: {
    action: 'KILL',
    label: 'Kill Target',
    prompt: 'Choose tonight’s victim',
    tone: 'danger',
    hint: 'You work alone. Everyone else is in your way.',
  },
  vigilante: {
    action: 'KILL',
    label: 'Take the Shot',
    prompt: 'Choose who to shoot',
    tone: 'danger',
    hint: 'Shoot a Town member by mistake and the guilt will kill you too.',
  },
  doctor: {
    action: 'SAVE',
    label: 'Save Life',
    prompt: 'Choose who to heal',
    canTargetSelf: true,
    tone: 'primary',
    hint: 'Your patient survives any attack tonight. You may treat yourself.',
  },
  bodyguard: {
    action: 'PROTECT',
    label: 'Stand Guard',
    prompt: 'Choose who to guard',
    tone: 'primary',
    hint: 'If your charge is attacked, you take the blow instead and die.',
  },
  detective: {
    action: 'INVESTIGATE',
    label: 'Investigate',
    prompt: 'Choose who to investigate',
    tone: 'primary',
    hint: 'You learn whether they read as suspicious. A Framer can fool you.',
  },
  escort: {
    action: 'ROLEBLOCK',
    label: 'Distract',
    prompt: 'Choose who to distract',
    tone: 'accent',
    hint: 'Their night action does nothing. Never visit a Veteran on alert.',
  },
  lookout: {
    action: 'WATCH',
    label: 'Stake Out',
    prompt: 'Choose who to watch',
    tone: 'accent',
    hint: 'You see the name of everyone who visits them tonight.',
  },
  framer: {
    action: 'FRAME',
    label: 'Frame',
    prompt: 'Choose who to frame',
    tone: 'danger',
    hint: 'They read as suspicious to the Detective tonight, whoever they are.',
  },
  veteran: {
    action: 'ALERT',
    label: 'Go on Alert',
    prompt: 'Stand watch tonight',
    selfTarget: true,
    charges: 3,
    tone: 'danger',
    hint: 'You kill everyone who visits you and survive any attack. Visitors may well be innocent.',
  },
  survivor: {
    action: 'VEST',
    label: 'Put on Vest',
    prompt: 'Protect yourself tonight',
    selfTarget: true,
    charges: 3,
    tone: 'primary',
    hint: 'You survive any attack tonight. All you have to do is outlast everyone.',
  },
  witch: {
    action: 'CONTROL',
    label: 'Cast Control',
    prompt: 'Choose who to control',
    secondPrompt: 'Point their action at',
    twoTargets: true,
    tone: 'accent',
    hint: 'Their night action is redirected wherever you point it.',
  },
};

export function getNightAbility(role: Role | null): NightAbility | null {
  return role ? NIGHT_ABILITIES[role] ?? null : null;
}
