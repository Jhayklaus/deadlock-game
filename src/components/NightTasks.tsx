import { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { Card } from './ui/Card';
import { Check, RefreshCw, Trophy } from 'lucide-react';
import { Minigame, MINIGAME_META, pickMinigame, type TaskKind } from './minigames';

/**
 * Small tasks for players with nothing to do at night.
 *
 * Civilians previously sat through every night phase watching a timer, which
 * is the longest stretch of dead time in the game. These are deliberately
 * short and low-stakes: they pass the time and feed a shared town progress
 * bar, nothing more.
 */

export default function NightTasks() {
  const { taskProgress, myTasksDone, enabled } = useGameStore(state => ({
    taskProgress: state.taskProgress,
    myTasksDone: state.myTasksDone,
    enabled: state.settings.nightTasksEnabled !== false,
  }));

  const [kind, setKind] = useState<TaskKind>(() => pickMinigame());
  const [round, setRound] = useState(0);
  const [justDone, setJustDone] = useState(false);

  const handleDone = useCallback(() => {
    setJustDone(true);
    networkManager.sendTaskComplete(kind);
  }, [kind]);

  const nextTask = () => {
    setJustDone(false);
    // Avoid handing out the same task twice in a row.
    setKind(pickMinigame(kind));
    setRound(r => r + 1);
  };

  if (!enabled) return null;

  const meta = MINIGAME_META[kind];
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
            <Minigame kind={kind} onDone={handleDone} />
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
