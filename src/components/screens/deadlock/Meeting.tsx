import { clsx } from 'clsx';
import { useGameStore } from '../../../lib/store';
import { useVoting } from '../../../hooks/useVoting';
import { getRoom } from '../../../data/deadlockMap';
import ChatBox from '../../ChatBox';
import MobileChatDrawer from '../../MobileChatDrawer';
import Graveyard from '../../Graveyard';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import {
  Siren, User, SkipForward, CheckCircle, Skull, MessageSquare, MapPin, Wrench,
} from 'lucide-react';

/**
 * A Deadlock meeting.
 *
 * Reuses the shared voting hook, but the framing is the station rather than a
 * word game — players argue from where everyone was standing, so the screen
 * keeps their own task list and last known room in front of them.
 */
export default function Meeting() {
  const { myId, isAlive, myDeathReason, myModeRoleId, deadlock } = useGameStore(state => ({
    myId: state.myId,
    isAlive: state.players[state.myId]?.isAlive,
    myDeathReason: state.myDeathReason,
    myModeRoleId: state.myModeRoleId,
    deadlock: state.deadlock,
  }));

  const { targets, voteCounts, phase, selectedVote, setSelectedVote, hasVoted, handleVote, handleSkip } = useVoting();

  const isImpostor = myModeRoleId === 'station_impostor';

  if (!isAlive) {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20 md:pb-0">
        <Card variant="glass" className="text-center py-12 flex flex-col items-center justify-center">
          <Skull size={52} className="text-danger mb-4" />
          <h2 className="font-display text-3xl text-danger mb-3">Eliminated</h2>
          <p className="text-ink-muted text-sm mb-5 max-w-xs">
            You can watch the rest play out, but the living cannot hear you.
          </p>
          {myDeathReason && (
            <div className="bg-danger/10 border border-danger/30 p-3 rounded-xl mb-5 w-full max-w-xs">
              <p className="text-danger text-sm font-semibold">{myDeathReason}</p>
            </div>
          )}
          <div className="w-full"><Graveyard /></div>
        </Card>
        <div className="flex justify-center h-full min-h-[480px]">
          <ChatBox channel="dead" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-5 pb-20 md:pb-0">
      <div className="lg:col-span-7 space-y-5">
        <Card variant="glass">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <Siren className="text-accent" size={22} />
            <h2 className="font-display text-2xl text-accent">Emergency Meeting</h2>
          </div>

          {phase === 'day_discussion' && (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 border border-accent/30 grid place-items-center">
                <MessageSquare size={26} className="text-accent" />
              </div>
              <p className="text-lg text-ink mb-1">Where was everybody?</p>
              <p className="text-ink-muted text-sm max-w-sm mx-auto leading-relaxed">
                {isImpostor
                  ? 'Account for yourself. Name a room you were plausibly in, and hope nobody was watching.'
                  : 'Say where you were and who you saw. Somebody is lying about their route.'}
              </p>
            </div>
          )}

          {phase === 'voting' && !hasVoted && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
              <h3 className="text-center text-base font-heading font-semibold text-ink mb-5">
                Vote someone off the station
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                {targets.map(player => (
                  <Card
                    key={player.id}
                    variant="interactive"
                    padding="sm"
                    onClick={() => setSelectedVote(player.id)}
                    className={clsx(
                      'text-left relative border transition-all duration-200',
                      selectedVote === player.id
                        ? 'border-accent bg-accent/10 shadow-accent-sm'
                        : 'border-edge/60 hover:border-edge'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="bg-surface p-1.5 rounded-lg border border-edge/50">
                        <User size={16} className={selectedVote === player.id ? 'text-accent' : 'text-ink-muted'} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm text-ink truncate">{player.name}</span>
                        {player.id === myId && (
                          <span className="text-[10px] text-ink-muted uppercase tracking-wider">(You)</span>
                        )}
                      </div>
                    </div>
                    {voteCounts?.[player.id] ? (
                      <div className="absolute top-2 right-2">
                        <Badge variant="accent">{voteCounts[player.id]}</Badge>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSkip} variant="secondary" fullWidth>
                  <SkipForward size={16} /> Skip
                </Button>
                <Button onClick={handleVote} disabled={!selectedVote} variant="accent" fullWidth>
                  <CheckCircle size={16} /> Eject
                </Button>
              </div>
            </div>
          )}

          {phase === 'voting' && hasVoted && (
            <div className="py-10 text-center animate-in fade-in zoom-in-95 duration-400">
              <CheckCircle size={32} className="text-accent mx-auto mb-3" />
              <h3 className="text-base font-heading font-semibold text-ink mb-1">Vote cast</h3>
              <p className="text-ink-muted text-sm mb-6">Waiting on the rest of the crew…</p>
              <div className="space-y-2 max-w-xs mx-auto">
                {targets.map(p => {
                  const count = voteCounts?.[p.id] || 0;
                  if (!count) return null;
                  return (
                    <div key={p.id} className="flex justify-between items-center p-2.5 rounded-lg bg-base/50 border border-edge/50">
                      <span className="text-ink text-sm">{p.name}</span>
                      <Badge variant="accent">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Graveyard />
      </div>

      <div className="hidden lg:flex lg:col-span-5 flex-col gap-4 sticky top-6 h-fit">
        {/* Your own route, to argue from. */}
        <Card variant="glass" padding="sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">
            {isImpostor ? 'Your cover story' : 'Your tasks'}
          </p>
          <ul className="space-y-1.5">
            {deadlock.myTasks.map(id => {
              const done = deadlock.myTasksDone.includes(id);
              return (
                <li key={id} className="flex items-center gap-2 text-sm">
                  {done
                    ? <Wrench size={13} className="text-success shrink-0" />
                    : <MapPin size={13} className="text-ink-muted shrink-0" />}
                  <span className={done ? 'text-ink-muted line-through' : 'text-ink'}>
                    {getRoom(id)?.name ?? id}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-muted mt-3 pt-3 border-t border-edge/50">
            Station repairs: {deadlock.tasksCompleted}/{deadlock.tasksTotal}
          </p>
        </Card>

        <div className="h-[480px]">
          <ChatBox />
        </div>
      </div>

      <MobileChatDrawer />
    </div>
  );
}
