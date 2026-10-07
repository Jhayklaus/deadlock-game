import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../../../lib/store';
import { networkManager } from '../../../lib/network';
import { DEADLOCK_ROOMS, getCorridors, getRoom, isAdjacent, SPAWN_ROOM } from '../../../data/deadlockMap';
import { KILL_COOLDOWN_SECONDS } from '../../../modes/deadlock';
import { Card } from '../../ui/Card';
import StationTask from './StationTask';
import { Crosshair, Siren, AlertTriangle, CheckCircle2, Footprints, Users } from 'lucide-react';

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
  const myRoomId = deadlock.positions[myId] ?? SPAWN_ROOM;
  const myRoom = getRoom(myRoomId);

  const corridors = useMemo(() => getCorridors(), []);

  // Who else is standing here right now.
  const roomMates = Object.values(players).filter(
    p => p.isAlive && p.id !== myId && deadlock.positions[p.id] === myRoomId
  );
  const bodiesHere = deadlock.bodies.filter(b => b.roomId === myRoomId);

  const taskHere =
    deadlock.myTasks.includes(myRoomId) && !deadlock.myTasksDone.includes(myRoomId);

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
              const reachable = isAdjacent(myRoomId, room.id);
              const occupants = Object.values(players).filter(
                p => p.isAlive && deadlock.positions[p.id] === room.id
              );
              const bodies = deadlock.bodies.filter(b => b.roomId === room.id);
              const hasMyTask =
                deadlock.myTasks.includes(room.id) && !deadlock.myTasksDone.includes(room.id);

              return (
                <button
                  key={room.id}
                  disabled={!reachable && !here}
                  onClick={() => reachable && networkManager.sendDeadlockMove(room.id)}
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
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-ink-muted text-center mt-2 flex items-center justify-center gap-1.5">
            <Footprints size={12} />
            Click a connected room to walk there
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
              ? 'Let this fill and the crew wins. Slow them down.'
              : 'Finish every task and the crew wins, even without catching anyone.'}
          </p>
        </Card>

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
