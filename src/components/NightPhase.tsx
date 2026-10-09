import { useGameStore } from '../lib/store';
import MyRoleBanner from './MyRoleBanner';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import { networkManager } from '../lib/network';
import { soundManager } from '../lib/sound';
import ChatBox from './ChatBox';
import DeadChat from './DeadChat';
import MobileChatDrawer from './MobileChatDrawer';
import LastWillEditor from './LastWillEditor';
import Graveyard from './Graveyard';
import NightTasks from './NightTasks';
import {
  Moon, Skull, Ghost, Eye, Shield, Crosshair, HeartPulse, Hourglass,
  Ban, Radio, Fingerprint, LifeBuoy, Wand2, Gavel, Check,
} from 'lucide-react';
import { getNightAbility } from '../lib/nightRoles';
import { isMafiaRole } from '../lib/types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export default function NightPhase() {
  const { myRole, players, myId, mafiaPartners, myDeathReason, myKilledBy } = useGameStore(state => ({
    myRole: state.myRole,
    players: state.players,
    myId: state.myId,
    mafiaPartners: state.mafiaPartners,
    myDeathReason: state.myDeathReason,
    myKilledBy: state.myKilledBy,
  }));

  useEffect(() => {
    soundManager.playPhaseChange();
  }, []);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [secondTarget, setSecondTarget] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);

  // What this role can do tonight. Absent means "no night action".
  const ability = getNightAbility(myRole);

  // Valid targets: alive, and self only when the ability allows it.
  const targets = Object.values(players).filter(
    p => p.isAlive && (p.id !== myId || !!ability?.canTargetSelf)
  );

  const needsSecond = !!ability?.twoTargets;
  const ready = ability?.selfTarget
    ? true
    : !!selectedTarget && (!needsSecond || !!secondTarget);

  const handleAction = () => {
    if (!ability || !ready) return;

    if (ability.selfTarget) {
      // Alert and vest target the actor themselves.
      networkManager.sendNightAction(ability.action, myId);
    } else if (needsSecond) {
      networkManager.sendNightAction(ability.action, selectedTarget!, secondTarget!);
    } else {
      networkManager.sendNightAction(ability.action, selectedTarget!);
    }

    setHasActed(true);
  };

  const getRoleIcon = () => {
    switch (myRole) {
        case 'mafia': return <Crosshair size={24} className="text-red-500" />;
        case 'doctor': return <HeartPulse size={24} className="text-green-500" />;
        case 'detective': return <Eye size={24} className="text-blue-500" />;
        case 'vigilante': return <Crosshair size={24} className="text-amber-500" />;
        case 'bodyguard': return <Shield size={24} className="text-ink-muted" />;
        case 'medium': return <Ghost size={24} className="text-purple-500" />;
        case 'serial_killer': return <Skull size={24} className="text-red-600" />;
        case 'escort': return <Ban size={24} className="text-fuchsia-400" />;
        case 'veteran': return <Crosshair size={24} className="text-yellow-500" />;
        case 'lookout': return <Eye size={24} className="text-sky-400" />;
        case 'spy': return <Radio size={24} className="text-cyan-400" />;
        case 'framer': return <Fingerprint size={24} className="text-rose-500" />;
        case 'survivor': return <LifeBuoy size={24} className="text-lime-400" />;
        case 'executioner': return <Gavel size={24} className="text-stone-300" />;
        case 'witch': return <Wand2 size={24} className="text-violet-400" />;
        default: return <Moon size={24} className="text-ink-muted" />;
    }
  }

  const { isAlive } = useGameStore(state => ({
    isAlive: state.players[state.myId]?.isAlive
  }));

  if (!isAlive) {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <Card variant="glass" className="flex flex-col items-center justify-center text-center p-8 border-edge/50">
          <Skull size={64} className="text-red-500 mb-4 animate-pulse" />
          <h2 className="font-display text-3xl text-danger mb-3">You are Dead</h2>
          <p className="text-ink-muted mb-6">The dead tell no tales... but they can whisper to each other.</p>
          {myDeathReason && (
             <div className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-4 w-full">
                <p className="text-red-300 font-semibold">{myDeathReason}</p>
             </div>
          )}

          {/* Only this player ever sees this. It is not posted to dead chat,
              because a living Medium reads that channel — telling the room
              would hand them the Mafia. Passing it on is your call. */}
          {myKilledBy && (
            <div className="mb-6 w-full rounded-xl border border-danger/40 bg-danger/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Killed by
              </p>
              <p className="mt-1 text-xl font-bold text-danger">{myKilledBy}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Only you know this. Share it in the dead chat if you want to —
                a Medium may be listening.
              </p>
            </div>
          )}

          <MyRoleBanner className="mb-6 w-full" />

          <div className="w-full">
            <Graveyard />
          </div>
        </Card>
        <div className="hidden lg:flex justify-center h-full min-h-[500px]">
          <DeadChat />
        </div>
        <MobileChatDrawer channel="dead" />
      </div>
    );
  }

  // No entry in the ability table means nothing to do tonight. The Spy is the
  // exception: it acts passively, so it reads as 'no action' but still gets a
  // report, and the Medium has its own screen below.
  if (!ability && myRole !== 'medium') {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 md:space-y-8">
        <Card variant="glass" className="text-center p-8 md:p-12 border-edge/50">
            <div className="flex justify-center mb-6">
                <Moon size={64} className="text-ink-muted/60 animate-pulse" />
            </div>
            <h2 className="text-2xl md:text-4xl font-heading font-bold text-ink mb-4">Night has fallen</h2>
            <p className="text-ink-muted text-lg">
              {myRole === 'spy'
                ? 'You listen in the dark. Whatever the Mafia does tonight, you will hear it.'
                : myRole === 'executioner'
                ? 'Nothing to do but plan. Your work happens in daylight, in the vote.'
                : 'Sleep safely. The city is busy.'}
            </p>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <MyRoleBanner />
              <NightTasks />
            </div>
            <div className="space-y-6">
              <LastWillEditor />
              <Graveyard />
            </div>
        </div>
      </div>
    );
  }

  if (myRole === 'medium') {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <Card variant="glass" className="flex flex-col items-center justify-center text-center p-8 border-edge/50">
            <Ghost size={64} className="text-purple-500 mb-4 animate-bounce-slow" />
            <h2 className="font-display text-2xl text-violet-300 mb-3">The Spirit World</h2>
            <p className="text-ink-muted mb-6">You can hear the whispers of the dead.</p>
            <div className="w-full">
                <MyRoleBanner className="mb-6" />
                <LastWillEditor />
                <div className="mt-6"></div>
                <Graveyard />
            </div>
        </Card>
        <div className="flex justify-center h-full min-h-[500px]">
            <DeadChat />
        </div>
      </div>
    );
  }

  // The Framer is Mafia too, so they share the private channel.
  const isMafia = isMafiaRole(myRole ?? undefined);
  const showMafiaChat = isMafia && mafiaPartners.filter(id => id !== myId).length > 0;

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative border-edge/50">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-edge/50">
                <div className="bg-surface p-3 rounded-xl">
                    {getRoleIcon()}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-ink">Night Phase</h2>
                    <p className="text-ink-muted text-sm mt-1">
                      Make your move before the sun comes up.
                    </p>
                </div>
            </div>

            {/* What you are and what it does, so nobody has to remember a
                reveal card from twenty minutes ago. */}
            <MyRoleBanner className="mb-6" />
            
            {!hasActed ? (
            <>
                {ability && (
                  <p className="text-ink-muted text-sm mb-5 leading-relaxed">{ability.hint}</p>
                )}

                {ability?.selfTarget ? (
                  /* Alert and vest act on the actor, so there is nothing to
                     pick — just a decision to make. */
                  <div className="mb-8 p-6 rounded-xl border border-edge/60 bg-base/40 text-center">
                    <div className="flex justify-center mb-3">{getRoleIcon()}</div>
                    <p className="text-ink font-semibold mb-1">{ability.prompt}</p>
                    {ability.charges !== undefined && (
                      <p className="text-xs text-ink-muted">
                        Limited to {ability.charges} uses per game.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-ink-muted mb-3 uppercase tracking-widest text-xs font-bold">
                      {ability?.prompt ?? 'Select Target'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                    {targets.map(player => {
                        const isPartner = isMafia && mafiaPartners.includes(player.id) && player.id !== myId;
                        const isPicked = selectedTarget === player.id;
                        return (
                        <Card
                            key={player.id}
                            variant="interactive"
                            onClick={() => {
                                 if (isPartner) return;
                                 setSelectedTarget(player.id);
                                 // Changing the first pick invalidates the second.
                                 if (needsSecond) setSecondTarget(null);
                            }}
                            className={clsx(
                                "text-left relative border transition-all duration-200",
                                isPicked
                                ? "border-accent bg-accent/10 shadow-accent-sm"
                                : isPartner
                                    ? "border-danger/30 bg-danger/5 opacity-50 cursor-not-allowed"
                                    : "border-edge/60 hover:border-edge"
                            )}
                        >
                            <div className="flex flex-col relative z-10">
                                <span className={clsx("font-semibold", isPicked ? "text-ink" : "text-ink-muted")}>
                                    {player.name}
                                </span>
                                {isPartner && (
                                    <span className="text-[10px] block opacity-70 uppercase tracking-wider text-danger">Partner</span>
                                )}
                            </div>
                        </Card>
                        );
                    })}
                    </div>

                    {/* The Witch needs a destination as well as a victim. */}
                    {needsSecond && selectedTarget && (
                      <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-ink-muted mb-3 uppercase tracking-widest text-xs font-bold">
                          {ability?.secondPrompt ?? 'Redirect to'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.values(players)
                            .filter(p => p.isAlive && p.id !== selectedTarget)
                            .map(player => (
                            <Card
                              key={player.id}
                              variant="interactive"
                              onClick={() => setSecondTarget(player.id)}
                              className={clsx(
                                "text-left border transition-all duration-200",
                                secondTarget === player.id
                                  ? "border-accent bg-accent/10 shadow-accent-sm"
                                  : "border-edge/60 hover:border-edge"
                              )}
                            >
                              <span className={clsx(
                                "font-semibold",
                                secondTarget === player.id ? "text-ink" : "text-ink-muted"
                              )}>
                                {player.name}
                              </span>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button
                    onClick={handleAction}
                    disabled={!ready}
                    variant={ability?.tone === 'danger' ? 'danger' : ability?.tone === 'accent' ? 'accent' : 'primary'}
                    className="w-full py-4"
                >
                    {ability?.tone === 'danger' ? <Crosshair size={18} /> : <Check size={18} />}
                    <span>{ability?.label ?? 'Wait'}</span>
                </Button>
            </>
            ) : (
            <div className="space-y-6">
              <Card variant="default" className="py-8 text-center flex flex-col items-center justify-center">
                  <div className="bg-surface p-4 rounded-full mb-4">
                      <Hourglass size={28} className="text-ink-muted" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold text-ink mb-1">Action confirmed</h3>
                  <span className="text-ink-muted text-sm">Waiting for night to end…</span>
              </Card>
              {/* Something to do with the rest of the night. */}
              <NightTasks />
            </div>
            )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Graveyard />
        </div>
      </div>

      {showMafiaChat && (
        <>
            <div className="hidden lg:block lg:col-span-5 h-[600px] lg:h-auto min-h-[500px]">
            <ChatBox channel="mafia" />
            </div>
            <MobileChatDrawer channel="mafia" />
        </>
      )}
    </div>
  );
}
