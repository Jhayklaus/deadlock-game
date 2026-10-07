import { useEffect } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { soundManager } from '../lib/sound';
import ChatBox from './ChatBox';
import MobileChatDrawer from './MobileChatDrawer';
import { Card } from './ui/Card';
import { Gavel, ThumbsUp, ThumbsDown, MinusCircle, Megaphone, Scale } from 'lucide-react';
import type { Verdict } from '../lib/types';

/**
 * The trial: the accused speaks, then the jury decides.
 *
 * Covers both `trial_defense` and `trial_verdict`, since the two share a
 * layout and only differ in what the lower half offers.
 */
export default function TrialPhase() {
  const {
    phase, players, myId, accusedId, verdictCounts, myVerdict,
  } = useGameStore(state => ({
    phase: state.phase,
    players: state.players,
    myId: state.myId,
    accusedId: state.accusedId,
    verdictCounts: state.verdictCounts,
    myVerdict: state.myVerdict,
  }));

  useEffect(() => {
    soundManager.playPhaseChange();
  }, [phase]);

  const accused = accusedId ? players[accusedId] : null;
  const isAccused = myId === accusedId;
  const isAlive = !!players[myId]?.isAlive;
  const isDefense = phase === 'trial_defense';

  if (!accused) return null;

  const castVerdict = (verdict: Verdict) => {
    if (isAccused || !isAlive) return;
    networkManager.sendVerdict(verdict);
  };

  const options: Array<{ value: Verdict; label: string; icon: typeof ThumbsUp; classes: string }> = [
    {
      value: 'guilty',
      label: 'Guilty',
      icon: ThumbsDown,
      classes: 'border-danger/50 text-danger hover:bg-danger/10 data-[on=true]:bg-danger data-[on=true]:text-white',
    },
    {
      value: 'abstain',
      label: 'Abstain',
      icon: MinusCircle,
      classes: 'border-edge text-ink-muted hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-ink',
    },
    {
      value: 'innocent',
      label: 'Innocent',
      icon: ThumbsUp,
      classes: 'border-success/50 text-success hover:bg-success/10 data-[on=true]:bg-success data-[on=true]:text-white',
    },
  ];

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-edge/50">
            <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
              {isDefense ? <Megaphone size={20} /> : <Gavel size={20} />}
            </div>
            <div>
              <h2 className="text-xl font-heading font-semibold text-ink">
                {isDefense ? 'The Defense' : 'The Verdict'}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                {isDefense
                  ? 'The accused has the floor'
                  : 'The jury decides their fate'}
              </p>
            </div>
          </div>

          {/* Who is on trial */}
          <div className="flex flex-col items-center text-center py-6 mb-6 rounded-xl border border-accent/25 bg-accent/[0.06]">
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 grid place-items-center text-2xl font-bold text-accent mb-3">
              {accused.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-1">On trial</p>
            <p className="text-2xl font-heading font-semibold text-ink">{accused.name}</p>
          </div>

          {isDefense ? (
            <div className="text-center py-4">
              {isAccused ? (
                <>
                  <p className="text-ink font-semibold mb-2">You are on trial.</p>
                  <p className="text-ink-muted text-sm max-w-sm mx-auto leading-relaxed">
                    Make your case in chat. Claim a role, name a suspect, explain
                    yourself — whatever it takes. The jury votes next.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-ink font-semibold mb-2">Hear them out.</p>
                  <p className="text-ink-muted text-sm max-w-sm mx-auto leading-relaxed">
                    {accused.name} is defending themselves. You vote once they
                    are done.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Running tally */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-danger tabular">{verdictCounts.guilty}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-1">Guilty</p>
                </div>
                <Scale size={20} className="text-ink-muted" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-success tabular">{verdictCounts.innocent}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-1">Innocent</p>
                </div>
              </div>

              <p className="text-center text-xs text-ink-muted mb-5">
                {verdictCounts.cast} of {verdictCounts.total} jurors have voted
                {verdictCounts.guilty === verdictCounts.innocent && verdictCounts.cast > 0 && (
                  <span className="block mt-1 text-warning">A tie acquits.</span>
                )}
              </p>

              {isAccused ? (
                <p className="text-center text-sm text-ink-muted italic py-4">
                  You cannot vote on your own fate.
                </p>
              ) : !isAlive ? (
                <p className="text-center text-sm text-ink-muted italic py-4">
                  The dead have no vote.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {options.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => castVerdict(opt.value)}
                        data-on={myVerdict === opt.value}
                        className={clsx(
                          'flex flex-col items-center gap-2 py-4 rounded-xl border',
                          'transition-all duration-200 ease-out-expo active:scale-[0.97]',
                          opt.classes
                        )}
                      >
                        <Icon size={20} />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {myVerdict && !isAccused && isAlive && (
                <p className="text-center text-xs text-ink-muted mt-4">
                  You voted <span className="text-ink font-semibold">{myVerdict}</span>. You can change it until time runs out.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="hidden lg:block lg:col-span-5 h-[600px] lg:h-auto min-h-[500px]">
        <ChatBox channel="global" />
      </div>
      <MobileChatDrawer channel="global" />
    </div>
  );
}
