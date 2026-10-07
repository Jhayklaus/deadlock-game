/**
 * Night resolution, as a pure function.
 *
 * Ordering is the whole game here: a roleblock has to land before the action
 * it cancels, a frame before the investigation it corrupts, and protection
 * before the attack it absorbs. Resolving in arrival order instead would make
 * outcomes depend on who happened to click first.
 *
 * Kept free of network, store and React imports so the rules can be exercised
 * directly — this is the most intricate logic in the game and the easiest
 * place for an ordering bug to hide.
 */
import type { PlayerId, Role } from './types';
import { isTownRole, isMafiaRole } from './types';

/** Starting charges for abilities limited to a few uses per game. */
export const ABILITY_CHARGES: Partial<Record<Role, number>> = {
  veteran: 3,
  survivor: 3,
};

export interface NightActions {
  mafiaVote: Record<PlayerId, PlayerId>;
  doctorTargets: Record<PlayerId, PlayerId>;
  detectiveTargets: Record<PlayerId, PlayerId>;
  vigilanteTargets: Record<PlayerId, PlayerId>;
  serialKillerTargets: Record<PlayerId, PlayerId>;
  bodyguardTargets: Record<PlayerId, PlayerId>;
  escortTargets: Record<PlayerId, PlayerId>;
  framerTargets: Record<PlayerId, PlayerId>;
  lookoutTargets: Record<PlayerId, PlayerId>;
  veteranAlerts: Record<PlayerId, boolean>;
  survivorVests: Record<PlayerId, boolean>;
  witchControls: Record<PlayerId, { victimId: PlayerId; newTargetId: PlayerId }>;
}

export function emptyNightActions(): NightActions {
  return {
    mafiaVote: {},
    doctorTargets: {},
    detectiveTargets: {},
    vigilanteTargets: {},
    serialKillerTargets: {},
    bodyguardTargets: {},
    escortTargets: {},
    framerTargets: {},
    lookoutTargets: {},
    veteranAlerts: {},
    survivorVests: {},
    witchControls: {},
  };
}

export interface NightInput {
  /** Display names, used only to compose readable messages. */
  readonly names: Record<PlayerId, string>;
  readonly alive: ReadonlySet<PlayerId>;
  readonly roles: Record<PlayerId, Role>;
  readonly actions: NightActions;
  /** Remaining charges per player; absent means "full". */
  readonly charges: Record<PlayerId, number>;
}

export interface NightOutcome {
  /** In the order they were decided. */
  readonly deaths: ReadonlyArray<{ playerId: PlayerId; reason: string }>;
  readonly saved: ReadonlyArray<PlayerId>;
  readonly privateMessages: ReadonlyArray<{ playerId: PlayerId; content: string }>;
  readonly charges: Record<PlayerId, number>;
  readonly visits: ReadonlyArray<{ actorId: PlayerId; targetId: PlayerId }>;
}

