import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { Card } from './ui/Card';
import { Check, Cable, Brain, KeyRound, RefreshCw, Trophy } from 'lucide-react';

/**
 * Small tasks for players with nothing to do at night.
 *
 * Civilians previously sat through every night phase watching a timer, which
 * is the longest stretch of dead time in the game. These are deliberately
 * short and low-stakes: they pass the time and feed a shared town progress
 * bar, nothing more.
 */

type TaskKind = 'wires' | 'memory' | 'keypad';

const WIRE_COLOURS = [
  { id: 'r', class: 'bg-red-500', ring: 'ring-red-500' },
  { id: 'b', class: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'g', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'y', class: 'bg-amber-400', ring: 'ring-amber-400' },
];

function shuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Connect each wire on the left to the matching colour on the right. */
function WireTask({ onDone }: { onDone: () => void }) {
  const [left] = useState(() => shuffle(WIRE_COLOURS));
  const [right] = useState(() => shuffle(WIRE_COLOURS));
  const [picked, setPicked] = useState<string | null>(null);
  const [joined, setJoined] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  const connect = (rightId: string) => {
    if (!picked) return;
    if (picked === rightId) {
      const next = [...joined, rightId];
      setJoined(next);
      setPicked(null);
      if (next.length === WIRE_COLOURS.length) onDone();
    } else {
      setWrong(rightId);
      setTimeout(() => setWrong(null), 400);
      setPicked(null);
    }
  };

  return (
    <div className="flex items-center justify-between gap-8 px-2">
      <div className="flex flex-col gap-3">
        {left.map(w => (
          <button
            key={w.id}
            disabled={joined.includes(w.id)}
            onClick={() => setPicked(w.id)}
            className={clsx(
              'w-14 h-7 rounded-md transition-all duration-200',
              w.class,
              joined.includes(w.id) && 'opacity-30',
              picked === w.id && `ring-2 ring-offset-2 ring-offset-elevated ${w.ring} scale-105`
            )}
            aria-label={`Wire ${w.id}`}
          />
        ))}
      </div>

      <div className="flex-1 border-t border-dashed border-edge/60" />

      <div className="flex flex-col gap-3">
        {right.map(w => (
          <button
            key={w.id}
            disabled={joined.includes(w.id)}
            onClick={() => connect(w.id)}
            className={clsx(
              'w-14 h-7 rounded-md transition-all duration-200',
              w.class,
              joined.includes(w.id) && 'opacity-30',
              wrong === w.id && 'animate-shake'
            )}
            aria-label={`Terminal ${w.id}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Watch a sequence light up, then repeat it. */
function MemoryTask({ onDone }: { onDone: () => void }) {
  const sequence = useMemo(
    () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 9)),
    []
  );
  const [showing, setShowing] = useState(true);
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const playNext = () => {
      if (i >= sequence.length) {
        timers.push(setTimeout(() => { setLit(null); setShowing(false); }, 400));
        return;
      }
      const cell = sequence[i++];
      setLit(cell);
      timers.push(setTimeout(() => {
        setLit(null);
        timers.push(setTimeout(playNext, 180));
      }, 450));
    };
    timers.push(setTimeout(playNext, 500));
    return () => timers.forEach(clearTimeout);
  }, [sequence]);

  const press = (cell: number) => {
    if (showing) return;
    if (sequence[step] === cell) {
      const next = step + 1;
      setStep(next);
      if (next === sequence.length) onDone();
    } else {
      // Wrong tile just restarts the input — no penalty beyond the time lost.
      setWrong(true);
      setStep(0);
      setTimeout(() => setWrong(false), 400);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-ink-muted">
        {showing ? 'Watch the sequence…' : `Repeat it — ${step}/${sequence.length}`}
      </p>
      <div className={clsx('grid grid-cols-3 gap-2', wrong && 'animate-shake')}>
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            onClick={() => press(i)}
            disabled={showing}
            className={clsx(
              'w-12 h-12 rounded-lg border transition-all duration-150',
              lit === i
                ? 'bg-accent border-accent scale-105'
                : 'bg-surface/60 border-edge/60 hover:border-edge'
            )}
            aria-label={`Tile ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Read the code, punch it in. */
function KeypadTask({ onDone }: { onDone: () => void }) {
  const code = useMemo(
    () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join(''),
    []
  );
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = (digit: string) => {
    const next = entry + digit;
    if (next.length < code.length) { setEntry(next); return; }

    if (next === code) { setEntry(next); onDone(); }
    else {
      setWrong(true);
      setEntry('');
      setTimeout(() => setWrong(false), 400);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-1">Code</p>
        <p className="text-2xl font-mono tracking-[0.35em] text-accent">{code}</p>
      </div>
      <div className={clsx(
        'h-9 px-4 grid place-items-center rounded-lg border border-edge/60 bg-base/50',
        'font-mono text-lg tracking-[0.35em] text-ink min-w-[7rem]',
        wrong && 'animate-shake border-danger/60'
      )}>
        {entry.padEnd(code.length, '·')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','0'].map(d => (
          <button
            key={d}
            onClick={() => press(d)}
            className="w-11 h-11 rounded-lg border border-edge/60 bg-surface/60 text-ink
              font-mono hover:border-accent/50 hover:bg-accent/10 transition-colors active:scale-95"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

const TASKS: Record<TaskKind, { title: string; blurb: string; icon: typeof Cable }> = {
  wires: { title: 'Repair the wiring', blurb: 'Match each wire to its terminal.', icon: Cable },
  memory: { title: 'Check the panel', blurb: 'Watch the sequence, then repeat it.', icon: Brain },
  keypad: { title: 'Unlock the door', blurb: 'Punch in the code.', icon: KeyRound },
};

const KINDS: TaskKind[] = ['wires', 'memory', 'keypad'];

export default function NightTasks() {
  const { taskProgress, myTasksDone, enabled } = useGameStore(state => ({
    taskProgress: state.taskProgress,
    myTasksDone: state.myTasksDone,
    enabled: state.settings.nightTasksEnabled !== false,
  }));

  const [kind, setKind] = useState<TaskKind>(() => KINDS[Math.floor(Math.random() * KINDS.length)]);
  const [round, setRound] = useState(0);
  const [justDone, setJustDone] = useState(false);

  const handleDone = useCallback(() => {
    setJustDone(true);
    networkManager.sendTaskComplete(kind);
  }, [kind]);

  const nextTask = () => {
    setJustDone(false);
    // Avoid handing out the same task twice in a row.
    const others = KINDS.filter(k => k !== kind);
    setKind(others[Math.floor(Math.random() * others.length)]);
    setRound(r => r + 1);
  };

  if (!enabled) return null;

  const meta = TASKS[kind];
  const Icon = meta.icon;
  const pct = taskProgress.required > 0
    ? Math.min(100, Math.round((taskProgress.completed / taskProgress.required) * 100))
    : 0;
  const metQuota = taskProgress.required > 0 && taskProgress.completed >= taskProgress.required;

  return (
    <Card variant="glass">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-edge/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <Icon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-heading font-semibold text-ink">{meta.title}</h3>
            <p className="text-xs text-ink-muted">{meta.blurb}</p>
          </div>
        </div>
        {myTasksDone > 0 && (
          <span className="text-xs text-ink-muted shrink-0">{myTasksDone} done</span>
        )}
      </div>

      <div className="min-h-[190px] grid place-items-center py-2">
        {justDone ? (
          <div className="text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/15 border border-success/40 grid place-items-center">
              <Check size={22} className="text-success" />
            </div>
            <p className="text-ink font-semibold mb-3">Done.</p>
            <button
              onClick={nextTask}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold
                border border-edge/70 text-ink-muted hover:text-ink hover:border-accent/50 transition-colors"
            >
              <RefreshCw size={13} /> Another
            </button>
          </div>
        ) : (
          <div key={`${kind}-${round}`} className="w-full animate-in fade-in duration-300">
            {kind === 'wires' && <WireTask onDone={handleDone} />}
            {kind === 'memory' && <MemoryTask onDone={handleDone} />}
            {kind === 'keypad' && <KeypadTask onDone={handleDone} />}
          </div>
        )}
      </div>

      {/* Shared town progress */}
      {taskProgress.required > 0 && (
        <div className="mt-4 pt-4 border-t border-edge/50">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-ink-muted">Town progress</span>
            <span className={clsx('font-semibold tabular', metQuota ? 'text-success' : 'text-ink-muted')}>
              {taskProgress.completed}/{taskProgress.required}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500 ease-out-expo',
                metQuota ? 'bg-success' : 'bg-accent'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {metQuota && (
            <p className="flex items-center gap-1.5 text-xs text-success mt-2">
              <Trophy size={12} /> Quota met — the town gets longer to talk tomorrow.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
