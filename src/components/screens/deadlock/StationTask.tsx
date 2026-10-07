import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { X, Check } from 'lucide-react';

/**
 * A station task.
 *
 * Deliberately the same shape of micro-puzzle as the classic night tasks: the
 * point is a few seconds of attention away from the map, which is exactly what
 * makes doing tasks risky.
 */
export default function StationTask({
  roomName,
  onComplete,
  onClose,
}: {
  roomName: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const code = useMemo(
    () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join(''),
    []
  );
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);
  const [done, setDone] = useState(false);

  const press = (digit: string) => {
    if (done) return;
    const next = entry + digit;
    if (next.length < code.length) { setEntry(next); return; }
    if (next === code) {
      setEntry(next);
      setDone(true);
      setTimeout(onComplete, 550);
    } else {
      setWrong(true);
      setEntry('');
      setTimeout(() => setWrong(false), 400);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-elevated border border-edge/70 rounded-2xl shadow-2xl
          edge-light p-5 animate-in fade-in zoom-in-95 duration-300"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-0.5">{roomName}</p>
            <h3 className="text-base font-heading font-semibold text-ink">Recalibrate the console</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 -mt-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Leave the task"
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="py-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/15 border border-success/40 grid place-items-center">
              <Check size={22} className="text-success" />
            </div>
            <p className="text-ink font-semibold">Console online.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-1">Sequence</p>
              <p className="text-2xl font-mono tracking-[0.35em] text-accent">{code}</p>
            </div>
            <div className={clsx(
              'h-10 px-4 grid place-items-center rounded-lg border border-edge/60 bg-base/50',
              'font-mono text-lg tracking-[0.35em] text-ink min-w-[7rem]',
              wrong && 'animate-shake border-danger/60'
            )}>
              {entry.padEnd(code.length, '·')}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {['1','2','3','4','5','6','7','8','9','0'].map(d => (
                <button
                  key={d}
                  onClick={() => press(d)}
                  className="w-11 h-11 rounded-lg border border-edge/60 bg-surface/60 text-ink font-mono
                    hover:border-accent/50 hover:bg-accent/10 transition-colors active:scale-95"
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-muted text-center">
              You are not watching the door while you do this.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