export function resolveNight(input: NightInput): NightOutcome {
  const { names, alive, roles, actions } = input;
  const charges: Record<PlayerId, number> = { ...input.charges };

  const nameOf = (id: PlayerId) => names[id] ?? 'someone';
  const isAlive = (id: PlayerId) => alive.has(id);

  const deaths: Array<{ playerId: PlayerId; reason: string }> = [];
  const saved = new Set<PlayerId>();
  const messages: Array<{ playerId: PlayerId; content: string }> = [];

  const say = (playerId: PlayerId, content: string) => messages.push({ playerId, content });
  const died = (id: PlayerId) => deaths.some(d => d.playerId === id);
  const kill = (playerId: PlayerId, reason: string) => {
    if (died(playerId)) return;
    deaths.push({ playerId, reason });
  };

  const chargesLeft = (id: PlayerId): number => {
    const max = ABILITY_CHARGES[roles[id]];
    if (max === undefined) return Infinity;
    return charges[id] ?? max;
  };
  const spendCharge = (id: PlayerId) => {
    if (ABILITY_CHARGES[roles[id]] === undefined) return;
    charges[id] = Math.max(0, chargesLeft(id) - 1);
  };

  // Mutable copies — control and roleblocks rewrite these before anything
  // downstream reads them.
  const a: NightActions = {
    ...emptyNightActions(),
    ...structuredCloneish(actions),
  };

  const targetMaps = (): Array<Record<PlayerId, PlayerId>> => [
    a.mafiaVote, a.doctorTargets, a.detectiveTargets, a.vigilanteTargets,
    a.serialKillerTargets, a.bodyguardTargets, a.escortTargets,
    a.framerTargets, a.lookoutTargets,
  ];

  // ── 1. Witch control ───────────────────────────────────────────────────────
  Object.entries(a.witchControls).forEach(([witchId, ctrl]) => {
    if (!isAlive(witchId) || !isAlive(ctrl.victimId)) return;
    const { victimId, newTargetId } = ctrl;

    let redirected = false;
    for (const map of targetMaps()) {
      if (map[victimId] !== undefined) {
        map[victimId] = newTargetId;
        redirected = true;
      }
    }
    // A controlled player with no action of their own is simply made to visit.
    if (!redirected) a.lookoutTargets[victimId] = newTargetId;

    say(victimId, 'You felt a strange compulsion. Someone controlled your actions tonight.');
  });

  // ── 2. Roleblocks ──────────────────────────────────────────────────────────
  const blocked = new Set<PlayerId>();
  Object.entries(a.escortTargets).forEach(([escortId, targetId]) => {
    if (!isAlive(escortId) || !isAlive(targetId)) return;
    blocked.add(targetId);
    say(targetId, 'Someone kept you occupied all night. Your action did not go through.');
  });

  // An alerted Veteran cannot be talked down, so alerts survive a roleblock.
  for (const map of targetMaps()) {
    Object.keys(map).forEach(actorId => {
      if (blocked.has(actorId)) delete map[actorId];
    });
  }
  Object.keys(a.witchControls).forEach(id => {
    if (blocked.has(id)) delete a.witchControls[id];
  });

  // ── 3. Visits ──────────────────────────────────────────────────────────────
  // Self-targeting abilities (alert, vest) and the Spy's remote listening are
  // deliberately absent — they put nobody on a doorstep.
  const visits: Array<{ actorId: PlayerId; targetId: PlayerId }> = [];
  for (const map of targetMaps()) {
    Object.entries(map).forEach(([actorId, targetId]) => {
      if (isAlive(actorId) && targetId && targetId !== actorId) {
        visits.push({ actorId, targetId });
      }
    });
  }
  Object.entries(a.witchControls).forEach(([witchId, ctrl]) => {
    if (isAlive(witchId)) visits.push({ actorId: witchId, targetId: ctrl.victimId });
  });

  // ── 4. Veteran alert ───────────────────────────────────────────────────────
  const onAlert = new Set<PlayerId>();
  Object.entries(a.veteranAlerts).forEach(([vetId, alerted]) => {
    if (!alerted || !isAlive(vetId) || roles[vetId] !== 'veteran') return;
    if (chargesLeft(vetId) <= 0) return;
    spendCharge(vetId);
    onAlert.add(vetId);
    say(vetId, `You stood watch through the night. Alerts remaining: ${chargesLeft(vetId)}.`);
  });

  // Anyone who knocks on an alerted Veteran's door dies — innocent or not.
  onAlert.forEach(vetId => {
    visits
      .filter(v => v.targetId === vetId && v.actorId !== vetId)
      .forEach(v => {
        kill(v.actorId, 'You visited a Veteran who was on alert.');
        say(vetId, `You shot ${nameOf(v.actorId)} at your door.`);
      });
  });

  // ── 5. Protection ──────────────────────────────────────────────────────────
  const doctorSaves = new Set(Object.values(a.doctorTargets));

  const bodyguardFor: Record<PlayerId, PlayerId[]> = {};
  Object.entries(a.bodyguardTargets).forEach(([bgId, targetId]) => {
    if (!isAlive(bgId) || bgId === targetId) return;
    (bodyguardFor[targetId] ??= []).push(bgId);
  });

  const vested = new Set<PlayerId>();
  Object.entries(a.survivorVests).forEach(([sid, isVested]) => {
    if (!isVested || !isAlive(sid) || roles[sid] !== 'survivor') return;
    if (chargesLeft(sid) <= 0) return;
    spendCharge(sid);
    vested.add(sid);
    say(sid, `You put on a vest. Vests remaining: ${chargesLeft(sid)}.`);
  });

  /** Applies one attack. A Bodyguard trades their life for the target, once. */
  const attack = (targetId: PlayerId, reason: string) => {
    if (!isAlive(targetId) || died(targetId)) return;

    if (onAlert.has(targetId)) {
      say(targetId, 'Someone tried to kill you, but you were ready for them.');
      return;
    }
    const guard = (bodyguardFor[targetId] ?? []).find(id => !died(id));
    if (guard) {
      kill(guard, 'You died defending the person you were protecting.');
      saved.add(targetId);
      say(targetId, 'You were attacked, but your Bodyguard took the blow.');
      return;
    }
    if (doctorSaves.has(targetId)) {
      saved.add(targetId);
      say(targetId, 'You were attacked but a Doctor patched you up!');
      return;
    }
    if (vested.has(targetId)) {
      saved.add(targetId);
      say(targetId, 'Your vest stopped the attack.');
      return;
    }
    kill(targetId, reason);
  };

  // ── 6. Attacks ─────────────────────────────────────────────────────────────
  // Filter by attacker, not just by target: a mafioso who died at stage 4
  // (shot at an alerted Veteran's door) must not still complete their kill.
  const mafiaTargetsLanded = new Set(
    Object.entries(a.mafiaVote)
      .filter(([actorId]) => isAlive(actorId) && !died(actorId))
      .map(([, targetId]) => targetId)
  );
  mafiaTargetsLanded.forEach(targetId => {
    attack(targetId, 'You were killed by the Mafia.');
  });

  Object.entries(a.vigilanteTargets).forEach(([vigId, targetId]) => {
    if (!isAlive(vigId) || died(vigId)) return;
    // Shooting a Town member costs the Vigilante their own life, and the
    // target walks away unharmed.
    if (isTownRole(roles[targetId])) {
      kill(vigId, 'You died from guilt after shooting a Town member.');
      say(vigId, 'You aimed at a Town member. Overcome with guilt, you took your own life.');
      return;
    }
    attack(targetId, `You were shot by a Vigilante (${nameOf(vigId)}).`);
  });

  Object.entries(a.serialKillerTargets).forEach(([skId, targetId]) => {
    if (!isAlive(skId) || died(skId)) return;
    attack(targetId, `You were killed by a Serial Killer (${nameOf(skId)}).`);
  });

  // ── 7. Information ─────────────────────────────────────────────────────────
  const framed = new Set(Object.values(a.framerTargets));

  Object.entries(a.detectiveTargets).forEach(([detectiveId, targetId]) => {
    if (!isAlive(detectiveId)) return;
    const role = roles[targetId];
    // A Framer's mark reads as Mafia even when perfectly innocent.
    const suspicious = framed.has(targetId) || isMafiaRole(role) || role === 'serial_killer';
    say(
      detectiveId,
      `Your investigation of ${nameOf(targetId)} returned: ${suspicious ? 'suspicious' : 'innocent'}.`
    );
  });

  Object.entries(a.lookoutTargets).forEach(([lookoutId, targetId]) => {
    if (!isAlive(lookoutId) || roles[lookoutId] !== 'lookout') return;
    const seen = [...new Set(
      visits
        .filter(v => v.targetId === targetId && v.actorId !== lookoutId && v.actorId !== targetId)
        .map(v => nameOf(v.actorId))
    )];
    say(
      lookoutId,
      seen.length > 0
        ? `You watched ${nameOf(targetId)}. Visitors: ${seen.join(', ')}.`
        : `You watched ${nameOf(targetId)}. Nobody came by.`
    );
  });

  const mafiaTargets = [...mafiaTargetsLanded].map(nameOf);
  Object.keys(roles)
    .filter(id => roles[id] === 'spy' && isAlive(id))
    .forEach(spyId => {
      say(
        spyId,
        mafiaTargets.length > 0
          ? `You overheard the Mafia. They went after: ${mafiaTargets.join(', ')}.`
          : 'You listened all night. The Mafia did not move.'
      );
    });

  return { deaths, saved: [...saved], privateMessages: messages, charges, visits };
}

/** Shallow-clones each action map so resolution never mutates the caller's state. */
function structuredCloneish(actions: NightActions): NightActions {
  return {
    mafiaVote: { ...actions.mafiaVote },
    doctorTargets: { ...actions.doctorTargets },
    detectiveTargets: { ...actions.detectiveTargets },
    vigilanteTargets: { ...actions.vigilanteTargets },
    serialKillerTargets: { ...actions.serialKillerTargets },
    bodyguardTargets: { ...actions.bodyguardTargets },
    escortTargets: { ...actions.escortTargets },
    framerTargets: { ...actions.framerTargets },
    lookoutTargets: { ...actions.lookoutTargets },
    veteranAlerts: { ...actions.veteranAlerts },
    survivorVests: { ...actions.survivorVests },
    witchControls: { ...actions.witchControls },
  };
}
