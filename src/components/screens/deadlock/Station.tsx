import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../../../lib/store';
import { networkManager } from '../../../lib/network';
import { DEADLOCK_ROOMS, getCorridors, getRoom, isAdjacent, getVentExits, SPAWN_ROOM } from '../../../data/deadlockMap';
import { KILL_COOLDOWN_SECONDS } from '../../../modes/deadlock';
import { Card } from '../../ui/Card';
import StationTask from './StationTask';
import {
  Crosshair, Siren, AlertTriangle, CheckCircle2, Footprints, Users,
  Lightbulb, DoorClosed, Radiation, Wrench, ShieldAlert, ArrowDownUp,
} from 'lucide-react';
import type { SabotageKind } from '../../../lib/types';

/**
 * The station screen.
 *
 * Rendered as positioned DOM over an SVG corridor layer — no canvas, no game
 * engine. Movement is one click per room; everyone's avatar animates to its
 * new position locally, which is why this works through a browser-hosted relay.
 */
export default function Station() {
  const { players, myId, myModeRoleId, deadlock } = useGameStore(state => ({
    players: state.players,
    myId: state.myId,
    myModeRoleId: state.myModeRoleId,
    deadlock: state.deadlock,
  }));

  const [now, setNow] = useState(Date.now());
  const [taskOpen, setTaskOpen] = useState(false);

  // Drives the kill-cooldown countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const isImpostor = myModeRoleId === 'station_impostor';
  const me = players[myId];
  const sabotage = deadlock.sabotage;
  const sabotageSecondsLeft = sabotage ? Math.max(0, Math.ceil((sabotage.endsAt - now) / 1000)) : 0;
  const sabotageReadyIn = Math.max(0, Math.ceil((deadlock.sabotageReadyAt - now) / 1000));

  // Lights out: you can only see who is in your own room.
  const blackout = sabotage?.kind === 'lights' && sabotageSecondsLeft > 0;
  const myRoomId = deadlock.positions[myId] ?? SPAWN_ROOM;
  const myRoom = getRoom(myRoomId);

  const corridors = useMemo(() => getCorridors(), []);
  // Maintenance shafts, impostors only.
  const ventExits = isImpostor ? getVentExits(myRoomId) : [];

  // Who else is standing here right now.
  const roomMates = Object.values(players).filter(
    p => p.isAlive && p.id !== myId && deadlock.positions[p.id] === myRoomId
  );
  const bodiesHere = deadlock.bodies.filter(b => b.roomId === myRoomId);

  // Impostors sabotage rather than work, so the task button is crew-only.
  const taskHere =
    !isImpostor &&
    deadlock.myTasks.includes(myRoomId) &&
    !deadlock.myTasksDone.includes(myRoomId);

  // Crew standing at a fix point can deal with the active sabotage.
  const canFix =
    !isImpostor && !!sabotage?.fixRoomId && sabotage.fixRoomId === myRoomId && sabotageSecondsLeft > 0;

  const cooldownLeft = Math.max(0, Math.ceil((deadlock.killReadyAt - now) / 1000));
  const canKill = isImpostor && cooldownLeft === 0 && roomMates.length > 0;

  const taskPct = deadlock.tasksTotal > 0
    ? Math.round((deadlock.tasksCompleted / deadlock.tasksTotal) * 100)
    : 0;

  if (!me?.isAlive) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <Card variant="glass" className="text-center py-12">
          <AlertTriangle size={40} className="mx-auto text-danger mb-4" />
          <h2 className="text-2xl font-heading font-semibold text-ink mb-2">You are dead</h2>
          <p className="text-ink-muted text-sm max-w-sm mx-auto">
            Your body is still out there. Wait for someone to find it — you can
            still watch, and you will have your say when the game ends.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div className="lg:col-span-8">
        <Card variant="glass" padding="sm" className="relative overflow-hidden">
          <div className="relative w-full aspect-[4/3] bg-grid-faint bg-grid-md rounded-xl">
            {/* Corridors behind the rooms. */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {corridors.map(({ from, to }) => (
                <line
                  key={`${from.id}-${to.id}`}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="rgb(var(--edge))"
                  strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {DEADLOCK_ROOMS.map(room => {
              const here = room.id === myRoomId;
              const ventable = ventExits.includes(room.id);
              const reachable = isAdjacent(myRoomId, room.id) || ventable;
              const sealedIn =
                sabotage?.kind === 'doors' &&
                sabotage.roomId === myRoomId &&
                sabotageSecondsLeft > 0;
              // During a blackout you only see your own room.
              const occupants = blackout && room.id !== myRoomId
                ? []
                : Object.values(players).filter(
                    p => p.isAlive && deadlock.positions[p.id] === room.id
                  );
              const bodies = blackout && room.id !== myRoomId
                ? []
                : deadlock.bodies.filter(b => b.roomId === room.id);
              // Impostors keep a cover list to quote in meetings, but they
              // cannot work, so marking rooms on their map would be a lie.
              const hasMyTask =
                !isImpostor &&
                deadlock.myTasks.includes(room.id) &&
                !deadlock.myTasksDone.includes(room.id);

              return (
                <button
                  key={room.id}
                  disabled={(!reachable && !here) || sealedIn}
                  onClick={() => reachable && !sealedIn && networkManager.sendDeadlockMove(room.id, ventable)}
                  style={{ left: `${room.x}%`, top: `${room.y}%` }}
                  className={clsx(
                    'absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-2 rounded-xl border',
                    'transition-all duration-300 ease-out-expo min-w-[5.5rem]',
                    here
                      ? 'bg-accent/20 border-accent text-ink shadow-accent scale-105 z-20'
                      : reachable
                        ? 'bg-elevated/90 border-edge hover:border-accent/60 hover:bg-surface text-ink-muted hover:text-ink cursor-pointer z-10'
                        : 'bg-elevated/40 border-edge/30 text-ink-muted/40 cursor-not-allowed'
                  )}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wider leading-tight">
                    {room.name}
                  </span>

                  <span className="flex items-center justify-center gap-1 mt-1 min-h-[14px]">
                    {/* Occupants as dots; only counts, never identities beyond
                        what the map already shows. */}
                    {occupants.slice(0, 5).map(p => (
                      <span
                        key={p.id}
                        title={p.name}
                        className={clsx(
                          'w-1.5 h-1.5 rounded-full',
                          p.id === myId ? 'bg-accent ring-2 ring-accent/30' : 'bg-ink/60'
                        )}
                      />
                    ))}
                    {bodies.length > 0 && (
                      <span className="text-danger text-[10px] leading-none" title="A body">✕</span>
                    )}
                    {hasMyTask && (
                      <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" title="Your task" />
                    )}
                    {ventable && (
                      <ArrowDownUp size={10} className="text-danger" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-ink-muted text-center mt-2 flex items-center justify-center gap-1.5">
            <Footprints size={12} />
            Choose a connected room to walk there
          </p>
        </Card>
      </div>

      {/* ── Side panel ────────────────────────────────────────────────────── */}
      <div className="lg:col-span-4 space-y-4">
        <Card variant="glass" padding="sm">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-1">You are in</p>
          <h3 className="text-lg font-heading font-semibold text-ink">{myRoom?.name}</h3>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">{myRoom?.blurb}</p>

          <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-muted">
            <Users size={12} />
            {roomMates.length === 0
              ? 'Nobody else is here.'
              : `${roomMates.map(p => p.name).join(', ')} ${roomMates.length === 1 ? 'is' : 'are'} here.`}
          </div>
        </Card>

        {/* Crew task progress */}
        <Card variant="glass" padding="sm">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-ink-muted">Station repairs</span>
            <span className="text-ink-muted font-semibold tabular">
              {deadlock.tasksCompleted}/{deadlock.tasksTotal}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out-expo"
              style={{ width: `${taskPct}%` }}
            />
          </div>
          <p className="text-[11px] text-ink-muted mt-2">
            {isImpostor
              ? 'Let this fill and the crew wins. Sabotage to slow them down.'
              : 'Finish every task and the crew wins, even without catching anyone.'}
          </p>
        </Card>

        {/* Live sabotage */}
        {sabotage && sabotageSecondsLeft > 0 && (
          <Card
            variant="glass"
            padding="sm"
            className={clsx(
              'border',
              sabotage.kind === 'reactor' ? 'border-danger/50 bg-danger/[0.07] animate-pulse-glow' : 'border-warning/40 bg-warning/[0.06]'
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className={clsx(
                'p-1.5 rounded-lg shrink-0',
                sabotage.kind === 'reactor' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
              )}>
                {sabotage.kind === 'lights' ? <Lightbulb size={15} />
                  : sabotage.kind === 'doors' ? <DoorClosed size={15} />
                  : <Radiation size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink leading-tight">
                  {sabotage.kind === 'lights' ? 'Lights are out'
                    : sabotage.kind === 'doors' ? 'Doors sealed'
                    : 'Reactor meltdown'}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {sabotage.kind === 'lights' ? 'You can only see your own room.'
                    : sabotage.kind === 'doors' ? 'Someone is locked in.'
                    : 'Reach the reactor or the crew lose.'}
                  {' '}<span className="tabular font-semibold">{sabotageSecondsLeft}s</span>
                </p>
              </div>
            </div>

            {canFix && (
              <button
                onClick={() => networkManager.sendDeadlockFix()}
                className="w-full mt-3 h-10 rounded-xl text-sm font-semibold bg-success text-base
                  hover:brightness-110 transition-all active:scale-[0.98]
                  inline-flex items-center justify-center gap-2"
              >
                <Wrench size={15} />
                {sabotage.kind === 'reactor' ? 'Stabilise the reactor' : 'Restore the lights'}
              </button>
            )}
            {!canFix && sabotage.fixRoomId && !isImpostor && (
              <p className="text-[11px] text-ink-muted mt-2.5">
                Fix it in <span className="text-ink font-semibold">{getRoom(sabotage.fixRoomId)?.name}</span>.
              </p>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {taskHere && (
            <button
              onClick={() => setTaskOpen(true)}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-accent text-base
                hover:brightness-110 transition-all active:scale-[0.98]
                inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> Do your task here
            </button>
          )}

          {isImpostor && (
            <div className="space-y-2">
              {roomMates.map(p => (
                <button
                  key={p.id}
                  disabled={!canKill}
                  onClick={() => networkManager.sendDeadlockKill(p.id)}
                  className={clsx(
                    'w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2',
                    'transition-all active:scale-[0.98]',
                    canKill
                      ? 'bg-danger text-white hover:brightness-110'
                      : 'bg-surface/60 border border-edge/60 text-ink-muted/60 cursor-not-allowed'
                  )}
                >
                  <Crosshair size={16} />
                  {cooldownLeft > 0 ? `Cooldown ${cooldownLeft}s` : `Kill ${p.name}`}
                </button>
              ))}
              {roomMates.length === 0 && cooldownLeft > 0 && (
                <p className="text-xs text-ink-muted text-center">
                  Kill ready in {cooldownLeft}s
                </p>
              )}
            </div>
          )}

          {isImpostor && (
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2 flex items-center gap-1.5">
                <ShieldAlert size={12} /> Sabotage
                {sabotageReadyIn > 0 && (
                  <span className="ml-auto normal-case tracking-normal tabular">{sabotageReadyIn}s</span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { kind: 'lights' as SabotageKind, label: 'Lights', icon: Lightbulb },
                  { kind: 'doors' as SabotageKind, label: 'Doors', icon: DoorClosed },
                  { kind: 'reactor' as SabotageKind, label: 'Reactor', icon: Radiation },
                ]).map(({ kind, label, icon: Icon }) => {
                  const blocked = sabotageReadyIn > 0 || (!!sabotage && sabotageSecondsLeft > 0);
                  return (
                    <button
                      key={kind}
                      disabled={blocked}
                      onClick={() => networkManager.sendDeadlockSabotage(kind)}
                      className={clsx(
                        'h-16 rounded-xl border flex flex-col items-center justify-center gap-1',
                        'transition-all active:scale-[0.97]',
                        blocked
                          ? 'bg-surface/40 border-edge/40 text-ink-muted/40 cursor-not-allowed'
                          : kind === 'reactor'
                            ? 'bg-danger/10 border-danger/40 text-danger hover:bg-danger/20'
                            : 'bg-warning/10 border-warning/35 text-warning hover:bg-warning/20'
                      )}
                    >
                      <Icon size={16} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">
                Doors seal the room you are standing in. The reactor forces the crew
                to drop everything and run.
              </p>
              {ventExits.length > 0 && (
                <p className="text-[11px] text-danger/90 mt-2 flex items-start gap-1.5 leading-relaxed">
                  <ArrowDownUp size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Shafts from here reach{' '}
                    <span className="font-semibold">
                      {ventExits.map(id => getRoom(id)?.name).filter(Boolean).join(' and ')}
                    </span>
                    . Nobody can walk that fast — mind who sees you arrive.
                  </span>
                </p>
              )}
            </div>
          )}

          {bodiesHere.map(b => (
            <button
              key={b.playerId}
              onClick={() => networkManager.sendDeadlockMeeting(b.playerId)}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-danger text-white
                hover:brightness-110 transition-all active:scale-[0.98]
                inline-flex items-center justify-center gap-2 animate-pulse-glow"
            >
              <AlertTriangle size={16} />
              Report {players[b.playerId]?.name ?? 'the body'}
            </button>
          ))}

          <button
            onClick={() => networkManager.sendDeadlockMeeting(null)}
            disabled={deadlock.emergencyUsed}
            className={clsx(
              'w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2',
              'transition-all active:scale-[0.98]',
              deadlock.emergencyUsed
                ? 'bg-surface/50 border border-edge/50 text-ink-muted/50 cursor-not-allowed'
                : 'bg-warning/15 border border-warning/40 text-warning hover:bg-warning/25'
            )}
          >
            <Siren size={16} />
            {deadlock.emergencyUsed ? 'Emergency used' : 'Emergency meeting'}
          </button>
        </div>
      </div>

      {taskOpen && myRoom && (
        <StationTask
          roomName={myRoom.name}
          onClose={() => setTaskOpen(false)}
          onComplete={() => {
            networkManager.sendDeadlockTask(myRoomId);
            useGameStore.getState().setDeadlock({
              myTasksDone: [...deadlock.myTasksDone, myRoomId],
            });
            setTaskOpen(false);
          }}
        />
      )}

      {/* Cooldown is tracked locally from the last kill so the button is
          honest between host broadcasts. */}
      <span className="hidden">{KILL_COOLDOWN_SECONDS}</span>
    </div>
  );
}
